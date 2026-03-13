// scripts/distribute.js  (Phase 3 version)
// -----------------------------------------------------------
// Splits the identity hash into 5 shares, then POST's each
// share to its designated node server over HTTP.
// -----------------------------------------------------------

import { splitIdentity } from './shamir.js'

const NODES = [
  { id: 1, name: 'Node-A', url: 'http://localhost:3001' },
  { id: 2, name: 'Node-B', url: 'http://localhost:3002' },
  { id: 3, name: 'Node-C', url: 'http://localhost:3003' },
  { id: 4, name: 'Node-D', url: 'http://localhost:3004' },
  { id: 5, name: 'Node-E', url: 'http://localhost:3005' },
]

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Wait for a node to be reachable (it might still be booting)
async function waitForNode(url, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(`${url}/status`)
      return true
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  return false
}

async function distribute() {
  console.log('🔑 Generating identity hash and splitting...\n')
  const { shares } = await splitIdentity()

  console.log('\n📡 Sending shares to committee nodes...\n')

  for (let i = 0; i < NODES.length; i++) {
    const node  = NODES[i]
    const share = bytesToHex(shares[i])

    // Wait until the node server is up
    const ready = await waitForNode(node.url)
    if (!ready) {
      console.error(`❌ ${node.name} is not reachable. Is the committee running?`)
      process.exit(1)
    }

    // POST the share to the node
    const res  = await fetch(`${node.url}/receive-share`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ share })
    })
    const data = await res.json()

    console.log(`  ✅ ${node.name} received share`)
    console.log(`     partial hash: ${data.partialHash.slice(0, 20)}...`)
  }

  // Wait a moment for nodes to exchange partials
  console.log('\n⏳ Waiting for nodes to exchange partials...')
  await new Promise(r => setTimeout(r, 2000))

  // Collect the final identity hash from all nodes
  console.log('\n🔍 Collecting final identity hash from all nodes:\n')

  const results = []
  for (const node of NODES) {
    const res  = await fetch(`${node.url}/identity-hash`)
    const data = await res.json()
    console.log(`  ${node.name}: ${data.identityHash.slice(0, 24)}...`)
    results.push(data.identityHash)
  }

  // All nodes should agree on the same hash
  const allMatch = results.every(h => h === results[0])
  console.log(`\n${allMatch ? '✅' : '❌'} All nodes agree: ${allMatch ? 'YES' : 'NO'}`)

  if (allMatch) {
    console.log(`\n🎯 Final identity hash (MPC output):`)
    console.log(`   ${results[0]}`)
    console.log(`\nThis hash is your identity anchor.`)
    console.log(`It was computed across 5 nodes. No node ever saw the full secret.`)
  }
}

distribute()