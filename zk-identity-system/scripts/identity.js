// scripts/identity.js
// -----------------------------------------------------------
// This file simulates what the app does on your device:
//   1. Take your ID fields
//   2. Hash each one
//   3. Combine into a single "identity hash"
// Nothing here ever leaves the device in a real system.
// -----------------------------------------------------------

import crypto from 'crypto'

// --- Simulate raw ID fields (in a real app: OCR output) ---
const ID_FIELDS = {
  name:        'Joshua T.',
  dob:         '1998-03-15',
  id_number:   'MH2491837',
  nationality: 'IN'
}

// --- Hash a single string field using SHA-256 ---
function hashField(value) {
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex')
}

// --- Hash all fields, then hash the combination ---
// This gives us ONE identity hash that represents all fields.
export function getIdentityHash() {
  const fieldHashes = Object.values(ID_FIELDS).map(hashField)
  
  // Combine all field hashes into one master hash
  const combined = fieldHashes.join('|')
  const identityHash = crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex')

  return identityHash
}

// --- Run directly to see the output ---
const hash = getIdentityHash()
console.log('Identity hash:', hash)
console.log('Length:', hash.length, 'hex chars =', hash.length / 2, 'bytes')