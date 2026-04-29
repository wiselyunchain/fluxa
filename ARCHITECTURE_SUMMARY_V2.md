# FluxaX V2: Complete Architecture Summary

## Executive Overview

FluxaX V2 is a privacy-first, intent-driven crypto ↔ NGN exchange platform that abstracts away multi-chain complexity through NEAR Intent Protocol. Users express simple intents ("Sell 100 TON for NGN"), the system routes through NEAR Intent for conversion, and settles through Solana with zero-knowledge privacy via Umbra + Magic Block.

---

## Core Philosophy

**Three-Layer Abstraction:**

1. **User Layer** - Simple intents ("What do I want?")
2. **NEAR Intent Layer** - Complete routing ("How to get there?")
3. **Settlement Layer** - Private Solana flows ("How to keep it private?")

Users never see layers 2 and 3. They only experience layer 1.

---

## Architecture Components

### 1. User Intent Layer

**What Users See:**
- "Sell 100 TON for NGN"
- "Swap 0.5 SOL for USDC"
- "Deposit ₦50,000 to wallet"
- "Withdraw 0.5 SOL to bank"

**No chain selection, no swap routing, no bridge selection.**

---

### 2. NEAR Intent Protocol (Complete Router)

**What NEAR Intent Does:**
- Takes user intent: `{ from: '100 TON', to: 'SOL' }`
- Handles ALL complexity internally:
  - Finds best swap routes
  - Manages cross-chain bridges
  - Executes swaps on optimal DEXs
  - Routes through best liquidity
- Returns: `{ outputAmount: 0.5, outputChain: 'solana', txHash: '...' }`

**What We DON'T Do:**
- ❌ Call LI.FI for swaps
- ❌ Manage bridges
- ❌ Orchestrate multi-step routing
- ❌ Calculate swap paths
- ❌ Handle DEX aggregation

**NEAR Intent is a Black Box:**
```
Input: { token: 'TON', amount: 100, targetChain: 'solana' }
  ↓
[NEAR Intent handles everything internally]
  ↓
Output: { token: 'SOL', amount: 0.5, address: '...' }
```

---

### 3. Settlement Layer (Solana + Privacy)

**Solana as Hub:**
- All conversions resolve to Solana
- Single settlement chain for all users
- Reduces complexity and infrastructure

**Privacy: Umbra + Magic Block**
- **Umbra**: Stealth addresses for receiving funds
  - User receives at ephemeral address, not main wallet
  - Generates ZK proof of ownership
  - Claims funds to main wallet privately
  
- **Magic Block**: Private transaction pools
  - Hides transaction amounts
  - Obscures recipients
  - Encrypts transaction metadata
  - Routes through private mempool

**Flow:**
```
NEAR Intent sends SOL to stealth address (Umbra)
  ↓
User generates ZK proof of ownership (Umbra)
  ↓
Transaction routed through Magic Block (private)
  ↓
SOL appears in user's wallet (no on-chain trace)
```

---

### 4. Payment Settlement (Paj Cash)

**NGN Conversion:**
- Converts SOL ↔ NGN
- Handles bank settlement
- Integrates with Paystack for bank transfers

**Flow:**
```
User wants NGN:
  SOL (Solana) → Paj Cash → NGN → Paystack → Bank Account

User wants SOL:
  Bank Account → Paystack → NGN → Paj Cash → SOL (Solana)
```

---

## Complete User Flows

### Flow 1: Sell TON → Get NGN

```
┌─────────────────────────────────────────────────────────┐
│  User: "Sell 100 TON for NGN"                           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  FluxaX: Parse Intent                                   │
│  from: 100 TON (on TON chain)                           │
│  to: NGN (to bank account)                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Generate Stealth Address (Umbra)                       │
│  - Ephemeral keypair created                            │
│  - Stealth address generated                            │
│  - Stored encrypted in database                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Call NEAR Intent                                       │
│  nearIntent.convert({                                   │
│    from: { token: 'TON', amount: 100 },                │
│    to: { token: 'SOL', address: stealthAddress }       │
│  })                                                     │
│  ↓ NEAR Intent handles all routing internally           │
│  Returns: { outputAmount: 0.5, txHash: '...' }         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  On-Chain: Solana Blockchain                            │
│  ✓ 0.5 SOL sent to stealth address                     │
│  ✓ Amount hidden (encrypted)                            │
│  ✓ Recipient hidden (stealth address)                   │
│  ✓ Sender hidden (NEAR Intent contract)                 │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Claims SOL (ZK Proof)                             │
│  - Generate ZK proof of ownership                       │
│  - Proof: "I own this stealth address"                  │
│  - Private transaction via Magic Block                  │
│  - SOL transferred to main wallet                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Paj Cash Conversion                                    │
│  - 0.5 SOL → ₦50,000 NGN                               │
│  - Prepare bank transfer                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Paystack Settlement                                    │
│  - Transfer ₦50,000 to user's bank                      │
│  - Webhook confirmation received                        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Result                                            │
│  ✓ Sold 100 TON for ₦50,000                            │
│  ✓ Funds in bank account                               │
│  ✓ On-chain: No trace to user identity                 │
│  ✓ Privacy: Complete                                    │
└─────────────────────────────────────────────────────────┘
```

### Flow 2: Swap SOL → USDC (No Off-Ramp)

```
┌─────────────────────────────────────────────────────────┐
│  User: "Swap 0.5 SOL for USDC"                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  FluxaX: Parse Intent                                   │
│  from: 0.5 SOL (on Solana)                              │
│  to: USDC (on Solana)                                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Generate Stealth Address (Umbra)                       │
│  - For receiving USDC                                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Call NEAR Intent                                       │
│  nearIntent.convert({                                   │
│    from: { token: 'SOL', amount: 0.5 },                │
│    to: { token: 'USDC', address: stealthAddress }      │
│  })                                                     │
│  ↓ NEAR Intent handles swap routing                     │
│  Returns: { outputAmount: 50, txHash: '...' }          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  On-Chain: Solana Blockchain (Private)                  │
│  ✓ 50 USDC sent to stealth address                     │
│  ✓ Amount hidden (Magic Block)                          │
│  ✓ Recipient hidden (stealth address)                   │
│  ✓ Sender hidden (private pool)                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Claims USDC (ZK Proof)                            │
│  - Generate ZK proof of ownership                       │
│  - USDC transferred to main wallet                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Result                                            │
│  ✓ Swapped 0.5 SOL for 50 USDC                         │
│  ✓ USDC in wallet                                       │
│  ✓ On-chain: No trace to user identity                 │
│  ✓ Privacy: Complete                                    │
└─────────────────────────────────────────────────────────┘
```

### Flow 3: Deposit NGN → Get SOL

```
┌─────────────────────────────────────────────────────────┐
│  User: "Deposit ₦50,000 to wallet"                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  FluxaX: Create Payment Request                         │
│  - Generate Paystack payment link                       │
│  - Amount: ₦50,000                                      │
│  - Reference: Unique deposit ID                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User: Complete Bank Transfer                           │
│  - Transfers ₦50,000 to Paj Cash                        │
│  - Bank confirms payment                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Paystack Webhook Received                              │
│  - Event: charge.success                                │
│  - Amount: ₦50,000                                      │
│  - Reference: Deposit ID                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Generate Stealth Address (Umbra)                       │
│  - For receiving SOL                                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Paj Cash Conversion                                    │
│  - Receives ₦50,000                                     │
│  - Converts to 0.5 SOL                                  │
│  - Sends to stealth address (private)                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  On-Chain: Solana Blockchain (Private)                  │
│  ✓ 0.5 SOL sent to stealth address                     │
│  ✓ Amount hidden (Magic Block)                          │
│  ✓ Recipient hidden (stealth address)                   │
│  ✓ Sender hidden (private pool)                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Claims SOL (ZK Proof)                             │
│  - Generate ZK proof of ownership                       │
│  - SOL transferred to main wallet                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Result                                            │
│  ✓ Deposited ₦50,000                                   │
│  ✓ Received 0.5 SOL                                    │
│  ✓ On-chain: No trace to user identity                 │
│  ✓ Privacy: Complete                                    │
└─────────────────────────────────────────────────────────┘
```

### Flow 4: Sell Base USDC → Get NGN

```
┌─────────────────────────────────────────────────────────┐
│  User: "Sell 50 USDC for NGN"                           │
│  (User has USDC on Base chain)                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  FluxaX: Parse Intent                                   │
│  from: 50 USDC (on Base)                                │
│  to: NGN (to bank account)                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Generate Stealth Address (Umbra)                       │
│  - For receiving SOL on Solana                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Call NEAR Intent                                       │
│  nearIntent.convert({                                   │
│    from: { token: 'USDC', chain: 'base', amount: 50 }, │
│    to: { token: 'SOL', chain: 'solana',                │
│           address: stealthAddress }                     │
│  })                                                     │
│  ↓ NEAR Intent handles bridge + swap                    │
│  Returns: { outputAmount: 0.5, txHash: '...' }         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  On-Chain: Multi-Chain (Private)                        │
│  ✓ USDC on Base → SOL on Solana                        │
│  ✓ Amount hidden (Magic Block)                          │
│  ✓ Recipient hidden (stealth address)                   │
│  ✓ Sender hidden (private pool)                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Claims SOL (ZK Proof)                             │
│  - Generate ZK proof of ownership                       │
│  - SOL transferred to main wallet                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Paj Cash Conversion                                    │
│  - 0.5 SOL → ₦50,000 NGN                               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Paystack Settlement                                    │
│  - Transfer ₦50,000 to user's bank                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  User Result                                            │
│  ✓ Sold 50 USDC for ₦50,000                            │
│  ✓ Funds in bank account                               │
│  ✓ On-chain: No trace to user identity                 │
│  ✓ Privacy: Complete                                    │
└─────────────────────────────────────────────────────────┘
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

-- User wallets on different chains
CREATE TABLE user_wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  chain VARCHAR(50) NOT NULL, -- 'solana', 'ton', 'base', 'bsc', 'avalanche'
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
  type ENUM('swap', 'deposit', 'withdrawal') NOT NULL,
  fromToken VARCHAR(50),
  fromAmount DECIMAL(20, 8),
  fromChain VARCHAR(50),
  toToken VARCHAR(50),
  toAmount DECIMAL(20, 8),
  toChain VARCHAR(50),
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  nearIntentId VARCHAR(255), -- NEAR Intent transaction ID
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, createdAt)
);

-- Solana stealth addresses (for privacy)
CREATE TABLE solana_stealth_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  stealthAddress VARCHAR(88) NOT NULL,
  ephemeralKeypair LONGBLOB NOT NULL, -- encrypted
  transactionId INT,
  claimed BOOLEAN DEFAULT FALSE,
  claimProof LONGBLOB, -- ZK proof
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (transactionId) REFERENCES user_transactions(id),
  INDEX(userId, createdAt)
);

-- Fiat requests (Paystack/Paj Cash)
CREATE TABLE fiat_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'withdrawal') NOT NULL,
  amount DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'NGN',
  paystackReference VARCHAR(255),
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

### 1. NEAR Intent Protocol
```typescript
// Convert any token to any token
const result = await nearIntent.convert({
  from: {
    token: 'TON',        // Source token
    chain: 'ton',        // Source chain
    amount: 100,         // Amount
    address: userAddress // User's wallet on source chain
  },
  to: {
    token: 'SOL',        // Target token
    chain: 'solana',     // Target chain
    address: stealthAddress // Stealth address for privacy
  }
});

// Returns: { outputAmount, txHash, status }
```

### 2. Umbra Protocol (Stealth Addresses)
```typescript
// Generate stealth address for receiving
const stealthAddress = await umbra.generateStealthAddress(userStealthKey);

// Generate ZK proof for claiming
const claimProof = await umbra.generateClaimProof(
  stealthAddress,
  userClaimKey,
  amount
);

// Claim funds to main wallet
const claimTx = await umbra.claimFunds(claimProof, mainWallet);
```

### 3. Magic Block (Private Transactions)
```typescript
// Route transaction through private pool
const privateTx = await magicBlock.sendPrivate({
  from: senderAddress,
  to: recipientStealthAddress,
  amount: amount,
  token: 'SOL',
  hideAmount: true,
  hideRecipient: true,
  hideSender: true
});
```

### 4. Paj Cash (NGN ↔ SOL)
```typescript
// Convert SOL to NGN
const result = await pajCash.convertSOLtoNGN({
  amount: 0.5,
  recipientBank: userBankAccount,
  reference: transactionId
});

// Convert NGN to SOL
const result = await pajCash.convertNGNtoSOL({
  amount: 50000,
  recipientStealthAddress: stealthAddress,
  reference: depositId
});
```

### 5. Paystack (Bank Settlement)
```typescript
// Initialize payment
const payment = await paystack.initializeTransaction({
  amount: 5000000, // NGN in kobo
  email: userEmail,
  reference: depositId
});

// Verify payment
const verification = await paystack.verifyTransaction(reference);

// Initialize transfer
const transfer = await paystack.initiateTransfer({
  amount: 5000000,
  recipient_code: recipientCode,
  reference: withdrawalId
});
```

---

## Privacy Model

### What Each Entity Knows

| Entity | Knows | Doesn't Know |
|--------|-------|--------------|
| **User** | Their intent, balance | Internal routing, on-chain details |
| **Paystack** | User identity, bank account | On-chain activity, token amounts |
| **Paj Cash** | Conversion amounts | User identity, on-chain details |
| **NEAR Intent** | Token conversions | User identity, final destination |
| **Solana Blockchain** | Nothing | User identity, amounts, recipients |
| **FluxaX** | User identity, encrypted balance | Specific on-chain transactions |

### Privacy Guarantees

✅ **On-Chain Privacy**: All Solana transactions use Umbra stealth addresses + Magic Block encryption
✅ **Identity Privacy**: Blockchain has no link to user identity
✅ **Amount Privacy**: Transaction amounts hidden via Magic Block
✅ **Recipient Privacy**: Recipients obscured via stealth addresses
✅ **Compliance**: Full audit trail maintained server-side

---

## Key Differentiators

| Aspect | Traditional | FluxaX V2 |
|--------|-----------|----------|
| **User Experience** | "Select chain, select DEX, manage swaps" | "Sell TON for NGN" |
| **Multi-Chain** | Manual routing | NEAR Intent automatic |
| **Privacy** | Public blockchain | Umbra + Magic Block |
| **Settlement** | Multiple chains | Single Solana hub |
| **Complexity** | High (user-facing) | Low (abstracted) |
| **Compliance** | Limited audit trail | Full server-side audit |

---

## Implementation Priorities

### Phase 1: Core Infrastructure
- [ ] NEAR Intent integration
- [ ] Umbra stealth address generation
- [ ] Magic Block private transaction routing
- [ ] Database schema setup

### Phase 2: User Flows
- [ ] Intent parsing (user input → structured intent)
- [ ] NEAR Intent conversion calls
- [ ] Stealth address claiming (ZK proofs)
- [ ] Transaction recording

### Phase 3: Settlement
- [ ] Paj Cash integration (SOL ↔ NGN)
- [ ] Paystack webhook handlers
- [ ] Bank settlement flows
- [ ] Fiat request management

### Phase 4: Admin & Monitoring
- [ ] Admin dashboard
- [ ] Transaction monitoring
- [ ] Privacy audit logging
- [ ] Balance polling

### Phase 5: Production
- [ ] Security audit
- [ ] Load testing
- [ ] Mainnet deployment
- [ ] User onboarding

---

## Conclusion

FluxaX V2 delivers a revolutionary user experience by:

1. **Simplifying Intent** - Users express what they want, not how to get it
2. **Abstracting Complexity** - NEAR Intent handles all routing internally
3. **Ensuring Privacy** - Umbra + Magic Block provide complete on-chain privacy
4. **Enabling Flexibility** - Users can swap any token on any chain
5. **Maintaining Compliance** - Full audit trail for regulatory requirements

The result is a platform that feels simple to users but is sophisticated in its internal architecture—combining NEAR Intent Protocol for universal routing, Solana for efficient settlement, Umbra for privacy, Magic Block for transaction hiding, and Paj Cash for NGN integration.
