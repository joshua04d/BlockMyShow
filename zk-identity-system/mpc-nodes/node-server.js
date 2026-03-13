// mpc-nodes/node-server.js
// -----------------------------------------------------------
// One MPC committee node. Run 5 instances of this on
// different ports (3001–3005) to simulate the full committee.
//
// Each node:
//   1. Receives its share via POST /receive-share
//   2. Computes a partial hash of its share
//   3. Broadcasts its partial to all other nodes
//   4. Combines all partials into the final identity hash
// -----------------------------------------------------------

import express  from 'express'
import cors     from 'cors'
import crypto   from 'crypto'

const app    = express()
const PORT   = parseInt(process.env.PORT  || '3001')
const NODE_ID = parseInt(process.env.NODE_ID || '1')

app.use(cors())
app.use(express.json())

// --- In-memory state for this node ---
// (In production this would be encrypted persistent storage)
const state = {
  share:          null,   // our Shamir share (hex string)
  partialHash:    null,   // SHA256(our share)
  peersPartials:  {},     // partials received from other nodes
  identityHash:   null,   // final computed result
}

// All 5 node URLs — each node knows about all others
const ALL_NODES = [
  { id: 1, url: 'http://localhost:3001' },
  { id: 2, url: 'http://localhost:3002' },
  { id: 3, url: 'http://localhost:3003' },
  { id: 4, url: 'http://localhost:3004' },
  { id: 5, url: 'http://localhost:3005' },
]

// ── Route 1: Receive our share from the distributor ──────────
// Called by scripts/distribute.js (Phase 3 version)
app.post('/receive-share', async (req, res) => {
  const { share } = req.body

  if (!share) {
    return res.status(400).json({ error: 'No share provided' })
  }

  state.share = share
  console.log(`[Node ${NODE_ID}] Received share: ${share.slice(0, 16)}...`)

  // Immediately compute our partial hash
  // partial = SHA256(our_share)
  // This is safe to broadcast — it reveals nothing about the share itself
  state.partialHash = crypto
    .createHash('sha256')
    .update(share)
    .digest('hex')

  console.log(`[Node ${NODE_ID}] Computed partial hash: ${state.partialHash.slice(0, 16)}...`)

  // Broadcast our partial to all other nodes
  await broadcastPartial()

  res.json({
    nodeId:      NODE_ID,
    status:      'share received',
    partialHash: state.partialHash
  })
})

// ── Route 2: Receive a partial hash from another node ────────
app.post('/receive-partial', (req, res) => {
  const { fromNodeId, partialHash } = req.body

  if (!fromNodeId || !partialHash) {
    return res.status(400).json({ error: 'Missing fromNodeId or partialHash' })
  }

  state.peersPartials[fromNodeId] = partialHash
  console.log(`[Node ${NODE_ID}] Got partial from Node ${fromNodeId}: ${partialHash.slice(0, 16)}...`)

  // Check if we have all 5 partials (ours + 4 peers)
  const allPartials = {
    ...state.peersPartials,
    [NODE_ID]: state.partialHash
  }

  const receivedCount = Object.keys(allPartials).filter(k => allPartials[k]).length

  if (receivedCount === 5 && !state.identityHash) {
    // We have all partials — compute the final identity hash
    state.identityHash = combinePartials(allPartials)
    console.log(`[Node ${NODE_ID}] ✅ Final identity hash: ${state.identityHash.slice(0, 16)}...`)
  }

  res.json({ status: 'partial received', totalReceived: receivedCount })
})

// ── Route 3: Get the final computed identity hash ────────────
app.get('/identity-hash', (req, res) => {
  if (!state.identityHash) {
    return res.status(425).json({ error: 'Not ready yet — waiting for more partials' })
  }

  res.json({
    nodeId:       NODE_ID,
    identityHash: state.identityHash,
    status:       'complete'
  })
})

// ── Route 4: Health check ─────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    nodeId:          NODE_ID,
    hasShare:        !!state.share,
    hasPartial:      !!state.partialHash,
    peersReceived:   Object.keys(state.peersPartials).length,
    isComplete:      !!state.identityHash,
  })
})

// ── Helpers ───────────────────────────────────────────────────

// Broadcast our partial hash to all other nodes
async function broadcastPartial() {
  const otherNodes = ALL_NODES.filter(n => n.id !== NODE_ID)

  console.log(`[Node ${NODE_ID}] Broadcasting partial to ${otherNodes.length} peers...`)

  for (const peer of otherNodes) {
    try {
      const res = await fetch(`${peer.url}/receive-partial`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fromNodeId:  NODE_ID,
          partialHash: state.partialHash
        })
      })
      const data = await res.json()
      console.log(`[Node ${NODE_ID}] → Node ${peer.id} acknowledged (${data.totalReceived}/5 partials)`)
    } catch (err) {
      // Node might not be up yet — that's fine, distributor retries
      console.log(`[Node ${NODE_ID}] → Node ${peer.id} not reachable yet`)
    }
  }
}

// Combine all 5 partial hashes into the final identity hash
// H(identity) = SHA256(partial_1 | partial_2 | ... | partial_5)
// Order is deterministic (sorted by node ID) so all nodes get the same result
function combinePartials(partials) {
  const ordered = [1, 2, 3, 4, 5]
    .map(id => partials[id])
    .join('|')

  return crypto
    .createHash('sha256')
    .update(ordered)
    .digest('hex')
}

app.listen(PORT, () => {
  console.log(`\n🖥  Node ${NODE_ID} running on port ${PORT}`)
  console.log(`   Waiting to receive share...`)
})