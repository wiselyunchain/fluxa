# FluxaX V2: Implementation Tracking

> Last reconciled against working tree on 2026-06-05 (post `6a98646`). Tests: **62 / 62 passing** across 7 files (~18s wall).
> Companion doc: `PROJECT_STATUS.md` (executive snapshot) — this file is the longer per-module breakdown.

---

## Snapshot of where the code actually is

Phase 3 (Paj Cash) is **done** and Phase 2 (Umbra shielding) has its **deposit-side slice** done. The V2 scaffold from `240514f` has been filled in for the on-ramp / off-ramp loop: `paj_ramp` SDK is wired, the webhook receiver persists fiat requests and user transactions, and on-ramp completion triggers a real Umbra `shieldPublicBalance` call against the user's main wallet.

What remains for an end-to-end MVP: NEAR Intent (Phase 4) is still a stub, the swap flow throws `not implemented`, several admin endpoints are unfinished (search filters, dashboard stats, flag persistence, audit logs, risk alerts), and the frontend is missing `Swap.tsx`, `AnonymousTransfer.tsx`, plus admin sub-pages.

### Modules — real vs stub

| Module | File | State |
|---|---|---|
| Umbra shield (deposit-side) | `server/umbra.ts` | ✅ **Real.** `shieldPublicBalance` calls `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` from `@umbra-privacy/sdk`; updates `umbra_encrypted_balances`. Client cache by keypair. |
| Umbra UTXO claim path | _missing_ | ⬜ Not started. `umbra_utxos` table exists; claim/transfer flows deferred. |
| Paj Cash client | `server/paj-cash.ts` | ✅ **Real.** Wraps `paj_ramp`: `initiate` / `verify` (OTP), `createOnrampOrder`, `createOfframpOrder`, `getBanks`, `resolveBankAccount`, `getAllRate`. Encrypted session token via AES-256-GCM. |
| Paj Cash webhook | `server/paj-cash-webhook.ts` | ✅ **Real.** `POST /api/webhooks/paj-cash`. Status mapping, on-ramp triggers shielding, off-ramp records confirmed withdrawal, persists to `fiat_requests` + `user_transactions`. Idempotent (always 200). |
| NEAR Intent | `server/near-intent.ts` | 🔴 Stub. `setTimeout(1500)` + `amount * 0.98`. Phase 4. |
| Magic Block | `server/magic-block.ts` | 🔴 Stub. Returns fake tx hash. Out of scope. |
| Flow service | `server/flows.ts` | 🟡 Deposit + withdraw implemented (Paj Cash orders + SPL transfer for off-ramp). `handleSwap` throws `not implemented`. |
| Flow procedures | `server/flow-procedures.ts` | 🟡 `deposit` / `withdraw` work; `swap` throws. |
| Wallet creation | `server/routers.ts:83-110` | ✅ Real. `Keypair.generate()` + AES-256-GCM (`server/wallet-crypto.ts`). |
| RPC provider | `server/rpc-provider.ts` | ✅ Real. Live RPC endpoints. |
| Admin | `server/admin.ts` | ✅ OTP procedures + filters + dashboard stats + flag persistence + audit-log writes + risk alerts. |
| Auth | `server/_core/oauth.ts`, `server/routers.ts` | ✅ Manus OAuth retained. |
| DB schema | `drizzle/schema.ts` | ✅ Postgres. 11 tables. |
| DB migrations | `drizzle/0000_funny_sister_grimm.sql` + `drizzle/meta/` | 🟡 **On disk, not committed.** Matches schema 1:1 (11 tables, 9 enums, 11 indexes). Stage and commit. |
| DB driver | `server/db.ts` | ✅ Postgres via `pg` + `drizzle-orm/node-postgres`. Helpers for users, wallets, transactions, fiat requests, Paj Cash sessions, Umbra balances. |
| Frontend pages | `client/src/pages/` | 🟡 `Dashboard`, `Deposit`, `Withdraw`, `History`, `Home`, `AdminDashboard`, `ComponentShowcase`, `NotFound`. **Missing:** `Swap.tsx`, `AnonymousTransfer.tsx`, admin sub-pages (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`). |

### Test surface

`npx vitest run` → **62 pass / 0 fail** across 7 files in ~18s.

| File | Tests | Notes |
|---|---|---|
| `server/rpc-provider.test.ts` | 18 | Hits live Solana / Base / BSC / Avalanche / TON RPCs (~13s — slowest). Breaks offline. |
| `server/admin.test.ts` | 15 | Authorization, no-DB defaults, input validation, persistence (audit logs, risk flags, dashboard counts) via mocked drizzle. |
| `server/paj-cash.test.ts` | 9 | SDK calls mocked via `vi.mock("paj_ramp", ...)`. Covers initiate / verify / order creation. |
| `server/paj-cash-webhook.test.ts` | 8 | Integration-style with mocked DB + Umbra. Covers INIT/PAID/COMPLETED/FAILED status transitions, on-ramp shielding side-effect, off-ramp recording, idempotency. |
| `server/umbra.test.ts` | 6 | `vi.mock("@umbra-privacy/sdk", ...)` — exercises real `shieldPublicBalance` codepath with mocked SDK. |
| `server/auth.test.ts` | 5 | OAuth flow. |
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
- ✅ `umbra_encrypted_balances` bookkeeping
- ✅ Tests cover real codepath (SDK mocked at module boundary)
- ⬜ Withdrawal from encrypted balance
- ⬜ UTXO create / scan / claim
- ⬜ Receiver-claimable UTXOs (anonymous transfer)
- ⬜ Relayer integration

### Phase 3: Paj Cash Integration
- ✅ SDK client (`paj_ramp`)
- ✅ Admin OTP capture (`admin.pajCashInitiate` / `admin.pajCashVerify`) with encrypted token persistence
- ✅ Deposit / withdrawal initiation (`createOnrampOrder` / `createOfframpOrder`)
- ✅ Webhook receiver at `POST /api/webhooks/paj-cash`
- ✅ Status tracking against `fiat_requests` + `user_transactions`
- ✅ Tests — 9 SDK-wrapper + 8 webhook = 17 total

### Phase 4: NEAR Intent Integration
- 🔴 Client — stub returning `amount * 0.98`
- ⬜ Quote / swap execution
- ⬜ Umbra integration (shielded-in → swap → shielded-out)
- ⬜ Tests

### Phase 5: User Flows & Backend
- ✅ Deposit flow — Paj Cash on-ramp → webhook → shield → `user_transactions`
- ✅ Withdrawal flow — Paj Cash off-ramp + SPL transfer
- 🔴 Swap flow — `handleSwap` throws `not implemented`
- ⬜ Anonymous transfer flow
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
2. **Swap flow stub.** `flows.ts:101` and `flow-procedures.ts:49` throw `not implemented`. Blocks Phase 4 + the `Swap.tsx` page.
3. **NEAR Intent stub.** `setTimeout + 0.98x`. Phase 4 entry.
4. **Frontend gaps.** `Swap.tsx`, `AnonymousTransfer.tsx`, and the four admin sub-pages.
5. **No E2E / security / privacy review.** Phase 7.

---

## Suggested next-up ordering

1. **Commit the drizzle migration** (Phase 1 close-out).
2. **Phase 4 — real NEAR Intent client** + implement `handleSwap` (shielded-in → Intent → shielded-out) + `Swap.tsx`.
3. **Anonymous transfer + Umbra claim path** — populate `umbra_utxos` on shield, expose claim, build `AnonymousTransfer.tsx`.
4. **Admin sub-pages** in the frontend (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`) — backend endpoints now ready.
5. **Phase 7** — E2E loop on devnet + Paj Cash sandbox, security/privacy review.

---

## Notes on history

- Commit `240514f` ("implemtnation") reshaped to the V2 scaffold but broke `umbra.test.ts` and left mocks in `createWallet`, `flows.ts`, and the env.
- Commits `4156d6e` → `2ee7041` → `708b0b3` → `4b214e4` → `787f2c5` are the §0 cleanup: restored umbra surface, fixed env + withdrawal wallet, added real Solana keypairs + AES, generated initial migration, added Phase-3 schema tables.
- Commit `6a98646` ("feat: project status") switched dialect to Postgres and deleted the MySQL migrations.
- Post-`6a98646` working-tree work (not yet committed): `paj_ramp` integration, real `shieldPublicBalance`, webhook receiver, admin OTP procedures, Postgres migration regenerated.
