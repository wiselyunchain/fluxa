# Test Coverage & Readiness Summary

This document summarizes the test coverage, edge cases verified, and current status of tests in the codebase.

## 1. Test Coverage Summary

- **Anonymous Transfer (UTXO Mixer) Service (`server/services/umbra.ts`)**:
  - `shieldPublicBalance`: Covered by 3 tests (decrypting keypair, upserting bookkeeping, SDK error propagation).
  - `unshieldEncryptedBalance`: Covered by 5 tests (defaulting recipient, routing funds, decrementing bookkeeping, insufficient balance validation, SDK error propagation).
  - `createReceiverClaimableUtxo`: Covered by 2 tests (insufficient balance validation, successful balance decrement + transaction insertion + SDK delegation).
  - `claimUtxoToEncryptedBalance`: Covered by 4 tests (not found in scanner arrays, amount mismatch, mint mismatch, successful balance increment + UTXO deletion + transaction insertion).
  - `scanIncomingUtxos`: Covered by 5 tests (defaults scanning, received UTXO persistence, classification, skipping invalid commitments, custom scan ranges).
- **NEAR Intents Swap Flow (`server/services/flows.ts`)**:
  - `handleSwap`: Covered by 5 tests (quoting, token transfer, deposit submission, custom slippage/recipient, error resilience).
- **Paj Cash Webhook Handler (`server/routes/paj-cash-webhook.ts`)**:
  - Webhook router: Covered by 8 tests (missing signatures, unknown statuses, database down resilience, completed on-ramp / off-ramp processing, amount scaling verification, failed states).
- **Swap Poller Service (`server/services/swap-poller.ts`)**:
  - State polling & private transaction retry/recovery: Covered by 11 tests.

## 2. Edge Cases Verified
- Scaling `body.amount` on-ramp webhooks by decimal precision of the token (6 for USDC/USDT) to prevent fractional unit loss.
- Using `BigInt` for database balance bookkeeping math to avoid floating-point inaccuracies.
- Enforcing strict Solana address formats using Zod regex patterns for `tokenMint`, `recipient`, and `receiverStealthPublicKey` addresses.
- Index rollback protection on Umbra scan indexes by comparing current index with the updated scan index (`lt(umbraScanIndex, nextScanIndex)`).
- Rollback prevention on private swap settles (polling is retried and status is kept pending if shielding or UTXO creation fails).
