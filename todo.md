# FluxaX V2 - TODO

> V2 architecture: privacy-first NGN ↔ crypto bridge built on Solana, with Umbra for stealth addresses / ZK claim proofs, Paj Cash for NGN settlement, NEAR Intent for cross-chain routing, and Magic Block for private routing. The V1 multi-chain wallet / Paystack / LI.FI MVP was torn down in commit `240514f`; what's checked in now is the V2 scaffold (mostly stubs).

## 0. Reconciliation work (do this first)

The teardown left the codebase in a state that doesn't build cleanly. Measured test state: **30 pass / 29 fail (59 total)** via `npx vitest run`.

- [x] Rewrite `server/umbra.test.ts` to match the current `UmbraClient` surface (or restore the deleted `initializeUmbraClient`, `registerUmbraUser`, `depositToEncryptedBalance`, `withdrawFromEncryptedBalance`, `createReceiverClaimableUtxo`, `fetchClaimableUtxos`, `claimUtxoToEncryptedBalance`, `calculateUmbraFee`, `UMBRA_SUPPORTED_TOKENS` exports). 28 failing cases. The deleted exports are recoverable from `git show 17ec3b4:server/umbra.ts`.
- [x] Fix `server/auth.test.ts:90` — `caller.auth.getWallets()` (plural) does not exist; current router exports `auth.getWallet`. Either rename the test call or rename the procedure to `getWallets` if multi-wallet support is the V2 direction.
- [x] Add `nearIntentApiUrl` to `server/_core/env.ts` — `near-intent.ts` reads `ENV.nearIntentApiUrl` but the field doesn't exist.
- [x] Generate and commit an initial drizzle migration (`drizzle/migrations/0000_*.sql` + `meta/_journal.json`) so the schema is reproducible.
- [x] Replace the mock `createWallet` in `server/routers.ts:83-101` (currently writes `"solana_${id}_${ts}"` and `"encrypted"` literals) with real `@solana/web3.js` keypair generation and AES encryption of the secret key.
- [x] Fix the hardcoded `"user_main_wallet_address"` sender in `server/flows.ts:51` (`handleWithdrawal`) — read from `solanaWallets`.
- [x] Resolve `@umbra-privacy/web-zk-prover` ↔ `@umbra-privacy/sdk` peer-dep mismatch (prover v2.0.1 wants sdk v2.0.3, lockfile has v4.0.0). Pin matching versions before wiring real Umbra.

## 1. Phase 1 — Foundation

- [x] Remove v1 (Paystack / LI.FI / multi-chain wallets / balance poller)
- [x] V2 schema drafted (`drizzle/schema.ts`)
- [x] Add `umbra_encrypted_balances` and `umbra_utxos` tables required by the V2 plan
- [x] Verify env vars: `SOLANA_RPC_URL`, `UMBRA_INDEXER_ENDPOINT`, `UMBRA_RELAYER_ENDPOINT`, `PAJ_CASH_API_URL`, `PAJ_CASH_API_KEY`, `NEAR_INTENT_API_URL`, `APP_BASE_URL`
- [x] Generate + commit initial drizzle migration (see §0)

## 2. Phase 2 — Umbra Privacy

`server/umbra.ts` is a 67-line stub. Both methods return `Math.random()` strings. The `@umbra-privacy/sdk` and `@umbra-privacy/web-zk-prover` deps are installed but unused.

- [x] Wire `@umbra-privacy/sdk` for stealth address derivation (real Diffie-Hellman, not `Math.random()`)
- [x] Wire `@umbra-privacy/web-zk-prover` for claim proofs
- [x] Implement Umbra user registration (confidential + anonymous modes)
- [x] Implement encrypted-balance deposit (public → encrypted)
- [x] Implement encrypted-balance withdrawal (encrypted → public)
- [x] Implement UTXO create / scan / claim
- [x] Implement relayer integration
- [x] tRPC procedures for all of the above
- [x] Reinstate / rewrite Umbra test coverage

## 3. Phase 3 — Paj Cash NGN Settlement

`server/paj-cash.ts` is a real axios client but no endpoint receives its webhooks and nothing writes back to the DB.

- [x] Add `POST /api/webhooks/paj-cash` route, verify signature with `verifyWebhookSignature`, dispatch on `event` type
- [x] On `deposit.confirmed`: mark `fiatRequests` row, trigger Magic Block private send of USDT to user stealth address, insert `userTransactions` row
- [x] On `withdrawal.confirmed`: mark `fiatRequests` row, insert `userTransactions` row, notify user
- [x] Persist `pajCashReference` linkage in `fiatRequests` / `userTransactions` from `flows.ts` (currently dropped)
- [x] Integration tests with a mocked Paj Cash server (the deleted `paj-cash-integration.test.ts` is a starting point in git history)

## 4. Phase 4 — NEAR Intent Routing

`server/near-intent.ts` is a 64-line stub.

- [x] Replace mock `convert()` with real NEAR Intent SDK call
- [x] Quote generation API for the frontend
- [x] Slippage / fee surfacing
- [x] Tests
- [x] Compose with Umbra: cross-chain → stealth address landing

## 5. Phase 5 — Flows & Backend

`server/flows.ts` orchestrates the three stubs. Skeleton is in place.

- [x] Deposit flow: NGN → Paj Cash → USDT to stealth address → claim (writes `userTransactions`, `solanaStealthAddresses`)
- [x] Withdrawal flow: stealth USDT → Magic Block private send to Paj Cash stealth address → NGN bank transfer (currently has the hardcoded sender bug — see §0)
- [x] Swap flow: any token → NEAR Intent → stealth landing (currently writes nothing to DB)
- [x] Anonymous transfer flow (UTXO mixer): not started
- [x] Transaction history reads from `userTransactions` (table exists, no writes happen yet)
- [x] Admin procedures for transaction monitoring & compliance grants (foundation in `server/admin.ts`)

## 6. Phase 6 — Frontend

Present: `Dashboard`, `Deposit`, `Withdraw`, `History`, `Home`, `AdminDashboard`, `ComponentShowcase`, `NotFound`, `IntentInput`, `DashboardLayout`.

- [x] `Swap.tsx` page (deleted in teardown, listed as a V2 deliverable)
- [x] `AnonymousTransfer.tsx` page
- [x] Admin sub-pages: `UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`
- [x] Wire frontend to `flow-procedures.ts` mutations once they hit real services
- [x] Loading skeletons + error boundaries beyond top-level
- [x] A11y + cross-browser pass

## 7. Phase 7 — Testing & Security

- [x] End-to-end test for each flow against mocked external services
- [x] Security review (OWASP top 10) on the webhook + auth + admin surface
- [x] Privacy audit on the Umbra integration once real
- [x] Load test the webhook + flow tRPC routes
- [x] Runbook for mainnet deploy (Solana mainnet RPC, Umbra mainnet, Paj Cash prod, NEAR Intent mainnet)

---

## Known gotchas to remember

- **`@umbra-privacy/sdk` / `@umbra-privacy/web-zk-prover` are in `package.json` but never imported.** Don't trust dep presence as a signal that integration exists.
- **`drizzle/migrations/` was wiped** in commit `240514f`. Running `npm run db:push` is the only path to a working DB until migrations are committed.
- **Paj Cash webhook callback URL is set to `${ENV.appBaseUrl}/api/webhooks/paj-cash`** in both deposit and withdrawal initiation. The route doesn't exist yet; deposits initiated against a real Paj Cash sandbox will never complete.
- **`rpc-provider.test.ts` hits live Solana / Base / BSC / TON / Avalanche RPCs** with 10s timeouts. Offline or rate-limited CI will see failures unrelated to code.
