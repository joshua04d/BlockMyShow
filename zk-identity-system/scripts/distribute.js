// scripts/distribute.js
// -----------------------------------------------------------
// Takes the 5 shares and "sends" each one to its node.
// In Phase 3 these will be real HTTP calls to Express servers.
// For now: we just show what each node receives.
// -----------------------------------------------------------

import { splitIdentity } from './shamir.js'

// The 5 MPC committee nodes (ports we'll use in Phase 3)
const NODES = [
  { id: 1, name: 'Node-A', port: 3001 },
  { id: 2, name: 'Node-B', port: 3002 },
  { id: 3, name: 'Node-C', port: 3003 },
  { id: 4, name: 'Node-D', port: 3004 },
  { id: 5, name: 'Node-E', port: 3005 },
]

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function distribute() {
  const { shares } = await splitIdentity()

  console.log('\n📡 Distributing shares to committee nodes:\n')

  const nodePackages = NODES.map((node, i) => {
    const shareHex = bytesToHex(shares[i])
    console.log(`  → ${node.name} (port ${node.port})`)
    console.log(`    share: ${shareHex.slice(0, 24)}...`)

    return {
      nodeId:  node.id,
      name:    node.name,
      port:    node.port,
      share:   shareHex   // in Phase 3: this gets POST'd to localhost:port
    }
  })

  console.log('\n✅ All 5 shares distributed.')
  console.log('   Each node holds 1 share. No node can reconstruct alone.')
  console.log('   Phase 3 will have these nodes compute H(identity) together via MPC.')

  return nodePackages
}

distribute()