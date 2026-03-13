# ZK Identity System
### "Prove you're you, without revealing who you are"

A privacy-preserving identity verification system using Shamir Secret Sharing, Multi-Party Computation (MPC), and Zero-Knowledge Proofs (ZK). You can prove you are a unique real person for any event — without ever revealing your name, date of birth, or any personal detail.

---

## Table of Contents

1. [How It Works — The Big Picture](#how-it-works)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Running the Application](#running-the-application)
6. [Phase-by-Phase Explanation](#phase-by-phase-explanation)
7. [Key Concepts Explained Simply](#key-concepts-explained-simply)
8. [Troubleshooting](#troubleshooting)

---

## How It Works

The system has two main flows:

### Flow 1 — One-time Identity Registration
```
Your ID card
     │
     ▼  (on your device only)
Hash each field (name, DOB, ID number, nationality)
     │
     ▼
One identity hash  (e.g. 3f8a2c...)
     │
     ▼  Shamir Secret Sharing
Split into 5 shares  (threshold: any 3 of 5 can reconstruct)
     │
     ├──── share 1 ──▶ Node-A (port 3001)
     ├──── share 2 ──▶ Node-B (port 3002)
     ├──── share 3 ──▶ Node-C (port 3003)
     ├──── share 4 ──▶ Node-D (port 3004)
     └──── share 5 ──▶ Node-E (port 3005)
                            │
                            ▼  MPC (no node sees full secret)
                    Each node computes partial_i = SHA256(share_i)
                    Nodes exchange partials
                    All nodes compute H(identity) = SHA256(all partials)
                            │
                            ▼
                    Master credential minted
                    (stored on-chain as a commitment, not your identity)
```

### Flow 2 — Per-Event Credential (anonymous ticket purchase)
```
You want to attend Event #42
     │
     ▼
event_nullifier = PRF(master_secret, event_id)
event_commit    = Pedersen(event_nullifier, random_blinding)
     │
     ▼
ZK Proof generated on your device:
  "I know a master_secret such that:
   (1) it matches the master_commit on-chain
   (2) this event_nullifier was derived from it correctly"
     │
     ▼
Submit (event_commit, event_nullifier, ZK proof) to smart contract
     │
     ▼
Contract checks:
  ✓ ZK proof is valid
  ✓ event_nullifier not used before for this event
     │
     ▼
Ticket minted ✅  (no name, no ID, just a valid proof)
```

**Why this is powerful:** Two registrations for the same event from the same real identity produce the same `event_nullifier`. The second one gets rejected. No bots. No duplicates. Full anonymity.

---

## Project Structure

```
zk-identity-system/
│
├── scripts/
│   ├── identity.js       ← Hashes your ID fields into one identity hash
│   ├── shamir.js         ← Splits the hash into 5 shares (Shamir SSS)
│   └── distribute.js     ← Sends each share to its node via HTTP
│
├── mpc-nodes/
│   ├── node-server.js    ← One MPC committee node (run 5 instances)
│   └── launch-committee.js ← Spawns all 5 nodes at once
│
├── circuits/             ← Circom ZK circuit files (Phase 4)
│   ├── identity.circom
│   └── build/            ← Auto-generated (do not edit)
│
├── contracts/            ← Solidity smart contracts (Phase 5)
│   ├── IdentityVerifier.sol
│   └── NullifierRegistry.sol
│
├── frontend/             ← React app (Phase 6)
│   └── src/
│
├── .env                  ← Your secrets (never commit this)
├── hardhat.config.js     ← Hardhat configuration
└── package.json
```

---

## Prerequisites

Before running anything, make sure you have:

| Tool | Version | Check with |
|------|---------|-----------|
| Node.js | v18 or higher | `node --version` |
| npm | v8 or higher | `npm --version` |
| Git | any recent | `git --version` |
| Circom | v2.1.x | `circom --version` |
| WSL (Windows) | Ubuntu 20.04+ | `wsl --version` |

> **Note for Windows users:** Run every command inside WSL (Windows Subsystem for Linux), not PowerShell or CMD.

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-username/zk-identity-system.git
cd zk-identity-system
```

### Step 2 — Install Node dependencies

```bash
npm install
```

This installs everything: Shamir SSS, snarkjs, circomlib, ethers, hardhat, express, and more.

### Step 3 — Install Circom (ZK circuit compiler)

Circom is a separate binary that needs Rust to build.

```bash
# Install Rust (say yes to defaults)
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh

# Reload your shell so `cargo` is available
source ~/.bashrc

# Clone and build Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..

# Verify
circom --version
# Expected: circom compiler 2.1.x
```

### Step 4 — Set up your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_metamask_wallet_private_key_here
```

> **How to get your private key from MetaMask:**
> MetaMask → click your account → Account Details → Export Private Key
> Never share this with anyone. Never commit the `.env` file.

---

## Running the Application

The system runs in stages. Follow them in order.

---

### Stage 1 — Test identity hashing

This runs entirely on your machine. No servers needed.

```bash
node scripts/identity.js
```

**Expected output:**
```
Identity hash: 3f8a2c9d1e4b7a6f... (64 hex characters)
Length: 64 hex chars = 32 bytes
```

This is the SHA-256 hash of your (simulated) ID fields. Same fields always produce the same hash.

---

### Stage 2 — Test Shamir split and reconstruction

```bash
node scripts/shamir.js
```

**Expected output:**
```
📋 Identity hash to split:
   3f8a2c...

✂️  Split into 5 shares (threshold: 3):
  Node 1 share: a3f12e8b4c...
  Node 2 share: 9d23ac1f7b...
  ...

🔁 Reconstruction test (using shares 1, 3, 5):
  Original:      3f8a2c...
  Reconstructed: 3f8a2c...
  Match: ✅ YES

⚠️  Attempting reconstruction with only 2 shares:
  ✅ Got wrong result (expected)
```

The last line is important — 2 shares produce garbage. That is the Shamir guarantee.

---

### Stage 3 — Run the MPC committee

This is the main event. You need **two terminals open** side by side.

**Terminal 1 — Start the 5 committee nodes:**
```bash
node mpc-nodes/launch-committee.js
```

Leave this running. You should see:
```
🚀 Launching MPC committee (5 nodes)...
  ✅ Spawned Node-A on port 3001
  ✅ Spawned Node-B on port 3002
  ✅ Spawned Node-C on port 3003
  ✅ Spawned Node-D on port 3004
  ✅ Spawned Node-E on port 3005

🖥  Node 1 running on port 3001 — Waiting to receive share...
🖥  Node 2 running on port 3002 — Waiting to receive share...
...
```

**Terminal 2 — Distribute shares and run MPC:**
```bash
node scripts/distribute.js
```

Expected output:
```
🔑 Generating identity hash and splitting...

📡 Sending shares to committee nodes...
  ✅ Node-A received share   partial: a3f12e...
  ✅ Node-B received share   partial: 9d23ac...
  ✅ Node-C received share   partial: 12bc4e...
  ✅ Node-D received share   partial: 7e45d2...
  ✅ Node-E received share   partial: c3891a...

⏳ Waiting for nodes to exchange partials...

🔍 Collecting final identity hash from all nodes:
  Node-A: 7c3f9a1b2e4d...
  Node-B: 7c3f9a1b2e4d...
  Node-C: 7c3f9a1b2e4d...
  Node-D: 7c3f9a1b2e4d...
  Node-E: 7c3f9a1b2e4d...

✅ All nodes agree: YES

🎯 Final identity hash (MPC output):
   7c3f9a1b2e4d...

This hash is your identity anchor.
It was computed across 5 nodes. No node ever saw the full secret.
```

**To check the status of any node individually:**
```bash
curl http://localhost:3001/status
# Returns: { nodeId: 1, hasShare: true, isComplete: true, ... }
```

**To stop the committee:**
Press `Ctrl+C` in Terminal 1.

---

### Stage 4 — Compile and run ZK circuits (Phase 4)

> Phase 4 is under active development. Instructions will be added here once complete.

```bash
# Compile the circuit
circom circuits/identity.circom --r1cs --wasm --sym -o circuits/build

# Generate proving key (uses Powers of Tau ceremony)
npx snarkjs groth16 setup circuits/build/identity.r1cs pot12_final.ptau circuits/build/identity_0000.zkey

# Generate a ZK proof
node scripts/generate-proof.js
```

---

### Stage 5 — Deploy contracts to Sepolia (Phase 5)

> Requires your `.env` to have a valid `PRIVATE_KEY` and `SEPOLIA_RPC_URL`.

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

---

### Stage 6 — Run the frontend (Phase 6)

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Phase-by-Phase Explanation

### Phase 1 — Project Setup
Sets up the folder structure, installs all dependencies, and initializes Hardhat. Nothing runs yet — this is just scaffolding.

**Key files created:** `package.json`, `.gitignore`, `.env`, `hardhat.config.js`

---

### Phase 2 — Shamir Secret Sharing
Your ID fields are hashed locally on your device. The resulting 32-byte identity hash is then split into 5 shares using Shamir's Secret Sharing polynomial math. Any 3 shares can reconstruct the secret. Fewer than 3 shares reveal nothing.

**Key files:** `scripts/identity.js`, `scripts/shamir.js`, `scripts/distribute.js`

**The math in plain English:**
Imagine drawing a straight line through two points. You only need 2 points to redraw the line. Shamir uses a polynomial (a curved line) of degree K−1. You need at least K points to redraw the curve. The secret is the value at x=0 on that curve — a point no share ever reveals on its own.

---

### Phase 3 — MPC Simulation
Five Express.js servers run locally, each holding one Shamir share. Each node hashes its own share to produce a `partial_hash`. Nodes broadcast their partial hashes to each other. Every node then combines all 5 partial hashes to produce `H(identity)` — the same result on all 5 nodes.

**Key files:** `mpc-nodes/node-server.js`, `mpc-nodes/launch-committee.js`

**Why this is MPC:**
No node ever reconstructs the full identity hash from shares. Each node only ever sees its own share and the partial hashes from other nodes. The partial hashes are one-way — you cannot reverse `SHA256(share_i)` to get `share_i`. The final hash is computed collaboratively without centralizing the secret.

---

### Phase 4 — ZK Circuits (coming)
A Circom circuit encodes the following statement as a mathematical constraint system:

*"I know a `master_secret` such that: (1) `Pedersen(master_secret)` equals the `master_commit` stored on-chain, and (2) `PRF(master_secret, event_id)` equals the `event_nullifier` I am submitting."*

The Groth16 proving system turns this into a 192-byte proof that anyone can verify in milliseconds — without learning anything about `master_secret`.

---

### Phase 5 — Smart Contracts (coming)
Two Solidity contracts deployed to Sepolia:

- `IdentityRegistry.sol` — stores `master_commit` values for registered identities
- `NullifierRegistry.sol` — stores used `event_nullifier` values per event, preventing duplicate registrations

The ZK verifier (auto-generated by snarkjs) is called inside the ticket minting function.

---

### Phase 6 — Frontend (coming)
A React app with three screens:

1. **ID scan** — simulates OCR, hashes fields, runs the full MPC flow
2. **Master credential** — shows your credential status, links to your on-chain commitment
3. **Event registration** — generates an event credential + ZK proof, submits to the contract

---

## Key Concepts Explained Simply

### What is Shamir Secret Sharing?
Split a secret into N pieces so that any K pieces can reconstruct it, but K−1 pieces reveal nothing at all. Like a nuclear launch code split across 5 generals — 3 must cooperate to launch.

### What is MPC (Multi-Party Computation)?
A group of parties compute a function on their private inputs — without any party revealing their input to the others. Like 3 people computing their average salary without any one person revealing their actual salary.

### What is a ZK Proof (Zero-Knowledge Proof)?
A way to prove you know something without revealing what you know. Classic example: prove you know the solution to a maze without showing the path — just enter and exit while someone watches from above.

### What is a Nullifier?
A deterministic value derived from your secret + an event ID. It uniquely identifies "this person for this event" without revealing who the person is. If you try to register twice, the same nullifier appears — and gets rejected. Used to prevent double-spending in ZK systems.

### What is a Pedersen Commitment?
A cryptographic commitment: you "lock in" a value without revealing it. Later you can prove you know what's inside the lock. Used here to commit to your `master_secret` on-chain without publishing the secret.

---

## Troubleshooting

### "Cannot find package" errors on startup
```bash
npm install
```
Make sure you have `"type": "module"` in your `package.json`.

### Circom not found after install
```bash
source ~/.bashrc   # or source ~/.zshrc
circom --version
```
If still missing: `cargo install --path circom` from inside the cloned circom folder.

### Node servers not reachable
Make sure `launch-committee.js` is running in Terminal 1 before you run `distribute.js` in Terminal 2. The distributor retries 10 times with 500ms delays, but the committee must be up first.

### Ports already in use (EADDRINUSE)
```bash
# Find and kill whatever is using port 3001–3005
lsof -ti:3001,3002,3003,3004,3005 | xargs kill -9
```

### Reconstruction gives wrong result
Check that you are passing `Uint8Array` objects (not hex strings) into `combine()`. The `shamir-secret-sharing` library requires raw bytes, not strings.

### MetaMask private key for Sepolia
Never use a wallet with real ETH on it. Create a fresh MetaMask account, export its private key, and fund it with Sepolia test ETH from https://sepoliafaucet.com.

---

## Security Notes

This is a **demonstration system**. Production use would require:

- Real MPC protocol (mp-spdz or Nillion) instead of simulated honest-but-curious
- Encrypted share transmission over TLS
- Hardware Security Modules (HSMs) for node key storage
- Formal audit of the Circom circuits
- Trusted Setup ceremony for the ZK proving key (not just a local ptau file)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Identity hashing | Node.js `crypto` (SHA-256) |
| Secret sharing | `shamir-secret-sharing` npm |
| MPC simulation | Express.js (5 local servers) |
| ZK circuits | Circom 2.0 + circomlib |
| ZK proving | snarkjs (Groth16) |
| Smart contracts | Solidity 0.8.20 + Hardhat |
| Blockchain | Ethereum Sepolia testnet |
| Frontend | React + ethers.js |

---

*Built as part of the BlockMyShow ecosystem — a privacy-first NFT ticketing platform.*