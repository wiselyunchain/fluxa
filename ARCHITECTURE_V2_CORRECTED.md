# FluxaX V2: Privacy-First Architecture with Umbra & Paj Cash

## Executive Summary

FluxaX V2 is a privacy-first crypto ↔ NGN exchange platform that uses NEAR Intent Protocol for universal token routing, USDT on Solana for value preservation, and Umbra for complete on-chain privacy. Users express simple intents, the system handles all complexity internally, and settlements occur through Paj Cash with zero-knowledge privacy guarantees via Umbra's encrypted balances and mixer.

---

## Core Architecture

### Three-Layer Model

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: User Intent (Simple, Natural Language)        │
│  "Deposit ₦50k" / "Sell TON for NGN" / "Swap to USDC"  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: NEAR Intent Protocol (Complete Router)        │
│  - Handles ALL token conversions                         │
│  - Manages swaps, bridges, routing                       │
│  - Returns: Output token at destination                  │
│  - We only call: convert({ from, to })                  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Settlement (Solana + Privacy)                 │
│  - USDT on Solana: Primary asset (stablecoin)           │
│  - Umbra: Encrypted balances + mixer for privacy        │
│  - Paj Cash: NGN ↔ USDT conversion & settlement          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. NEAR Intent Protocol

**Purpose**: Universal token router that handles all conversions

**What It Does:**
- Takes any token on any chain
- Converts to any target token on any chain
- Manages optimal routing internally
- Returns output at destination

**API:**
```typescript
const result = await nearIntent.convert({
  from: {
    token: 'TON',           // Source token
    chain: 'ton',           // Source chain
    amount: 100,            // Amount
    address: userAddress    // User's wallet
  },
  to: {
    token: 'USDT',          // Target token
    chain: 'solana',        // Target chain
    address: userWallet     // User's Solana wallet (for encrypted deposit)
  }
});
// Returns: { outputAmount, txHash, status }
```

---

### 2. USDT on Solana (Primary Asset)

**Why USDT:**
- ✅ Stablecoin: 1 USDT = $1 USD
- ✅ Value preservation: No volatility
- ✅ Predictable rates: NGN/USDT is stable
- ✅ Easy accounting: No price fluctuation
- ✅ Compliance: Easier for regulatory purposes
- ✅ Umbra support: Full support in Umbra SDK

**USDT Mint Address (Solana Mainnet):**
```
Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

---

### 3. Umbra Protocol (Privacy Layer)

**Purpose**: Encrypt token balances and enable anonymous transfers

**Two Privacy Modes:**

#### Mode 1: Encrypted Balances
- Your USDT balance is stored on-chain but encrypted
- Only you (with your X25519 key) can decrypt it
- Amounts are hidden from blockchain observers
- Transfers still happen on-chain, but amounts are encrypted

**Flow:**
```
Public USDT → Umbra Deposit → Encrypted Balance (hidden amount)
Encrypted Balance → Umbra Withdrawal → Public USDT (amount hidden during transfer)
```

#### Mode 2: Mixer (UTXO)
- Deposit USDT into shared pool
- Withdraw to different address with no on-chain link
- Sender and receiver cannot be linked
- Uses zero-knowledge proofs for claiming

**Flow:**
```
Public USDT → Create UTXO (commitment in Merkle tree)
             → Wait (anonymity set grows)
             → Claim to any address (ZK proof, no link)
```

**Privacy Guarantees:**
- ✅ Amount hidden: Encrypted via Arcium MPC
- ✅ Recipient hidden: Stealth address or mixer
- ✅ Sender hidden: Mixer breaks on-chain link
- ✅ Compliance: Viewing grants for auditors

**Fees:**
- Protocol fee: 35 bps (~0.2%)
- Relayer fee: 0 (currently free)
- Mixer SOL fee: ~0.0005 SOL (one-time for UTXO creation)

---

### 4. Paj Cash (NGN ↔ USDT Settlement)

**Purpose**: Convert between NGN and USDT, settle with Nigerian banks

**Handles:**
- ✅ Receives NGN from user's bank account
- ✅ Converts NGN → USDT (stablecoin rate)
- ✅ Sends USDT to user's Solana wallet
- ✅ Receives USDT from user's Solana wallet
- ✅ Converts USDT → NGN (stablecoin rate)
- ✅ Transfers NGN to user's bank account

**API (Assumed):**
```typescript
// Deposit: NGN → USDT
const deposit = await pajCash.convertNGNtoUSDT({
  amount: 50000,              // ₦50,000
  recipientWallet: address,   // User's Solana wallet
  reference: depositId,
  userBankAccount: bankDetails
});

// Withdrawal: USDT → NGN
const withdrawal = await pajCash.convertUSDTtoNGN({
  amount: 50,                 // 50 USDT
  recipientBank: bankAccount, // User's bank
  reference: withdrawalId
});

// Webhook: Deposit confirmed
app.post('/webhook/paj-cash/deposit-confirmed', async (req, res) => {
  const { reference, amount, status } = req.body;
  await updateTransaction({ pajCashReference: reference, status });
  res.json({ success: true });
});

// Webhook: Withdrawal confirmed
app.post('/webhook/paj-cash/withdrawal-confirmed', async (req, res) => {
  const { reference, amount, status } = req.body;
  await updateTransaction({ pajCashReference: reference, status });
  res.json({ success: true });
});
```

---

## Complete User Flows

### Flow 1: Deposit NGN → Get Private USDT

```
Step 1: User Initiates Deposit
  User: "Deposit ₦50,000"
  ↓
Step 2: FluxaX Prepares
  - Get user's Solana wallet address
  - Create deposit request
  ↓
Step 3: User Transfers NGN
  - User transfers ₦50,000 to Paj Cash bank account
  - Bank confirms transfer
  ↓
Step 4: Paj Cash Processes
  - Receives ₦50,000
  - Converts to 50 USDT (stablecoin rate)
  - Sends 50 USDT to user's Solana wallet
  ↓
Step 5: FluxaX Deposits to Umbra
  - Calls Umbra deposit function
  - 50 USDT moves from user's public wallet to encrypted balance
  - Amount is now encrypted on-chain
  ↓
Step 6: On-Chain (Solana, Private)
  - 50 USDT in Encrypted Token Account (ETA)
  - Amount hidden from blockchain observers
  - Only user can decrypt with X25519 key
  ↓
Step 7: Result
  ✓ User has 50 USDT in encrypted balance
  ✓ No one can see the amount on-chain
  ✓ Complete privacy
```

### Flow 2: Withdraw Private USDT → Get NGN

```
Step 1: User Initiates Withdrawal
  User: "Withdraw 50 USDT to bank"
  ↓
Step 2: FluxaX Prepares
  - Get user's bank account
  - Create withdrawal request
  ↓
Step 3: Umbra Withdrawal (Private)
  - Calls Umbra withdrawal function
  - 50 USDT moves from encrypted balance to public wallet
  - Amount is hidden during transfer (MPC decryption)
  - Transaction on-chain but amount encrypted
  ↓
Step 4: On-Chain (Solana, Private)
  - 50 USDT transferred from ETA to public ATA
  - Amount was encrypted during transfer
  - Blockchain sees transaction but not amount
  ↓
Step 5: Paj Cash Processes
  - Receives 50 USDT from user's wallet
  - Converts to ₦50,000 (stablecoin rate)
  - Prepares bank transfer
  ↓
Step 6: Bank Settlement
  - Paj Cash transfers ₦50,000 to user's bank
  - Bank confirms receipt
  ↓
Step 7: Result
  ✓ User has ₦50,000 in bank account
  ✓ No on-chain trace of amount
  ✓ Complete privacy
```

### Flow 3: Sell TON → Get NGN (with Privacy)

```
Step 1: User Initiates Swap
  User: "Sell 100 TON for NGN"
  ↓
Step 2: FluxaX Prepares
  - Get user's Solana wallet
  - Create swap request
  ↓
Step 3: Call NEAR Intent
  nearIntent.convert({
    from: { token: 'TON', chain: 'ton', amount: 100 },
    to: { token: 'USDT', chain: 'solana', address: userWallet }
  })
  ↓
Step 4: NEAR Intent Handles Everything
  - Finds best route (TON → USDT)
  - May involve swaps, bridges, routing
  - Sends 50 USDT to user's Solana wallet
  ↓
Step 5: On-Chain (Multi-Chain)
  - TON chain: 100 TON sent to NEAR Intent
  - Solana: 50 USDT received at user's wallet (public)
  ↓
Step 6: FluxaX Deposits to Umbra (Private)
  - Calls Umbra deposit function
  - 50 USDT moves to encrypted balance
  - Amount is now encrypted on-chain
  ↓
Step 7: Route to Paj Cash (Private)
  - Calls Umbra withdrawal to public wallet
  - 50 USDT transferred (amount hidden during transfer)
  ↓
Step 8: Paj Cash Processes
  - Receives 50 USDT
  - Converts to ₦50,000
  - Transfers to user's bank
  ↓
Step 9: Result
  ✓ User sold 100 TON for ₦50,000
  ✓ Intermediate USDT holdings were encrypted
  ✓ Complete privacy
```

### Flow 4: Swap USDT → USDC (Private, No Off-Ramp)

```
Step 1: User Initiates Swap
  User: "Swap 50 USDT for USDC"
  ↓
Step 2: FluxaX Prepares
  - Get user's Solana wallet
  - Create swap request
  ↓
Step 3: Umbra Withdrawal (Private)
  - Calls Umbra withdrawal function
  - 50 USDT moves from encrypted balance to public wallet
  - Amount hidden during transfer
  ↓
Step 4: Call NEAR Intent
  nearIntent.convert({
    from: { token: 'USDT', chain: 'solana', amount: 50 },
    to: { token: 'USDC', chain: 'solana', address: userWallet }
  })
  ↓
Step 5: NEAR Intent Handles Swap
  - Finds best swap route on Solana
  - Sends 50 USDC to user's wallet
  ↓
Step 6: FluxaX Deposits to Umbra (Private)
  - Calls Umbra deposit function
  - 50 USDC moves to encrypted balance
  - Amount is now encrypted on-chain
  ↓
Step 7: Result
  ✓ User has 50 USDC in encrypted balance
  ✓ No one can see the amount on-chain
  ✓ Complete privacy
```

### Flow 5: Anonymous Transfer via Mixer (Optional)

```
Step 1: User Wants Anonymous Transfer
  User: "Send 50 USDT to friend anonymously"
  ↓
Step 2: FluxaX Prepares
  - Get recipient's Solana wallet
  - Create UTXO request
  ↓
Step 3: Umbra Withdrawal (Private)
  - 50 USDT from encrypted balance to public wallet
  ↓
Step 4: Create Receiver-Claimable UTXO
  - Deposit 50 USDT into mixer
  - Create commitment (amount, recipient, secret)
  - Insert into Merkle tree
  - Pay mixer SOL fee (~0.0005 SOL)
  ↓
Step 5: On-Chain (Solana, Anonymous)
  - Commitment visible in Merkle tree
  - No link between sender and commitment
  - No link between commitment and recipient
  ↓
Step 6: Recipient Claims (Private)
  - Scans Merkle tree for claimable UTXOs
  - Generates ZK proof of ownership
  - Claims to encrypted balance
  - No on-chain link to sender
  ↓
Step 7: Result
  ✓ Recipient has 50 USDT in encrypted balance
  ✓ No on-chain link between sender and recipient
  ✓ Complete anonymity
```

---

## Database Schema

```sql
-- Users (identity mapping)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) UNIQUE NOT NULL,
  name TEXT,
  email VARCHAR(320),
  role ENUM('user', 'admin') DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User Solana wallets
CREATE TABLE user_solana_wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  publicKey VARCHAR(88) NOT NULL,
  encryptedPrivateKey LONGBLOB NOT NULL, -- encrypted
  x25519Key LONGBLOB NOT NULL, -- encrypted (for Umbra)
  umbra_registered BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  UNIQUE(userId),
  INDEX(userId)
);

-- User wallets on other chains (for NEAR Intent)
CREATE TABLE user_wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  chain VARCHAR(50) NOT NULL, -- 'ton', 'base', 'bsc', 'avalanche'
  address VARCHAR(255) NOT NULL,
  balance DECIMAL(20, 8) DEFAULT 0,
  lastBalanceUpdate TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, chain),
  UNIQUE(userId, chain)
);

-- User transactions (what user sees)
CREATE TABLE user_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'withdrawal', 'swap', 'anonymous_transfer') NOT NULL,
  fromToken VARCHAR(50),
  fromAmount DECIMAL(20, 8),
  fromChain VARCHAR(50),
  toToken VARCHAR(50),
  toAmount DECIMAL(20, 8),
  toChain VARCHAR(50),
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  nearIntentId VARCHAR(255), -- NEAR Intent transaction ID (if applicable)
  pajCashReference VARCHAR(255), -- Paj Cash reference (if applicable)
  umbra_encrypted BOOLEAN DEFAULT FALSE, -- Whether this transaction involved Umbra
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, createdAt)
);

-- Umbra encrypted balance tracking
CREATE TABLE umbra_encrypted_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  token VARCHAR(50), -- 'USDT', 'USDC', etc
  encryptedAmount LONGBLOB, -- encrypted balance (for reference)
  lastSyncedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, token),
  UNIQUE(userId, token)
);

-- Umbra UTXO mixer tracking (for anonymous transfers)
CREATE TABLE umbra_utxos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  transactionId INT,
  token VARCHAR(50),
  amount DECIMAL(20, 8),
  commitment VARCHAR(255), -- Merkle tree commitment
  recipient VARCHAR(88), -- recipient's Solana address
  claimed BOOLEAN DEFAULT FALSE,
  claimProof LONGBLOB, -- ZK proof
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (transactionId) REFERENCES user_transactions(id),
  INDEX(userId, createdAt)
);

-- Paj Cash transactions (NGN ↔ USDT settlement)
CREATE TABLE paj_cash_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'withdrawal') NOT NULL,
  direction ENUM('naira_to_usdt', 'usdt_to_naira') NOT NULL,
  nairaAmount DECIMAL(15, 2),
  usdtAmount DECIMAL(20, 8),
  userBankAccount VARCHAR(255), -- for withdrawals
  pajCashReference VARCHAR(255),
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, createdAt)
);
```

---

## API Integration Points

### 1. Umbra SDK Integration

```typescript
import {
  getUmbraClient,
  getUserRegistrationFunction,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction,
  getPublicBalanceToReceiverClaimableUtxoCreatorFunction,
  getClaimableUtxoScannerFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraRelayer,
} from "@umbra-privacy/sdk";
import {
  getCreateReceiverClaimableUtxoFromPublicBalanceProver,
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
} from "@umbra-privacy/web-zk-prover";

// Initialize Umbra client
const umbraClient = await getUmbraClient({
  signer: userSigner,
  network: "mainnet",
  rpcUrl: "https://api.mainnet-beta.solana.com",
  rpcSubscriptionsUrl: "wss://api.mainnet-beta.solana.com",
  indexerApiEndpoint: "https://utxo-indexer.api.umbraprivacy.com",
});

// Register user (one-time)
const register = getUserRegistrationFunction({ umbraClient });
await register({ confidential: true, anonymous: true });

// Deposit to encrypted balance
const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({ umbraClient });
const depositResult = await deposit(
  userAddress,
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT mint
  50_000_000n // 50 USDT (6 decimals)
);

// Withdraw from encrypted balance
const withdraw = getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({ umbraClient });
const withdrawResult = await withdraw(
  userAddress,
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  50_000_000n
);

// Create anonymous UTXO
const utxoProver = getCreateReceiverClaimableUtxoFromPublicBalanceProver();
const createUtxo = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
  { umbraClient },
  { zkProver: utxoProver }
);
const utxoResult = await createUtxo({
  destinationAddress: recipientAddress,
  mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  amount: 50_000_000n,
});

// Fetch claimable UTXOs (as recipient)
const fetchUtxos = getClaimableUtxoScannerFunction({ umbraClient });
const { received } = await fetchUtxos(0, 0);

// Claim UTXO to encrypted balance
const claimProver = getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
const relayer = getUmbraRelayer({
  apiEndpoint: "https://relayer.api.umbraprivacy.com",
});
const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
  { umbraClient },
  { zkProver: claimProver, relayer }
);
const claimResult = await claim(received);
```

### 2. NEAR Intent Integration

```typescript
const result = await nearIntent.convert({
  from: {
    token: 'TON',
    chain: 'ton',
    amount: 100,
    address: userAddress
  },
  to: {
    token: 'USDT',
    chain: 'solana',
    address: userSolanaWallet
  }
});
```

### 3. Paj Cash Integration

```typescript
// Deposit: NGN → USDT
const deposit = await pajCash.convertNGNtoUSDT({
  amount: 50000,
  recipientWallet: userSolanaWallet,
  reference: depositId,
  userBankAccount: bankDetails
});

// Withdrawal: USDT → NGN
const withdrawal = await pajCash.convertUSDTtoNGN({
  amount: 50,
  recipientBank: userBankAccount,
  reference: withdrawalId
});

// Webhooks
app.post('/webhook/paj-cash/deposit-confirmed', async (req, res) => {
  const { reference, amount, status } = req.body;
  await updateTransaction({ pajCashReference: reference, status });
  res.json({ success: true });
});

app.post('/webhook/paj-cash/withdrawal-confirmed', async (req, res) => {
  const { reference, amount, status } = req.body;
  await updateTransaction({ pajCashReference: reference, status });
  res.json({ success: true });
});
```

---

## Privacy Model

### What Each Entity Knows

| Entity | Knows | Doesn't Know |
|--------|-------|--------------|
| **User** | Their intent, balance (decrypted locally), transactions | On-chain details, other users' data |
| **Paj Cash** | Conversion amounts, bank account | On-chain activity, encrypted balances |
| **NEAR Intent** | Token conversions | User identity, final destination |
| **Solana Blockchain** | Encrypted balances exist, transactions occurred | Amounts (encrypted), user identity |
| **Umbra Network** | Encrypted amounts (MPC shared key) | User identity, decryption keys |
| **FluxaX** | User identity, encrypted balance references | Specific on-chain amounts, private keys |

### Privacy Guarantees

✅ **Encrypted Balances**: Amounts hidden via Arcium MPC + X25519 encryption
✅ **Mixer Anonymity**: Sender and receiver cannot be linked
✅ **Identity Privacy**: Blockchain has no link to user identity
✅ **Amount Privacy**: Transaction amounts encrypted on-chain
✅ **Compliance**: Full audit trail maintained server-side, viewing grants for auditors

### Fees

- **Umbra Protocol Fee**: 35 bps (~0.2% of amount)
- **Umbra Relayer Fee**: 0 (currently free)
- **Umbra Mixer SOL Fee**: ~0.0005 SOL per UTXO (one-time)
- **Paj Cash Fees**: TBD (to be confirmed)

---

## Implementation Roadmap

### Phase 1: Database & Infrastructure
- [ ] Update database schema
- [ ] Set up Umbra SDK integration
- [ ] Set up NEAR Intent integration
- [ ] Set up Paj Cash integration
- [ ] Implement Solana wallet generation

### Phase 2: Core Procedures
- [ ] Intent parsing (user input → structured intent)
- [ ] Umbra registration and setup
- [ ] Umbra encrypted balance deposit/withdrawal
- [ ] Umbra UTXO mixer (anonymous transfers)
- [ ] NEAR Intent conversion calls
- [ ] Paj Cash settlement

### Phase 3: User Flows
- [ ] Deposit (NGN → Private USDT)
- [ ] Withdrawal (Private USDT → NGN)
- [ ] Swap (any token to any token via NEAR Intent)
- [ ] Anonymous transfer (via Umbra mixer)
- [ ] Balance polling
- [ ] Transaction history

### Phase 4: UI & UX
- [ ] Intent-based UI (simple inputs)
- [ ] Balance display (decrypted locally)
- [ ] Transaction history
- [ ] Withdrawal form
- [ ] Deposit instructions
- [ ] Anonymous transfer UI

### Phase 5: Admin & Monitoring
- [ ] Admin dashboard
- [ ] Transaction monitoring
- [ ] Privacy audit logging
- [ ] Balance polling
- [ ] Error handling
- [ ] Viewing grants for compliance

### Phase 6: Testing & Deployment
- [ ] Unit tests (all procedures)
- [ ] Integration tests (all flows)
- [ ] Security audit
- [ ] Mainnet deployment
- [ ] User onboarding

---

## Key Differentiators

| Aspect | Traditional | FluxaX V2 |
|--------|-----------|----------|
| **User Experience** | Complex chain/DEX selection | Simple intent ("Sell TON for NGN") |
| **Multi-Chain** | Manual routing | NEAR Intent automatic |
| **Value Preservation** | Volatile (SOL price changes) | Stable (USDT stablecoin) |
| **Privacy** | Public blockchain | Umbra encrypted balances + mixer |
| **Settlement** | Multiple chains | Single Solana hub |
| **Complexity** | High (user-facing) | Low (abstracted) |
| **Compliance** | Limited audit trail | Full server-side audit + viewing grants |

---

## Conclusion

FluxaX V2 represents a paradigm shift in crypto ↔ fiat exchange:

1. **Simplicity**: Users express intents, system handles complexity
2. **Privacy**: Complete on-chain privacy via Umbra encrypted balances and mixer
3. **Stability**: USDT stablecoin preserves value
4. **Flexibility**: Any token to any token via NEAR Intent
5. **Compliance**: Full audit trail for regulatory requirements

The result is a platform that feels effortless to users but is sophisticated in its architecture—combining NEAR Intent for universal routing, Solana for efficient settlement, Umbra for privacy, USDT for value preservation, and Paj Cash for NGN integration.
