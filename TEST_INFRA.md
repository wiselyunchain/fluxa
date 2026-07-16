# Test Infrastructure and Methodology

This document outlines the testing architecture, inventory, and verification methodologies used in the Fluxa codebase.

## 1. Test Architecture & Frameworks

We use a dual-tier testing setup:
- **Unit & Integration Testing (Vitest)**: Used for core business logic, database helpers, tRPC routers, encryption/decryption routines, and service orchestrators. Running via `vitest`.
- **End-to-End Testing (Playwright)**: End-to-end user flows, UI verification, and complete integration between frontend and backend. Running via `@playwright/test`.

## 2. Test Inventory

### 2.1 Backend Services & Router Tests (Vitest)
- **`server/tests/umbra.test.ts`**: Tests for the Anonymous Transfer (UTXO Mixer) flows, shielding/unshielding, scanner, and ZK claim logic.
- **`server/tests/flows.test.ts`**: Tests the `FlowService` logic including deposits, withdrawals, and swap coordination with the NEAR Intent client.
- **`server/tests/paj-cash-webhook.test.ts`**: Tests security validation, signature check, amount scaling, and transaction logging of the Paj Cash webhook handler.
- **`server/tests/swap-poller.test.ts`**: Verifies transaction status polling, state transitions, and error handling for private swaps.
- **`server/tests/auth.test.ts` / `server/tests/auth.logout.test.ts`**: Validates the login/logout auth cookie lifecycle.
- **`server/tests/admin.test.ts`**: Validates user freeze, compliance logs, and risk flags management tRPC routes.

### 2.2 End-to-End Tests (Playwright)
- Tests user wallet creation, Nigerian Naira (NGN) deposit/withdrawal on-ramp/off-ramp simulations, cross-chain swaps, and private UTXO Mixer flows.

## 3. Methodology & Best Practices
- **Mocking**: External APIs (like NEAR Intent and the Umbra SDK) are mocked out in unit tests to ensure speed and isolation. Webhook validation signatures are verified with mocked crypto functions.
- **Precision Math**: BigInt is strictly used for all token balance math to prevent precision loss.
- **Defensive Assertions**: Zod schemas enforce regex validation on Solana addresses (`tokenMint`, `recipient`, `receiverStealthPublicKey`) to prevent injection attacks and bad inputs.
