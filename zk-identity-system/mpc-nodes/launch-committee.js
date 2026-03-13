// mpc-nodes/launch-committee.js
// -----------------------------------------------------------
// Spawns all 5 node servers as child processes.
// Run this once — it starts Node-A through Node-E.
// Press Ctrl+C to shut them all down.
// -----------------------------------------------------------

import { spawn } from 'child_process'
import path      from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverFile = path.join(__dirname, 'node-server.js')

const NODES = [
  { id: 1, port: 3001, name: 'Node-A' },
  { id: 2, port: 3002, name: 'Node-B' },
  { id: 3, port: 3003, name: 'Node-C' },
  { id: 4, port: 3004, name: 'Node-D' },
  { id: 5, port: 3005, name: 'Node-E' },
]

const processes = []

console.log('🚀 Launching MPC committee (5 nodes)...\n')

for (const node of NODES) {
  const proc = spawn('node', [serverFile], {
    env: {
      ...process.env,
      PORT:    node.port.toString(),
      NODE_ID: node.id.toString(),
    },
    stdio: 'inherit'   // pipe output to this terminal
  })

  proc.on('error', err => {
    console.error(`❌ ${node.name} failed to start:`, err.message)
  })

  processes.push(proc)
  console.log(`  ✅ Spawned ${node.name} on port ${node.port}`)
}

// Shut down all nodes when this process exits
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down committee...')
  processes.forEach(p => p.kill())
  process.exit(0)
})

console.log('\n📡 Committee is live. Press Ctrl+C to stop all nodes.\n')