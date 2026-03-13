// scripts/shamir.js
// -----------------------------------------------------------
// Splits an identity hash into N shares using Shamir's
// Secret Sharing. Any K shares can reconstruct the secret.
//
// We use: N = 5 nodes, K = 3 threshold
// -----------------------------------------------------------

import { split, combine } from 'shamir-secret-sharing'
import { getIdentityHash } from './identity.js'

const TOTAL_SHARES = 5    // how many pieces to split into
const THRESHOLD    = 3    // minimum pieces needed to reconstruct

// --- Convert a hex string to a Uint8Array ---
// Shamir works on raw bytes, not hex strings
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// --- Convert a Uint8Array back to hex ---
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// --- Split the identity hash into shares ---
export async function splitIdentity() {
  const identityHash = getIdentityHash()
  console.log('\n📋 Identity hash to split:')
  console.log('  ', identityHash)

  // Convert hex string → raw bytes (Shamir needs bytes)
  const secretBytes = hexToBytes(identityHash)

  // Split into TOTAL_SHARES pieces, requiring THRESHOLD to reconstruct
  const shares = await split(secretBytes, TOTAL_SHARES, THRESHOLD)

  console.log(`\n✂️  Split into ${TOTAL_SHARES} shares (threshold: ${THRESHOLD}):`)
  shares.forEach((share, i) => {
    console.log(`  Node ${i + 1} share: ${bytesToHex(share).slice(0, 20)}...`)
  })

  return { shares, identityHash }
}

// --- Reconstruct the secret from K shares ---
// Pass any K or more shares from the original set
export async function reconstructIdentity(sharesSubset) {
  const reconstructed = await combine(sharesSubset)
  return bytesToHex(reconstructed)
}

// --- Test the full split → reconstruct round trip ---
async function test() {
  const { shares, identityHash } = await splitIdentity()

  // Try reconstructing with shares 1, 3, 5 (only 3 of the 5)
  const subset = [shares[0], shares[2], shares[4]]
  const recovered = await reconstructIdentity(subset)

  console.log('\n🔁 Reconstruction test (using shares 1, 3, 5):')
  console.log('  Original:     ', identityHash)
  console.log('  Reconstructed:', recovered)
  console.log('  Match:', identityHash === recovered ? '✅ YES' : '❌ NO')

  // Try with only 2 shares — should fail or return garbage
  console.log('\n⚠️  Attempting reconstruction with only 2 shares:')
  try {
    const twoShares = [shares[0], shares[1]]
    const bad = await reconstructIdentity(twoShares)
    console.log('  Result:', bad === identityHash ? '❌ Incorrectly succeeded' : '✅ Got wrong result (expected)')
  } catch (e) {
    console.log('  ✅ Failed as expected:', e.message)
  }
}

test()