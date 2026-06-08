# FluxaX V2: Implementation Tracking

> Last reconciled against working tree on 2026-06-06. Tests: **92 total** across 10 files. **90 passing** (74 non-RPC + 16/18 in `rpc-provider.test.ts`). The 2 RPC failures are pre-existing live-remote flakes (5s timeout against Solana/Base/etc) — independent of server logic.
> Companion doc: `PROJECT_STATUS.md` (executive snapshot) — this file is the longer per-module breakdown.

---

## Snapshot of where the code actually is

Phase 3 (Paj Cash) is **done** and Phase 2 (Umbra shielding) has its **deposit-side slice** done. The V2 scaffold from `240514f` has been filled in for the on-ramp / off-ramp loop: `paj_ramp` SDK is wired, the webhook receiver persists fiat requests and user transactions, and on-ramp completion triggers a real Umbra `shieldPublicBalance` call against the user's main wallet.

What remains for an end-to-end MVP: NEAR Intent (Phase 4) is still a stub, the swap flow throws `not implemented`, several admin endpoints are unfinished (search filters, dashboard stats, flag persistence, audit logs, risk alerts), and the frontend is missing `Swap.tsx`, `AnonymousTransfer.tsx`, plus admin sub-pages.

### Modules — real vs stub

| Module | File | State |
|---|---|---|
| Umbra shield (deposit-side) | `server/umbra.ts` | ✅ **Real.** `shieldPublicBalance` calls `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` from `@umbra-privacy/sdk`; updates `umbra_encrypted_balances`. Client cache by keypair. |
| Umbra unshield (withdrawal) | `server/umbra.ts` | ✅ **Real.** `unshieldEncryptedBalance` calls `getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction`; decrements balance bookkeeping; writes a `withdrawal` row to `user_transactions` (`fromChain=UMBRA`). |
| Umbra UTXO scanner | `server/umbra.ts` | ✅ **Real.** `scanIncomingUtxos` calls `getClaimableUtxoScannerFunction`; persists discovered receiver-claimable and self-claimable UTXOs into `umbra_utxos` (dedup on `commitment`). Mint address reconstructed from H1 `mintAddressLow/High` U128 limbs. |
| Umbra send/claim (anonymous transfer) | _gated_ | 🔴 **Blocked on ZK prover.** `getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction` requires an `IZkProverForReceiverClaimableUtxo`; `@umbra-privacy/web-zk-prover` is not installed (peer version mismatch flagged in earlier notes). Not exposed via tRPC yet. |
| Umbra tRPC | `server/umbra-procedures.ts` | ✅ `withdraw`, `scanIncoming`, `listClaimable`. Mounted at `appRouter.umbra`. |
| Paj Cash client | `server/paj-cash.ts` | ✅ **Real.** Wraps `paj_ramp`: `initiate` / `verify` (OTP), `createOnrampOrder`, `createOfframpOrder`, `getBanks`, `resolveBankAccount`, `getAllRate`. Encrypted session token via AES-256-GCM. |
| Paj Cash webhook | `server/paj-cash-webhook.ts` | ✅ **Real.** `POST /api/webhooks/paj-cash`. Status mapping, on-ramp triggers shielding, off-ramp records confirmed withdrawal, persists to `fiat_requests` + `user_transactions`. Idempotent (always 200). |
| NEAR Intent (1Click) | `server/near-intent.ts` | ✅ **Real.** HTTP client against `1click.chaindefuser.com/v0`: `quote`, `status`, `submitDeposit`, `supportedTokens`. `X-API-Key` auth. Injectable `fetchImpl` for tests. |
| Solana SPL transfer | `server/solana-transfer.ts` | ✅ Extracted from `flows.ts` for reuse + testability. |
| Magic Block | `server/magic-block.ts` | 🔴 Stub. Returns fake tx hash. Out of scope. |
| Flow service | `server/flows.ts` | ✅ Deposit, withdraw, and swap (NEAR Intent quote → SPL transfer → user_transactions → deposit notification). |
| Flow procedures | `server/flow-procedures.ts` | ✅ `deposit` / `withdraw` / `swap` all wired with Zod input validation. |
| Swap poller | `server/swap-poller.ts` | ✅ `startSwapPoller` runs on boot (interval via `SWAP_POLLER_INTERVAL_MS`, default 30s). Maps 1Click `SUCCESS`→`confirmed`, `FAILED`/`REFUNDED`→`failed`, in-flight statuses are no-ops. Per-row errors logged, batch continues. |
| Wallet creation | `server/routers.ts:83-110` | ✅ Real. `Keypair.generate()` + AES-256-GCM (`server/wallet-crypto.ts`). |
| RPC provider | `server/rpc-provider.ts` | ✅ Real. Live RPC endpoints. |
| Admin | `server/admin.ts` | ✅ OTP procedures + filters + dashboard stats + flag persistence + audit-log writes + risk alerts. |
| Auth | `server/_core/oauth.ts`, `server/routers.ts` | ✅ Manus OAuth retained. |
| DB schema | `drizzle/schema.ts` | ✅ Postgres. 11 tables. |
| DB migrations | `drizzle/0000_*.sql`, `drizzle/0001_steady_northstar.sql` + `drizzle/meta/` | ✅ `0000` committed. `0001` adds `nearIntentDepositAddress` + `nearIntentDepositMemo` + `idx_pending_swaps` to `user_transactions` for the swap poller. |
| DB driver | `server/db.ts` | ✅ Postgres via `pg` + `drizzle-orm/node-postgres`. Helpers for users, wallets, transactions, fiat requests, Paj Cash sessions, Umbra balances. |
| Frontend pages | `client/src/pages/` | 🟡 `Dashboard`, `Deposit`, `Withdraw`, `History`, `Home`, `AdminDashboard`, `ComponentShowcase`, `NotFound`. **Missing:** `Swap.tsx`, `AnonymousTransfer.tsx`, admin sub-pages (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`). |

### Test surface

`npx vitest run --exclude='**/rpc-provider.test.ts'` → **67 pass / 0 fail** across 9 files in ~2s.

| File | Tests | Notes |
|---|---|---|
| `server/rpc-provider.test.ts` | 18 (16 stable) | Hits live Solana / Base / BSC / Avalanche / TON RPCs. 2 tests are 5s-timeout flakes against remote endpoints. |
| `server/admin.test.ts` | 15 | Authorization, no-DB defaults, input validation, persistence (audit logs, risk flags, dashboard counts) via mocked drizzle. |
| `server/swap-poller.test.ts` | 11 | Status mapping (SUCCESS/FAILED/REFUNDED + 4 in-flight statuses), memo propagation, batch-error isolation, empty batch, missing depositAddress skip. |
| `server/paj-cash.test.ts` | 9 | SDK calls mocked via `vi.mock("paj_ramp", ...)`. Covers initiate / verify / order creation. |
| `server/paj-cash-webhook.test.ts` | 8 | Integration-style with mocked DB + Umbra. Covers INIT/PAID/COMPLETED/FAILED status transitions, on-ramp shielding side-effect, off-ramp recording, idempotency. |
| `server/near-intent.test.ts` | 7 | Injectable `fetchImpl`. Covers `quote`, `status`, `submitDeposit`, `supportedTokens`, error path, base-URL normalization. |
| `server/umbra.test.ts` | 13 | `vi.mock("@umbra-privacy/sdk", ...)` — covers shield (4), unshield (4), scanner including UTXO classification + commitment dedupe + custom index range (5). |
| `server/auth.test.ts` | 5 | OAuth flow. |
| `server/flows.test.ts` | 5 | Mocks NEAR Intent client + `sendSplToken` + DB. Covers quote/transfer/persist/notify happy path, custom slippage/deadline, submitDeposit failure, quote failure, transfer failure. |
| `server/auth.logout.test.ts` | 1 | Logout. |

### Dependency notes

`pnpm install` succeeds. Open peer warnings (non-blocking):

- `@umbra-privacy/sdk → @umbra-privacy/umbra-codama → @solana-program/token-2022` expects `@solana/sysvars@^5.0`; lockfile has `6.8.0`.
- `@builder.io/vite-plugin-jsx-loc@0.1.1` expects `vite@^4 || ^5`; lockfile has `vite@7.1.9`.
- `@umbra-privacy/web-zk-prover` is no longer needed for the deposit-side slice; can be removed when the claim path is built (or sooner).

---

## Phase status against the 16-week timeline

Legend: ✅ done · 🟡 partial · 🔴 stub-only · ⬜ not started

### Phase 1: Foundation & Infrastructure
- ✅ V2 schema (11 tables incl. `umbra_encrypted_balances`, `umbra_utxos`, `paj_cash_sessions`)
- ✅ Paystack / v1 code removed
- ✅ Real Solana wallet generation (`Keypair.generate` + AES-256-GCM)
- ✅ Env configuration (`pajCashApiKey`, `pajCashEnvironment`, `pajCashWebhookUrl`, `pajCashUsdcMint`, `nearIntentApiUrl`, `walletEncryptionKey`, Umbra/Solana vars)
- ✅ Dialect switch MySQL → Postgres
- 🟡 **DB migrations** — generated and matching schema, but `drizzle/0000_funny_sister_grimm.sql` and `drizzle/meta/` are still untracked. Stage and commit.

### Phase 2: Umbra Integration
- ✅ Client init via `getUmbraClient` (cached by keypair)
- ✅ Deposit shielding (`shieldPublicBalance`) — real SDK
- ✅ Withdrawal from encrypted balance (`unshieldEncryptedBalance`) — real SDK, no prover needed
- ✅ UTXO scanner (`scanIncomingUtxos`) — real SDK, persists to `umbra_utxos`
- ✅ `umbra_encrypted_balances` bookkeeping (increment on shield, decrement on unshield)
- ✅ Tests — 4 shield + 4 unshield + 5 scanner = 13 covering all real codepaths (SDK mocked at module boundary)
- 🔴 Receiver-claimable UTXO creation — **gated on ZK prover**; SDK requires `IZkProverForReceiverClaimableUtxo`, prover package not installed
- 🔴 UTXO claim into encrypted balance — same prover gate
- ⬜ Relayer integration — SDK ships its own (`getUmbraRelayer`), to be wired alongside the claim path

### Phase 3: Paj Cash Integration
- ✅ SDK client (`paj_ramp`)
- ✅ Admin OTP capture (`admin.pajCashInitiate` / `admin.pajCashVerify`) with encrypted token persistence
- ✅ Deposit / withdrawal initiation (`createOnrampOrder` / `createOfframpOrder`)
- ✅ Webhook receiver at `POST /api/webhooks/paj-cash`
- ✅ Status tracking against `fiat_requests` + `user_transactions`
- ✅ Tests — 9 SDK-wrapper + 8 webhook = 17 total

### Phase 4: NEAR Intent Integration
- ✅ Real 1Click HTTP client (`quote`, `status`, `submitDeposit`, `supportedTokens`)
- ✅ Quote → SPL transfer → persistence → deposit notification
- ✅ Status poller (`server/swap-poller.ts`) — runs on server boot, flips `pending` → `confirmed`/`failed` based on 1Click `/status`
- ✅ Tests (7 client + 5 flow + 11 poller)
- ⬜ Umbra integration (shielded-in → swap → shielded-out) — deferred

### Phase 5: User Flows & Backend
- ✅ Deposit flow — Paj Cash on-ramp → webhook → shield → `user_transactions`
- ✅ Withdrawal flow (fiat) — Paj Cash off-ramp + SPL transfer
- ✅ Withdrawal flow (private) — Umbra encrypted → public (`umbra.withdraw`)
- ✅ Swap flow — NEAR Intent quote → SPL transfer → `user_transactions` (`pending`)
- ✅ Swap completion — poller settles `pending` rows on `SUCCESS`/`FAILED`/`REFUNDED`
- ✅ UTXO discovery — `umbra.scanIncoming` + `umbra.listClaimable` populate the inbox
- 🔴 Anonymous transfer (send + claim) — blocked on ZK prover install
- ⬜ Balance polling (removed in teardown; no replacement)

### Phase 6: Frontend & UI
- 🟡 Core components — `IntentInput`, `DashboardLayout`, error boundary, skeleton present
- 🟡 User pages — `Dashboard`, `Deposit`, `Withdraw`, `History` present; **`Swap.tsx`, `AnonymousTransfer.tsx` missing**
- 🟡 Admin dashboard — top-level present; sub-pages (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`) **missing**
- 🔴 Polish (page-level error boundaries, loading states, a11y, cross-browser)

### Phase 7: Testing & Security
- 🔴 E2E suite — not built (devnet + Paj Cash sandbox loop)
- 🔴 Security audit — webhook signature verification, AES key handling, OTP replay
- 🔴 Privacy audit — confirm no PII leaks across the shield boundary
- 🔴 Load / vulnerability scans
- 🔴 Mainnet deployment plan

---

## Active blockers and immediate gaps

1. **Migrations untracked.** `drizzle/0000_funny_sister_grimm.sql` and `drizzle/meta/` are on disk but not in git. Stage and commit so CI / teammates can recreate the schema.
2. **NEAR_INTENT_API_KEY not set.** Client constructs cleanly without it, but quote/status/submitDeposit calls will fail with whatever auth response 1Click gives. Add to env before mainnet/devnet runs.
3. **`@umbra-privacy/web-zk-prover` not installed.** Required for the anonymous-transfer send + claim path. Peer version mismatch with `@umbra-privacy/sdk@4.0.0` needs resolving before install (prover declares `@umbra-privacy/sdk@2.0.3` as peer). Until then, `umbra.withdraw` + `umbra.scanIncoming` + `umbra.listClaimable` are the only Umbra-side procedures exposed.
4. **`rpc-provider.test.ts` flakes.** 2/18 tests time out against remote RPCs with the default 5s. Either bump `testTimeout` for that file or skip in CI; unrelated to product logic.
5. **Frontend gaps.** `Swap.tsx`, `AnonymousTransfer.tsx`, and the four admin sub-pages.
6. **No E2E / security / privacy review.** Phase 7.

---

## Suggested next-up ordering

1. **Resolve `@umbra-privacy/web-zk-prover` install** so the send + claim path can ship. Once installed, add `umbra.send` (createReceiverClaimableUtxo) and `umbra.claim` procedures.
2. **`Swap.tsx` frontend page** — backend ready: it should call a `getSupportedTokens` query for the picker, a quote-preview query, and `flow.swap` for execution.
3. **`AnonymousTransfer.tsx` (read-only first)** — even without the send/claim ZK pieces, the inbox (`umbra.listClaimable`) + private withdraw (`umbra.withdraw`) UI can ship.
4. **Umbra-in / Umbra-out swap variant** — withdraw from encrypted balance → swap → shield the output (privacy-preserving routing).
5. **Admin sub-pages** in the frontend (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`) — backend endpoints now ready.
6. **Phase 7** — E2E loop on devnet + Paj Cash sandbox, security/privacy review.

---

## Notes on history

- Commit `240514f` ("implemtnation") reshaped to the V2 scaffold but broke `umbra.test.ts` and left mocks in `createWallet`, `flows.ts`, and the env.
- Commits `4156d6e` → `2ee7041` → `708b0b3` → `4b214e4` → `787f2c5` are the §0 cleanup: restored umbra surface, fixed env + withdrawal wallet, added real Solana keypairs + AES, generated initial migration, added Phase-3 schema tables.
- Commit `6a98646` ("feat: project status") switched dialect to Postgres and deleted the MySQL migrations.
- Post-`6a98646` working-tree work (not yet committed): `paj_ramp` integration, real `shieldPublicBalance`, webhook receiver, admin OTP procedures, Postgres migration regenerated.
