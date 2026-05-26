# FluxaX V2: Implementation Tracking

> Last reconciled against code at commit `240514f` ("implemtnation").
> Prior commits' completion claims were inflated — see "Notes on history" at the bottom.

---

## Snapshot of where the code actually is

The V1 MVP (Paystack / multi-chain wallets / LI.FI swap aggregator / balance poller) was torn down in commit `240514f`. What remains is a **V2 scaffold**: interfaces and tRPC procedures that match the planned privacy-first architecture, but with the privacy/routing modules implemented as mocks.

### Modules — real vs stub

| Module | File | Lines | State |
|---|---|---|---|
| Umbra client | `server/umbra.ts` | 67 | **Stub.** `generateStealthAddress` / `generateClaimProof` return `Math.random()` strings. No `@umbra-privacy/sdk` usage despite the dep being in `package.json`. |
| Umbra tests | `server/umbra.test.ts` | 369 | **Broken.** Imports `initializeUmbraClient`, `registerUmbraUser`, `depositToEncryptedBalance`, etc. — none exist in current `umbra.ts`. Must be rewritten or the surface restored. |
| Paj Cash client | `server/paj-cash.ts` | 281 | **Real HTTP client** (axios). Endpoints: `/deposits/initiate`, `/withdrawals/initiate`, `/rates`, `/bank/validate`, `/bank/list`, `/stealth-address`. Webhook signature verify present (HMAC-SHA256). Not exercised against a live or mocked Paj Cash API yet. |
| Paj Cash webhook route | _missing_ | — | **Not built.** Flows depend on Paj Cash callbacks but there is no Express/tRPC route receiving `POST /api/webhooks/paj-cash`. |
| NEAR Intent | `server/near-intent.ts` | 64 | **Stub.** `convert()` calls `setTimeout(1500)` and returns `outputAmount = from.amount * 0.98`. No SDK. |
| Magic Block | `server/magic-block.ts` | 51 | **Stub.** `sendPrivate()` returns a fake tx hash. No SDK. |
| Flow service | `server/flows.ts` | 94 | Orchestration over the stubs. Withdrawal flow contains a literal `"user_main_wallet_address"` placeholder. |
| Flow procedures | `server/flow-procedures.ts` | 69 | tRPC `deposit` / `withdraw` / `swap` mutations. Functional skeleton. |
| Wallet creation | `server/routers.ts:83-101` | — | **Mock.** `createWallet` writes `mockAddress = "solana_${id}_${date}"` and `"encrypted"` literals for `mainKeypair` / `stealthKey` / `claimKey`. No real Solana keypair generation. |
| RPC provider | `server/rpc-provider.ts` | 317 | Real, retained from v1. Hits live RPC endpoints in tests. |
| Admin | `server/admin.ts` | 213 | Retained. |
| Auth | `server/_core/oauth.ts`, `server/routers.ts` | — | Manus OAuth retained. |
| DB schema | `drizzle/schema.ts` | 156 | Tables: `users`, `solanaWallets`, `userTransactions`, `solanaStealthAddresses`, `fiatRequests`, `riskFlags`, `auditLogs`. **Missing** the `umbra_encrypted_balances` / `umbra_utxos` tables the V2 plan calls for. |
| DB migrations | `drizzle/migrations/`, `drizzle/meta/` | — | **Wiped in the teardown.** Only `drizzle/schema.ts` and an empty `drizzle/relations.ts` remain. `npm run db:push` would generate a fresh `0000_*.sql`. |
| Frontend pages | `client/src/pages/` | — | `Dashboard`, `Deposit`, `Withdraw`, `History`, `Home`, `AdminDashboard`, `ComponentShowcase`, `NotFound`. **No** `Swap.tsx` or `AnonymousTransfer.tsx`. |
| Frontend components | `client/src/components/IntentInput.tsx` | 128 | New intent-input component. |

### Test surface (after teardown)

Measured: `pnpm install && npx vitest run` → **30 pass / 29 fail (59 total)** across 5 files in ~10s.

| File | Pass | Fail | Notes |
|---|---|---|---|
| `server/rpc-provider.test.ts` | 17 | 0 | All green. Hits live Solana / Base / BSC / Avalanche / TON RPCs — slowest file (~1s/test, occasionally 2.3s). Will break offline. |
| `server/admin.test.ts` | 7 | 0 | All green. |
| `server/auth.logout.test.ts` | 1 | 0 | Green. |
| `server/auth.test.ts` | 4 | 1 | One test calls `caller.auth.getWallets()` (v1 plural) but the current router has `auth.getWallet` (singular) → returns `NOT_FOUND`, test expects `UNAUTHORIZED`. Rename leftover. |
| `server/umbra.test.ts` | 0 | 28 | All 28 cases fail — every import (`initializeUmbraClient`, `createTestSigner`, `registerUmbraUser`, `depositToEncryptedBalance`, `withdrawFromEncryptedBalance`, `createReceiverClaimableUtxo`, `fetchClaimableUtxos`, `claimUtxoToEncryptedBalance`, `calculateUmbraFee`, `UMBRA_SUPPORTED_TOKENS`) resolves to `undefined`. |

Tests **deleted** in `240514f` and not yet replaced: `paystack.test.ts`, `paystack-webhook.test.ts`, `swap.test.ts`, `swap-aggregator.test.ts`, `wallets.test.ts`, `fiat.test.ts`, `balance-poller.test.ts`, `paj-cash-integration.test.ts`.

### Dependency-resolution warnings worth noting

`pnpm install` succeeds but flags peer-dep mismatches that will bite the moment Umbra is real:

- `@umbra-privacy/web-zk-prover@2.0.1` expects `@umbra-privacy/sdk@2.0.3`, lockfile has `4.0.0` — the ZK prover may not work with the v4 SDK.
- `@umbra-privacy/sdk → @umbra-privacy/umbra-codama → @solana-program/token-2022` expects `@solana/sysvars@^5.0`, lockfile has `6.8.0`.
- `@builder.io/vite-plugin-jsx-loc@0.1.1` expects `vite@^4 || ^5`, lockfile has `vite@7.1.9`.

---

## Phase status against the 16-week timeline

Legend: ✅ done · 🟡 partial · 🔴 stub-only · ⬜ not started

### Phase 1: Foundation & Infrastructure
- 🟡 Schema with Umbra tables — `solanaStealthAddresses` exists, but the encrypted-balance and UTXO tables from the V2 plan do not
- ✅ Paystack/v1 code removed
- 🔴 Solana wallet generation — mock string in `routers.ts`
- 🟡 Env configuration — `_core/env.ts` covers Solana / Umbra / Paj Cash, but no `NEAR_INTENT_API_URL` (used in `near-intent.ts` via `ENV.nearIntentApiUrl` which doesn't exist on the ENV object)
- 🔴 DB migrations — directory wiped, never regenerated

### Phase 2: Umbra Integration
- 🔴 Umbra client init — stub
- 🔴 User registration (confidential / anonymous)
- 🔴 Encrypted-balance deposit / withdraw
- 🔴 UTXO create / scan / claim
- 🔴 Relayer integration
- 🔴 Tests broken (imports don't resolve)

### Phase 3: Paj Cash Integration
- 🟡 API client — present, untested against a live or mock server
- 🟡 Deposit / withdrawal initiation — methods exist
- 🔴 Webhook route — **no endpoint** to receive callbacks
- 🔴 Transaction status tracking against `userTransactions` / `fiatRequests` — not wired
- 🔴 Tests — `paj-cash-integration.test.ts` was deleted

### Phase 4: NEAR Intent Integration
- 🔴 Client — stub returning `amount * 0.98`
- 🔴 Quote / swap execution
- 🔴 Umbra integration
- 🔴 Tests — none

### Phase 5: User Flows & Backend
- 🟡 Deposit / withdrawal / swap flows — orchestration skeleton exists, depends on stubbed clients
- 🔴 Anonymous transfer flow
- 🔴 Transaction recording — `userTransactions` table exists but flows don't write to it
- 🔴 Balance polling — removed in teardown

### Phase 6: Frontend & UI
- 🟡 Core components — `IntentInput`, `DashboardLayout`, etc. present
- 🟡 User pages — `Dashboard`, `Deposit`, `Withdraw`, `History` present; `Swap` and `AnonymousTransfer` missing
- 🟡 Admin dashboard — `AdminDashboard.tsx` exists; sub-pages (`UserManagement`, `TransactionMonitoring`) not present
- 🔴 Polish (error boundaries beyond top-level, loading skeletons beyond layout, a11y, cross-browser)

### Phase 7: Testing & Security
- 🔴 E2E suite
- 🔴 Security audit
- 🔴 Privacy audit
- 🔴 Load / vulnerability scans
- 🔴 Mainnet deployment plan

---

## Critical issues blocking progress

1. **`umbra.test.ts` references a deleted API.** Either restore the previous Umbra surface (`initializeUmbraClient`, `registerUmbraUser`, etc.) or rewrite the tests against `UmbraClient` / `getUmbraClient`. Currently produces **28 failures** out of 28 cases.
2. **`auth.test.ts` calls `auth.getWallets()` (v1)** — current router has `auth.getWallet` singular. One test asserts `UNAUTHORIZED` but receives `NOT_FOUND`. Rename the call (and decide whether the procedure name itself should be plural for the multi-wallet future).
3. **No Paj Cash webhook endpoint.** Flows initiate deposits with `callbackUrl: ${ENV.appBaseUrl}/api/webhooks/paj-cash`, but nothing is registered at that path. The deposit flow has no completion path.
4. **`ENV.nearIntentApiUrl` is read but never declared** in `_core/env.ts`. Currently `undefined`, harmless because `near-intent.ts` is a mock, but it will silently break the real integration.
5. **`createWallet` produces unusable mock data.** A user signing up gets `mainAddress = "solana_${id}_${ts}"` and `"encrypted"` literals — deposit/withdraw/swap flows that read `userWallet.mainAddress` will pass nonsense downstream.
6. **No drizzle migrations checked in.** `npm run db:push` is the only path to a working DB; teammates / CI can't recreate the schema deterministically yet.
7. **Withdrawal flow has a hardcoded sender** (`"user_main_wallet_address"`) — it must read from `solanaWallets`.
8. **Umbra dependency-version mismatch.** `@umbra-privacy/web-zk-prover@2.0.1` declares a peer of `@umbra-privacy/sdk@2.0.3`, lockfile has `4.0.0` — the prover may not work against the v4 SDK when Umbra is wired for real.

---

## Suggested next-up ordering

Before continuing the timeline, close the gaps the teardown opened:

1. Decide whether to keep the existing tracking files in lockstep with reality or scrap them and re-plan. I'd recommend the former — fix the discrepancies and only commit phase completion when tests prove it.
2. Fix `umbra.test.ts` (or restore the deleted Umbra functions) so `npm test` runs end-to-end again.
3. Add the Paj Cash webhook route + `ENV.nearIntentApiUrl` + write `userTransactions` rows in flows.
4. Replace the mock `createWallet` with real `@solana/web3.js` keypair generation + AES encryption of the secret (env-keyed).
5. Generate and commit an initial drizzle migration so the schema is reproducible.
6. Only then resume Phase 2 (real Umbra SDK wiring).

---

## Notes on history

- Commit `17ec3b4` claimed "Phase 1-2 Complete: 64 tests passing." That was true *at that point* — `umbra.test.ts` and `paj-cash-integration.test.ts` had matching implementations.
- Commit `240514f` ("implemtnation") was a refactor that deleted most v1 code and shrunk Umbra/Paj Cash to skeletons, but **did not update `umbra.test.ts` to match**. The 64-passing claim is no longer accurate for HEAD.
- The frontend half of `240514f` (deleting `Swap.tsx` / `Fiat.tsx`, adding `IntentInput.tsx`, `Deposit.tsx`, `Withdraw.tsx`) is a sensible V2 reshape but leaves Phase 6 pages incomplete relative to the timeline (`Swap`, `AnonymousTransfer` are still listed as deliverables).
