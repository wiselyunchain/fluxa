# FluxaX V2 Architecture: Privacy-First On-Chain Design

## Executive Summary

FluxaX V2 simplifies the multi-chain complexity by resolving all user intents to Solana as the primary settlement layer, while maintaining complete on-chain privacy through zero-knowledge proofs (Umbra) and private transaction pools (Magic Block). Users experience a seamless, private crypto ↔ NGN exchange without exposing their transaction history or wallet identity on-chain.

---

## Core Architecture

### Simplified Stack
```
User Interface (React)
    ↓
Intent Layer (What user wants to do)
    ↓
Solana Settlement Layer (Single canonical chain)
    ↓
Privacy Layer (Umbra + Magic Block)
    ↓
Payment Provider (Paj Cash for NGN conversion)
```

### Key Components

| Component | Purpose | Technology |
|-----------|---------|-----------|
| **Intent Parser** | Understands user actions | NEAR Intent Protocol |
| **Solana Wallet** | Single wallet per user | @solana/web3.js |
| **Umbra Protocol** | Stealth addresses & ZK proofs | Umbra SDK |
| **Magic Block** | Private transaction pools | Magic Block SDK |
| **Paj Cash** | NGN ↔ SOL conversion | Paj Cash API |
| **Paystack** | Bank settlement | Paystack API |

---

## User Flows

### 1. USER ONBOARDING

```
┌─────────────────────────────────────────────────────────┐
│                    User Registration                     │
└─────────────────────────────────────────────────────────┘
                           ↓
                  Manus OAuth Login
                           ↓
        ┌──────────────────────────────────────┐
        │  Generate Solana Keypair             │
        │  - Main wallet address (private)     │
        │  - Stealth key for receiving (ZK)    │
        │  - Claim key for proving ownership   │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Store Encrypted in Database         │
        │  - Main keypair (encrypted)          │
        │  - Stealth keys (encrypted)          │
        │  - Claim proofs (encrypted)          │
        │  - User identity (encrypted)         │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  User Dashboard Ready                │
        │  - Balance: $0.00 (no transactions)  │
        │  - Privacy: ✓ Enabled                │
        │  - Account Status: Active            │
        └──────────────────────────────────────┘
```

---

### 2. ON-RAMP FLOW (NGN → SOL with Privacy)

```
┌─────────────────────────────────────────────────────────┐
│                  User Initiates Deposit                  │
│              "I want to add ₦50,000 to my wallet"        │
└─────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Intent Parser                       │
        │  Input: ₦50,000 NGN                  │
        │  Action: Deposit                     │
        │  Output: Need ~0.5 SOL               │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Generate Stealth Address            │
        │  - Create ephemeral keypair          │
        │  - Generate stealth address (Umbra)  │
        │  - Store mapping (encrypted)         │
        │  - User doesn't see this address     │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Payment Initialization              │
        │  - Create Paystack payment request   │
        │  - Amount: ₦50,000                   │
        │  - Reference: Unique deposit ID      │
        │  - Webhook: Listen for confirmation  │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  User Completes Bank Transfer       │
        │  - Transfers ₦50,000 to Paj Cash    │
        │  - Transaction confirmed by bank    │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Paystack Webhook Received           │
        │  Event: charge.success               │
        │  Amount: ₦50,000                     │
        │  Reference: Deposit ID               │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Paj Cash Conversion                 │
        │  - Receives ₦50,000                  │
        │  - Converts to ~0.5 SOL              │
        │  - Prepares transaction              │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Private Transaction (Magic Block)   │
        │  - Route through private pool        │
        │  - Amount hidden: 0.5 SOL            │
        │  - Recipient hidden: stealth addr    │
        │  - Sender hidden: Paj Cash contract  │
        │  - Send to stealth address           │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  On-Chain: Solana Blockchain         │
        │  ✓ Transaction confirmed             │
        │  ✓ Amount: Hidden (encrypted)        │
        │  ✓ Recipient: Hidden (stealth addr)  │
        │  ✓ Sender: Hidden (private pool)     │
        │  ✓ No link to user identity          │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  User Claims Funds (ZK Proof)        │
        │  - Generate ZK proof of ownership    │
        │  - Proof: "I own this stealth addr"  │
        │  - No private key exposed            │
        │  - Claim transaction (Magic Block)   │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Funds Appear in User Wallet         │
        │  - Balance updated: +0.5 SOL         │
        │  - User sees: ₦50,000 → 0.5 SOL     │
        │  - On-chain: No trace to user        │
        │  - Privacy: ✓ Complete               │
        └──────────────────────────────────────┘
```

**Privacy Guarantees:**
- ✅ Paystack knows: User identity + bank account
- ✅ Paj Cash knows: Amount converted (not user identity)
- ✅ Solana blockchain knows: Nothing about user
- ✅ FluxaX knows: User identity + balance (encrypted)
- ✅ No link between user and on-chain activity

---

### 3. OFF-RAMP FLOW (SOL → NGN with Privacy)

```
┌─────────────────────────────────────────────────────────┐
│                  User Initiates Withdrawal               │
│              "I want to withdraw 0.5 SOL to my bank"     │
└─────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Intent Parser                       │
        │  Input: 0.5 SOL                      │
        │  Action: Withdraw                    │
        │  Output: ~₦50,000 NGN                │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Verify User Balance                 │
        │  - Check encrypted balance           │
        │  - Confirm: 0.5 SOL available        │
        │  - Deduct from balance (local)       │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Generate Stealth Address (Paj Cash) │
        │  - Create ephemeral keypair          │
        │  - Generate stealth address for Paj  │
        │  - Store mapping (encrypted)         │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Private Transaction (Magic Block)   │
        │  - Route through private pool        │
        │  - Amount hidden: 0.5 SOL            │
        │  - Recipient hidden: stealth addr    │
        │  - Sender hidden: user's main addr   │
        │  - Send to Paj Cash stealth addr     │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  On-Chain: Solana Blockchain         │
        │  ✓ Transaction confirmed             │
        │  ✓ Amount: Hidden (encrypted)        │
        │  ✓ Recipient: Hidden (stealth addr)  │
        │  ✓ Sender: Hidden (private pool)     │
        │  ✓ No link to user identity          │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Paj Cash Claims Funds (ZK Proof)    │
        │  - Generate ZK proof of ownership    │
        │  - Claim transaction (Magic Block)   │
        │  - Receives 0.5 SOL                  │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Paj Cash Conversion                 │
        │  - Receives 0.5 SOL                  │
        │  - Converts to ~₦50,000 NGN          │
        │  - Prepares bank transfer            │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Bank Settlement (Paystack)          │
        │  - Sends ₦50,000 to user's bank      │
        │  - Reference: Withdrawal ID          │
        │  - Webhook: Confirm completion       │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Paystack Webhook Received           │
        │  Event: transfer.success             │
        │  Amount: ₦50,000                     │
        │  Reference: Withdrawal ID            │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  User Receives NGN                   │
        │  - Bank notification received        │
        │  - Amount: ₦50,000                   │
        │  - Balance updated: -0.5 SOL         │
        │  - Privacy: ✓ Complete               │
        └──────────────────────────────────────┘
```

**Privacy Guarantees:**
- ✅ Paystack knows: User identity + bank account
- ✅ Paj Cash knows: Amount converted (not user identity)
- ✅ Solana blockchain knows: Nothing about user
- ✅ FluxaX knows: User identity + balance (encrypted)
- ✅ No link between user and on-chain activity

---

### 4. SWAP FLOW (SOL → Token with Privacy)

```
┌─────────────────────────────────────────────────────────┐
│                  User Initiates Swap                     │
│              "I want to swap 0.5 SOL for USDC"           │
└─────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Intent Parser                       │
        │  Input: 0.5 SOL                      │
        │  Action: Swap to USDC                │
        │  Output: Get quote (~$50)            │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Get Swap Quote (LI.FI)              │
        │  - From: 0.5 SOL                     │
        │  - To: USDC                          │
        │  - Quote: ~$50 USDC                  │
        │  - Fee: ~$0.50                       │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  User Confirms Swap                  │
        │  - Review quote                      │
        │  - Approve transaction               │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Generate Stealth Address (USDC)     │
        │  - Create ephemeral keypair          │
        │  - Generate stealth address (Umbra)  │
        │  - Store mapping (encrypted)         │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Private Swap Transaction            │
        │  - Route through Magic Block         │
        │  - Amount hidden: 0.5 SOL            │
        │  - Recipient hidden: stealth addr    │
        │  - Sender hidden: private pool       │
        │  - Execute swap via LI.FI            │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  On-Chain: Solana Blockchain         │
        │  ✓ Swap confirmed                    │
        │  ✓ Amount: Hidden (encrypted)        │
        │  ✓ Recipient: Hidden (stealth addr)  │
        │  ✓ Sender: Hidden (private pool)     │
        │  ✓ No link to user identity          │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  User Claims USDC (ZK Proof)         │
        │  - Generate ZK proof of ownership    │
        │  - Claim transaction (Magic Block)   │
        │  - Receive ~$50 USDC                 │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Swap Complete                       │
        │  - Balance: -0.5 SOL, +$50 USDC      │
        │  - User sees: Swap successful        │
        │  - On-chain: No trace to user        │
        │  - Privacy: ✓ Complete               │
        └──────────────────────────────────────┘
```

**Privacy Guarantees:**
- ✅ LI.FI knows: Swap amounts (not user identity)
- ✅ Solana blockchain knows: Nothing about user
- ✅ FluxaX knows: User identity + balance (encrypted)
- ✅ No link between user and on-chain activity

---

## Database Schema (V2)

```sql
-- Users table (identity mapping - encrypted)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) UNIQUE NOT NULL,
  name TEXT,
  email VARCHAR(320),
  role ENUM('user', 'admin') DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Solana wallets (single per user - encrypted)
CREATE TABLE solana_wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  mainAddress VARCHAR(88) NOT NULL,
  mainKeypair LONGBLOB NOT NULL, -- encrypted
  stealthKey LONGBLOB NOT NULL, -- encrypted
  claimKey LONGBLOB NOT NULL, -- encrypted
  balance DECIMAL(20, 8) DEFAULT 0,
  lastBalanceUpdate TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  UNIQUE(userId)
);

-- Stealth addresses (ephemeral - encrypted mapping)
CREATE TABLE stealth_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  stealthAddress VARCHAR(88) NOT NULL,
  ephemeralKeypair LONGBLOB NOT NULL, -- encrypted
  transactionType ENUM('deposit', 'withdrawal', 'swap') NOT NULL,
  amount DECIMAL(20, 8),
  token VARCHAR(50), -- SOL, USDC, etc
  claimed BOOLEAN DEFAULT FALSE,
  claimProof LONGBLOB, -- ZK proof
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX(userId, createdAt)
);

-- Transactions (user view - encrypted)
CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'withdrawal', 'swap') NOT NULL,
  fromAmount DECIMAL(20, 8),
  fromToken VARCHAR(50),
  toAmount DECIMAL(20, 8),
  toToken VARCHAR(50),
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  transactionHash VARCHAR(88), -- on-chain hash (if applicable)
  stealthAddressId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (stealthAddressId) REFERENCES stealth_addresses(id),
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

-- Balance history (for polling records)
CREATE TABLE balance_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  walletId INT NOT NULL,
  balance DECIMAL(20, 8),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (walletId) REFERENCES solana_wallets(id),
  INDEX(walletId, timestamp)
);
```

---

## API Integrations

### 1. Umbra Protocol (Stealth Addresses)
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

### 2. Magic Block (Private Transactions)
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

// Transaction confirmed on-chain with privacy
const txHash = await privateTx.confirm();
```

### 3. Paj Cash (NGN ↔ SOL Conversion)
```typescript
// On-ramp: NGN to SOL
const onRamp = await pajCash.convertNGNtoSOL({
  amount: 50000, // NGN
  recipientStealthAddress: stealthAddress,
  reference: depositId
});

// Off-ramp: SOL to NGN
const offRamp = await pajCash.convertSOLtoNGN({
  amount: 0.5, // SOL
  recipientBankAccount: userBankAccount,
  reference: withdrawalId
});
```

### 4. Paystack (Bank Settlement)
```typescript
// Initialize payment
const payment = await paystack.initializeTransaction({
  amount: 5000000, // NGN in kobo
  email: userEmail,
  reference: depositId,
  metadata: { type: 'crypto_deposit' }
});

// Verify payment
const verification = await paystack.verifyTransaction(reference);

// Initialize transfer
const transfer = await paystack.initiateTransfer({
  amount: 5000000, // NGN in kobo
  recipient_code: recipientCode,
  reason: 'Crypto withdrawal',
  reference: withdrawalId
});
```

---

## Security Considerations

### 1. Key Management
- All private keys stored encrypted in database
- Encryption key derived from user password + server secret
- Keys never exposed to frontend
- Stealth keys isolated from main wallet keys

### 2. ZK Proof Verification
- Proofs verified on-chain before claiming
- Proof generation happens server-side (not exposed)
- Claim transactions routed through Magic Block for privacy

### 3. Transaction Privacy
- All amounts hidden via Magic Block encryption
- Recipients obscured via stealth addresses
- Senders hidden via private transaction pools
- No metadata leakage

### 4. Database Encryption
- All sensitive data encrypted at rest
- Encryption keys rotated regularly
- Access logs maintained for audit
- Database backups encrypted

---

## User Experience Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User Dashboard                        │
│                                                          │
│  Welcome, [User Name]                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Total Balance: 0.5 SOL ($50)                     │   │
│  │ Privacy Status: ✓ Enabled                        │   │
│  │ Account Status: Active                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Quick Actions:                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Deposit    │  │  Withdraw    │  │    Swap      │  │
│  │  (NGN→SOL)   │  │  (SOL→NGN)   │  │  (SOL→Token) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Recent Transactions:                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Deposit: ₦50,000 → 0.5 SOL (Confirmed)          │   │
│  │ Swap: 0.5 SOL → $50 USDC (Confirmed)            │   │
│  │ Withdrawal: 0.5 SOL → ₦50,000 (Pending)         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Settings:                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Privacy: ✓ Enabled (All transactions private)    │   │
│  │ Notifications: ✓ Enabled                         │   │
│  │ Security: ✓ 2FA Enabled                          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Core Infrastructure
- [ ] Umbra integration (stealth addresses + ZK proofs)
- [ ] Magic Block integration (private transactions)
- [ ] Solana wallet generation (single per user)
- [ ] Database schema migration

### Phase 2: User Flows
- [ ] On-ramp flow (NGN → SOL via Paj Cash)
- [ ] Off-ramp flow (SOL → NGN via Paj Cash)
- [ ] Swap flow (SOL → Token via LI.FI)
- [ ] Balance claiming (ZK proofs)

### Phase 3: Privacy Features
- [ ] Transaction privacy verification
- [ ] Stealth address management
- [ ] ZK proof generation/verification
- [ ] Private transaction routing

### Phase 4: Admin & Monitoring
- [ ] Admin dashboard for privacy audit
- [ ] Transaction monitoring (on-chain privacy verification)
- [ ] Balance polling (encrypted)
- [ ] Compliance logging (audit trail)

### Phase 5: Production
- [ ] Security audit
- [ ] Load testing
- [ ] Mainnet deployment
- [ ] User onboarding

---

## Comparison: V1 vs V2

| Aspect | V1 (Multi-Chain) | V2 (Privacy-First) |
|--------|------------------|-------------------|
| **Wallets** | 5 per user | 1 per user |
| **Settlement Layer** | Multi-chain | Solana only |
| **On-Chain Privacy** | None | Complete (Umbra + Magic Block) |
| **User Complexity** | High (chain selection) | Low (single intent) |
| **RPC Overhead** | High (5 chains) | Low (1 chain) |
| **Transaction Cost** | Variable | Low (Solana) |
| **Privacy Guarantee** | Blockchain visible | Hidden (ZK proofs) |
| **Compliance** | Basic | Enhanced (audit trail) |

---

## Conclusion

FluxaX V2 delivers a simplified, privacy-first platform that:
- ✅ Reduces user complexity (single Solana wallet)
- ✅ Provides complete on-chain privacy (Umbra + Magic Block)
- ✅ Maintains compliance (audit trail + identity mapping)
- ✅ Lowers infrastructure costs (single chain)
- ✅ Improves user experience (seamless flows)

The architecture leverages NEAR Intent Protocol for user intent abstraction, Solana for settlement, Umbra for privacy, Magic Block for transaction hiding, and Paj Cash for NGN conversion—creating a cohesive, privacy-preserving platform optimized for Nigerian users.
