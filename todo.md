# FluxaX V2 - Development TODOs & Model Prompts

This document contains detailed prompts for the remaining major tasks in the FluxaX V2 platform. Each section is designed to be fed into an AI coding assistant (like Claude, GPT-4, or Gemini) to allow it to focus deeply on executing that specific task.

---

## Task 1: Multichain Self-Custody & Wallet Adapters
**Status**: 🔴 Not Started
**Context**: FluxaX V2 currently uses an embedded custodial wallet model (where the user's Solana `mainKeypair` is encrypted in Postgres). Because the core of the app is its multichain feature powered by NEAR Intent, we need to allow users to connect their own self-custodial wallets across ALL supported ecosystems (e.g., Solana, EVM, etc.).

> **Prompt for AI Model**:
> "You are tasked with implementing the 'Multichain Self-Custody' feature for FluxaX V2. Currently, the platform relies exclusively on embedded Solana wallets managed by the backend. Since the core feature of the app is multichain routing via NEAR Intent, we need comprehensive wallet adapter support.
> 
> **Objectives:**
> 1. Integrate ecosystem-specific wallet adapters into the frontend (`client/src/`). For Solana, use `@solana/wallet-adapter-react`. For EVM chains, use a standard library like Wagmi/RainbowKit.
> 2. Create a unified 'Connect Wallet' UI component that automatically determines or prompts the user for the correct ecosystem based on the chain they are interacting with.
> 3. **Critical Rule**: Always use specific chain-specific wallet connections (e.g., Phantom/Solflare for Solana, MetaMask/Rabby for EVM) first. Only fallback to 'WalletConnect' (the protocol) if there is no specific native adapter for that chain.
> 4. Update the backend authentication to handle arbitrary chain public keys, linking them to a `userId` in the database.
> 5. Update transaction flows (Deposit, Withdraw, Swap). When using an external wallet on any chain, the backend should construct the transaction payload and return it to the frontend for the user to sign via their native wallet extension, rather than signing it server-side.
> 
> Please start by analyzing `client/src/App.tsx` and the `solana_wallets` schema. Propose an architecture for handling multi-ecosystem wallet connections before writing code."

---

## Task 2: Anonymous Transfer Flow (Umbra UTXO Mixer)
**Status**: ✅ Done / Implemented
**Context**: The UTXO scanning, creation, and claiming of UTXOs using Zero-Knowledge proofs are fully wired up and passing E2E tests.

> **Prompt for AI Model**:
> "You are tasked with completing the 'Anonymous Transfer' (UTXO Mixer) flow for FluxaX V2 using the Umbra protocol.
> 
> **Objectives:**
> 1. **Dependency Resolution**: Resolve the version mismatch between `@umbra-privacy/web-zk-prover` (v2.0.1 requires SDK v2.0.3) and `@umbra-privacy/sdk` (we are using v4.0.0). Either downgrade the SDK, patch the prover, or find a compatible prover version. Update `package.json` and ensure it builds.
> 2. **Backend Logic**: In `server/services/umbra.ts`, implement the logic to create a receiver-claimable UTXO (unshielding from an Encrypted Token Account into a UTXO).
> 3. **Claim Logic**: Implement the ZK-proof claim logic utilizing `getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction` so a receiver can sweep a UTXO into their own encrypted balance.
> 4. **Frontend UI**: Build the `client/src/pages/AnonymousTransfer.tsx` page. It should allow a user to enter a recipient's Solana Public Key, specify an amount, and execute the anonymous transfer.
> 5. Write an integration test for this flow.
> 
> Please begin by examining `package.json` and `server/services/umbra.ts`, and propose how you will resolve the dependency conflict before writing code."

---

## Task 3: Paj Cash Webhook Security & Multi-Token Settlement
**Status**: 🟡 Partially Implemented
**Context**: The Paj Cash webhook handles state transitions but lacks cryptographic signature verification. Additionally, the system hardcodes USDC as the settlement token; we want to support USDT.

> **Prompt for AI Model**:
> "You are tasked with hardening the Paj Cash webhook and enabling multi-token settlement in FluxaX V2.
> 
> **Objectives:**
> 1. **Webhook Security**: Open `server/routes/paj-cash-webhook.ts`. Implement HMAC or cryptographic signature verification on the incoming payload to ensure it actually originated from Paj Cash. You will need to introduce a `PAJ_CASH_WEBHOOK_SECRET` environment variable and validate the signature header.
> 2. **Multi-Token Support**: Currently, `ENV.pajCashUsdcMint` is hardcoded for settlement. Refactor the backend to support an array of accepted mints (USDC and USDT). 
> 3. Update the Paj Cash webhook handler so it trusts the `body.mint` (if provided and whitelisted) instead of falling back to the hardcoded env variable.
> 4. **UI Update**: Update the Deposit and Withdraw frontend components to allow the user to select between USDC and USDT for their settlement asset.
> 
> Please start by reviewing `server/routes/paj-cash-webhook.ts` and `server/services/paj-cash.ts`, then outline the required schema and code changes."

---

## Task 4: Admin Dashboard Sub-pages
**Status**: 🟡 Skeletons Only
**Context**: The backend has foundation tRPC procedures for administration, but the frontend lacks the actual dashboards for monitoring.

> **Prompt for AI Model**:
> "You are tasked with building the frontend Admin sub-pages for FluxaX V2. The top-level `AdminDashboard` exists, but the specific operational views are missing.
> 
> **Objectives:**
> 1. Implement `UserManagement.tsx`: A view to list users, see their linked wallets (embedded vs external), and their total fiat request volumes.
> 2. Implement `TransactionMonitoring.tsx`: A live feed of all `userTransactions` and `fiatRequests`, with filters for status (Pending, Completed, Failed) and type (Deposit, Withdraw, Swap).
> 3. Implement `ComplianceLogging.tsx`: A view to surface high-risk transactions or flagged activities.
> 4. Implement `ViewingGrants.tsx`: A UI allowing admins to request and utilize Umbra viewing keys for specific users if legally required (based on the `server/admin.ts` stubs).
> 
> Please review the existing tRPC routers in `server/routers/admin.ts` to see what data is currently available, and wire these React components up using `@trpc/react-query`."

---

## Task 5: End-to-End Test Suite Completion
**Status**: 🟡 Partially Implemented
**Context**: We have `e2e_swap.spec.ts` working, but we lack E2E tests for the Deposit and Withdrawal flows.

> **Prompt for AI Model**:
> "You are tasked with completing the Playwright End-to-End (E2E) testing suite for FluxaX V2. 
> 
> **Objectives:**
> 1. Review the existing `e2e_swap.spec.ts` to understand the testing patterns and how authentication cookies are injected to bypass the OAuth portal.
> 2. Create `e2e_deposit.spec.ts`: Automate a user navigating to the Deposit page, initiating an NGN deposit, and intercept/mock the Paj Cash webhook to simulate a `COMPLETED` state, verifying that the UI updates and the database records the transaction.
> 3. Create `e2e_withdraw.spec.ts`: Automate a user withdrawing shielded funds to a bank account, verifying the Umbra unshielding step and the Paj Cash off-ramp API calls.
> 4. Ensure all tests can run reliably in GitHub Actions (headless mode).
> 
> Please start by reviewing `e2e_swap.spec.ts` and the `Deposit.tsx` / `Withdraw.tsx` components, and write a plan for the mocks required for these tests."
