# FluxaX V2: Privacy-First Architecture with USDT Settlement

## Executive Summary

FluxaX V2 is a revolutionary privacy-first crypto ↔ NGN exchange platform that uses NEAR Intent Protocol for universal token routing, USDT on Solana for value preservation, and Umbra + Magic Block for complete on-chain privacy. Users express simple intents, the system handles all complexity internally, and settlements occur through Paj Cash with zero-knowledge privacy guarantees.

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
│  - Umbra: Stealth addresses for privacy                 │
│  - Magic Block: Private transaction pools               │
│  - Paj Cash: NGN ↔ USDT conversion                      │
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
    address: stealthAddress // Stealth address for privacy
  }
});
// Returns: { outputAmount, txHash, status }
```

**What We DON'T Do:**
- ❌ Manage swaps ourselves
- ❌ Call DEX aggregators (LI.FI, 0x)
- ❌ Handle bridges
- ❌ Calculate routes

---

### 2. USDT on Solana (Primary Asset)

**Why USDT:**
- ✅ Stablecoin: 1 USDT = $1 USD
- ✅ Value preservation: No volatility
- ✅ Predictable rates: NGN/USDT is stable
- ✅ Easy accounting: No price fluctuation
- ✅ Compliance: Easier for regulatory purposes

**Flow:**
```
All user balances stored as USDT on Solana
All settlements convert to/from USDT
All swaps use USDT as intermediate (if needed)
```

---

### 3. Umbra Protocol (Stealth Addresses)

**Purpose**: Receive funds privately without revealing main wallet

**How It Works:**
1. Generate ephemeral keypair for each transaction
2. Create stealth address from ephemeral key
3. Receive funds at stealth address (no link to user)
4. Generate ZK proof of ownership
5. Claim funds to main wallet privately

**Flow:**
```
User's Main Wallet: 0x1234... (public)
  ↓
Generate Stealth Address: 0xabcd... (ephemeral, private)
  ↓
Receive USDT at stealth address (no on-chain link to user)
  ↓
Generate ZK Proof: "I own this stealth address"
  ↓
Claim USDT to main wallet (private transaction)
  ↓
Main Wallet: 0x1234... (USDT received, no trace)
```

**Privacy Guarantee:**
- Blockchain sees: USDT at stealth address
- Blockchain doesn't see: Who owns stealth address
- Only user knows: They own the stealth address (via ZK proof)

---

### 4. Magic Block (Private Transactions)

**Purpose**: Hide transaction amounts, recipients, and senders

**How It Works:**
1. Route transaction through private mempool
2. Encrypt transaction metadata
3. Hide amounts via encryption
4. Obscure recipients via stealth addresses
5. Batch transactions to prevent pattern analysis

**Flow:**
```
User wants to send USDT privately
  ↓
Route through Magic Block private pool
  ↓
Amount encrypted: 50 USDT → [encrypted]
  ↓
Recipient hidden: User address → Stealth address
  ↓
Sender hidden: Private pool contract
  ↓
Batched with other transactions
  ↓
On-chain: Only encrypted data visible
```

**Privacy Guarantee:**
- Blockchain sees: Encrypted transaction
- Blockchain doesn't see: Amount, sender, recipient
- Only recipient can decrypt: Via ZK proof

---

### 5. Paj Cash (NGN ↔ USDT Settlement)

**Purpose**: Convert between NGN and USDT, settle with banks

**Handles:**
- ✅ Receives NGN from user's bank account
- ✅ Converts NGN → USDT (stablecoin rate)
- ✅ Sends USDT to Solana stealth address (private)
- ✅ Receives USDT from user's wallet (private)
- ✅ Converts USDT → NGN (stablecoin rate)
- ✅ Transfers NGN to user's bank account

**API:**
```typescript
// Deposit: NGN → USDT
const deposit = await pajCash.convertNGNtoUSDT({
  amount: 50000,                    // ₦50,000
  recipientStealthAddress: address, // Solana stealth address
  reference: depositId
});

// Withdrawal: USDT → NGN
const withdrawal = await pajCash.convertUSDTtoNGN({
  amount: 50,                 // 50 USDT
  recipientBank: bankAccount, // User's bank
  reference: withdrawalId
});
```

---

## Complete User Flows

### Flow 1: Deposit NGN → Get USDT

```
Step 1: User Initiates Deposit
  User: "Deposit ₦50,000"
  ↓
Step 2: FluxaX Prepares
  - Generate stealth address (Umbra)
  - Create deposit request
  ↓
Step 3: User Transfers NGN
  - User transfers ₦50,000 to Paj Cash bank account
  - Bank confirms transfer
  ↓
Step 4: Paj Cash Processes
  - Receives ₦50,000
  - Converts to 50 USDT (stablecoin rate)
  - Sends 50 USDT to stealth address (private, Magic Block)
  ↓
Step 5: On-Chain (Solana, Private)
  - 50 USDT sent to stealth address
  - Amount hidden (Magic Block encryption)
  - Recipient hidden (stealth address)
  - Sender hidden (Paj Cash contract)
  ↓
Step 6: User Claims USDT
  - Generate ZK proof of ownership
  - Private transaction via Magic Block
  - USDT transferred to main wallet
  ↓
Step 7: Result
  ✓ User has 50 USDT in wallet
  ✓ No on-chain trace to user identity
  ✓ Complete privacy
```

### Flow 2: Withdraw USDT → Get NGN

```
Step 1: User Initiates Withdrawal
  User: "Withdraw 50 USDT to bank"
  ↓
Step 2: FluxaX Prepares
  - Get user's bank account
  - Create withdrawal request
  ↓
Step 3: Route Transaction (Private)
  - Route 50 USDT through Magic Block
  - Send to Paj Cash stealth address (private)
  - Amount hidden, recipient hidden, sender hidden
  ↓
Step 4: On-Chain (Solana, Private)
  - 50 USDT sent via private pool
  - Encrypted transaction
  - No visible amounts or recipients
  ↓
Step 5: Paj Cash Processes
  - Receives 50 USDT
  - Converts to ₦50,000 (stablecoin rate)
  - Prepares bank transfer
  ↓
Step 6: Bank Settlement
  - Paj Cash transfers ₦50,000 to user's bank
  - Bank confirms receipt
  ↓
Step 7: Result
  ✓ User has ₦50,000 in bank account
  ✓ No on-chain trace to user identity
  ✓ Complete privacy
```

### Flow 3: Sell TON → Get NGN

```
Step 1: User Initiates Swap
  User: "Sell 100 TON for NGN"
  ↓
Step 2: FluxaX Prepares
  - Generate stealth address (Solana)
  - Create swap request
  ↓
Step 3: Call NEAR Intent
  nearIntent.convert({
    from: { token: 'TON', chain: 'ton', amount: 100 },
    to: { token: 'USDT', chain: 'solana', address: stealthAddress }
  })
  ↓
Step 4: NEAR Intent Handles Everything
  - Finds best route (TON → USDT)
  - May involve swaps, bridges, routing
  - Sends 50 USDT to stealth address (private, Magic Block)
  ↓
Step 5: On-Chain (Multi-Chain, Private)
  - TON chain: 100 TON sent to NEAR Intent
  - Solana: 50 USDT received at stealth address (private)
  ↓
Step 6: User Claims USDT
  - Generate ZK proof of ownership
  - Private transaction via Magic Block
  - USDT transferred to main wallet
  ↓
Step 7: Route to Paj Cash
  - Route 50 USDT through Magic Block (private)
  - Send to Paj Cash stealth address
  ↓
Step 8: Paj Cash Processes
  - Receives 50 USDT
  - Converts to ₦50,000
  - Transfers to user's bank
  ↓
Step 9: Result
  ✓ User sold 100 TON for ₦50,000
  ✓ No on-chain trace to user identity
  ✓ Complete privacy
```

### Flow 4: Swap USDT → USDC (No Off-Ramp)

```
Step 1: User Initiates Swap
  User: "Swap 50 USDT for USDC"
  ↓
Step 2: FluxaX Prepares
  - Generate stealth address (Solana)
  - Create swap request
  ↓
Step 3: Call NEAR Intent
  nearIntent.convert({
    from: { token: 'USDT', chain: 'solana', amount: 50 },
    to: { token: 'USDC', chain: 'solana', address: stealthAddress }
  })
  ↓
Step 4: NEAR Intent Handles Swap
  - Finds best swap route on Solana
  - Sends 50 USDC to stealth address (private, Magic Block)
  ↓
Step 5: On-Chain (Solana, Private)
  - 50 USDC sent to stealth address
  - Amount hidden (Magic Block encryption)
  - Recipient hidden (stealth address)
  ↓
Step 6: User Claims USDC
  - Generate ZK proof of ownership
  - Private transaction via Magic Block
  - USDC transferred to main wallet
  ↓
Step 7: Result
  ✓ User has 50 USDC in wallet
  ✓ No on-chain trace to user identity
  ✓ Complete privacy
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
  token VARCHAR(50), -- 'USDT', 'TON', 'USDC', etc
  address VARCHAR(255) NOT NULL,
  balance DECIMAL(20, 8) DEFAULT 0,
  lastBalanceUpdate TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, chain, token),
  UNIQUE(userId, chain, token)
);

-- User transactions (what user sees)
CREATE TABLE user_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'withdrawal', 'swap') NOT NULL,
  fromToken VARCHAR(50),
  fromAmount DECIMAL(20, 8),
  fromChain VARCHAR(50),
  toToken VARCHAR(50),
  toAmount DECIMAL(20, 8),
  toChain VARCHAR(50),
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  nearIntentId VARCHAR(255), -- NEAR Intent transaction ID (if applicable)
  pajCashReference VARCHAR(255), -- Paj Cash reference (if applicable)
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

-- Paj Cash transactions (NGN ↔ USDT settlement)
CREATE TABLE paj_cash_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'withdrawal') NOT NULL,
  direction ENUM('naira_to_usdt', 'usdt_to_naira') NOT NULL,
  nairaAmount DECIMAL(15, 2),
  usdtAmount DECIMAL(20, 8), -- USDT on Solana
  userBankAccount VARCHAR(255), -- for withdrawals
  pajCashReference VARCHAR(255),
  stealthAddress VARCHAR(88), -- for deposits (Solana)
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
    token: 'TON',
    chain: 'ton',
    amount: 100,
    address: userAddress
  },
  to: {
    token: 'USDT',
    chain: 'solana',
    address: stealthAddress
  }
});
// Returns: { outputAmount, txHash, status }
```

### 2. Umbra Protocol (Stealth Addresses)
```typescript
// Generate stealth address
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
  token: 'USDT',
  hideAmount: true,
  hideRecipient: true,
  hideSender: true
});
```

### 4. Paj Cash (NGN ↔ USDT)
```typescript
// Deposit: NGN → USDT
const deposit = await pajCash.convertNGNtoUSDT({
  amount: 50000,
  recipientStealthAddress: stealthAddress,
  reference: depositId
});

// Withdrawal: USDT → NGN
const withdrawal = await pajCash.convertUSDTtoNGN({
  amount: 50,
  recipientBank: userBankAccount,
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

## Privacy Model

### What Each Entity Knows

| Entity | Knows | Doesn't Know |
|--------|-------|--------------|
| **User** | Their intent, balance, transactions | Internal routing, on-chain details |
| **Paj Cash** | Conversion amounts, bank account | On-chain activity, user identity |
| **NEAR Intent** | Token conversions | User identity, final destination |
| **Solana Blockchain** | Nothing | User identity, amounts, recipients |
| **FluxaX** | User identity, encrypted balance | Specific on-chain transactions |

### Privacy Guarantees

✅ **On-Chain Privacy**: All Solana transactions use Umbra stealth addresses + Magic Block encryption
✅ **Identity Privacy**: Blockchain has no link to user identity
✅ **Amount Privacy**: Transaction amounts hidden via Magic Block
✅ **Recipient Privacy**: Recipients obscured via stealth addresses
✅ **Sender Privacy**: Senders hidden via private pools
✅ **Compliance**: Full audit trail maintained server-side

---

## Implementation Roadmap

### Phase 1: Database & Infrastructure
- [ ] Update database schema (remove Paystack, add Paj Cash)
- [ ] Set up NEAR Intent integration
- [ ] Set up Umbra integration
- [ ] Set up Magic Block integration
- [ ] Set up Paj Cash integration

### Phase 2: Core Procedures
- [ ] Intent parsing (user input → structured intent)
- [ ] NEAR Intent conversion calls
- [ ] Stealth address generation and claiming
- [ ] Private transaction routing
- [ ] Paj Cash settlement

### Phase 3: User Flows
- [ ] Deposit (NGN → USDT)
- [ ] Withdrawal (USDT → NGN)
- [ ] Swap (any token to any token)
- [ ] Balance polling
- [ ] Transaction history

### Phase 4: UI & UX
- [ ] Intent-based UI (simple inputs)
- [ ] Balance display
- [ ] Transaction history
- [ ] Withdrawal form
- [ ] Deposit instructions

### Phase 5: Admin & Monitoring
- [ ] Admin dashboard
- [ ] Transaction monitoring
- [ ] Privacy audit logging
- [ ] Balance polling
- [ ] Error handling

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
| **Privacy** | Public blockchain | Umbra + Magic Block |
| **Settlement** | Multiple chains | Single Solana hub |
| **Complexity** | High (user-facing) | Low (abstracted) |
| **Compliance** | Limited audit trail | Full server-side audit |

---

## Conclusion

FluxaX V2 represents a paradigm shift in crypto ↔ fiat exchange:

1. **Simplicity**: Users express intents, system handles complexity
2. **Privacy**: Complete on-chain privacy via Umbra + Magic Block
3. **Stability**: USDT stablecoin preserves value
4. **Flexibility**: Any token to any token via NEAR Intent
5. **Compliance**: Full audit trail for regulatory requirements

The result is a platform that feels effortless to users but is sophisticated in its architecture—combining NEAR Intent for universal routing, Solana for efficient settlement, Umbra for privacy, Magic Block for transaction hiding, USDT for value preservation, and Paj Cash for NGN integration.
