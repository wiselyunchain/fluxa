# FluxaX V2 — Project Status

> Snapshot at HEAD `787f2c5` ("feat: rc version 1"). Working tree clean. Tests: **59 / 59 passing** (~16s wall, 5 files).

## What FluxaX is right now

A privacy-first NGN ↔ crypto bridge on Solana. The V1 multi-chain wallet / Paystack / LI.FI MVP was torn down in commit `240514f`. What's checked in today is a **V2 scaffold**: tRPC procedures and module boundaries that match the planned privacy-first architecture, with most of the privacy/routing pieces implemented as stubs.

## Phase scorecard against the 16-week plan

Legend: ✅ done · 🟡 partial · 🔴 stub only · ⬜ not started

| Phase | Area | State |
|---|---|---|
| 1 | Foundation (schema, env, migrations) | 🟡 — schema has the V2 tables now (incl. `pajCashSessions`, `umbraEncryptedBalances`, `umbraUtxos`); env covers Umbra/Paj Cash/Solana/NEAR; migrations `0000` + `0001` checked in. Still on MySQL — see dialect note below. |
| 2 | Umbra privacy | 🔴 — `server/umbra.ts` (272 lines) is entirely stubs. `@umbra-privacy/sdk@4.0.0` is in `package.json` but never imported. `@umbra-privacy/web-zk-prover@2.0.1` declares peerDep on `sdk@2.0.3` — version pair is unusable as-is. |
| 3 | Paj Cash NGN settlement | 🟡 — `server/paj-cash.ts` (281 lines) is a hand-rolled axios client against endpoints that don't exist on the real Paj Cash API (real SDK is `paj_ramp` at https://github.com/paj-cash/paj_ramp). No webhook route. No DB persistence from flows. |
| 4 | NEAR Intent routing | 🔴 — `server/near-intent.ts` (64 lines) is a `setTimeout(1500)` + `amount * 0.98` mock. SDK docs: https://docs.near-intents.org/ |
| 5 | User flows & backend | 🟡 — `server/flows.ts` orchestrates the three stubs. Skeleton compiles. **Writes nothing to `userTransactions` / `fiatRequests`** so History page is permanently empty. Anonymous transfer flow not started. |
| 6 | Frontend | 🟡 — `Dashboard`, `Deposit`, `Withdraw`, `History`, `Home`, `AdminDashboard`, `ComponentShowcase`, `NotFound`, `IntentInput` present. **Missing**: `Swap.tsx`, `AnonymousTransfer.tsx`, admin sub-pages (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`). |
| 7 | Testing & security | 🔴 — no E2E suite, no security/privacy audit, no load tests, no deployment runbook. |

## Reconciliation work that's already done (the §0 cleanup)

- ✅ `umbra.test.ts` unbroken (`4156d6e` restored the 10-symbol surface; all 28 stub cases pass)
- ✅ `auth.test.ts` calls singular `getWallet` (`2ee7041`)
- ✅ `ENV.nearIntentApiUrl` + `ENV.walletEncryptionKey` declared (`2ee7041`)
- ✅ `createWallet` uses real `@solana/web3.js` keypairs + AES-256-GCM (`708b0b3`)
- ✅ Withdrawal flow threads real `userMainAddress` (`2ee7041`)
- ✅ Initial drizzle migration `0000_handy_baron_strucker.sql` checked in (`4b214e4`)
- ✅ Three new schema tables + `0001_fearless_prism.sql` (`787f2c5`)
- ❌ `@umbra-privacy/web-zk-prover` ↔ `@umbra-privacy/sdk` peer-dep mismatch — still unresolved

## What's left in the active Phase-3 plan

(Approved plan at `~/.claude/plans/vast-splashing-parasol.md`. Scope: replace Paj Cash against the real SDK, wire real Umbra shielding, add webhook route + persistence, admin OTP capture.)

| # | Task | State |
|---|---|---|
| 1 | Schema: 3 new tables | ✅ committed in `787f2c5` |
| 2 | Env: `pajCashEnvironment`, `pajCashWebhookUrl`, `pajCashUsdcMint` | ✅ committed in `787f2c5` |
| 3 | Deps: add `paj_ramp`, remove `@umbra-privacy/web-zk-prover` | ⬜ |
| 4 | `db.ts` helpers for new tables | ⬜ |
| 5 | Rewrite `paj-cash.ts` against `paj_ramp` SDK | ⬜ |
| 6 | Rewrite `umbra.ts` (drop stubs, add `shieldPublicBalance`) | ⬜ |
| 7 | Webhook receiver `paj-cash-webhook.ts` + register in `_core/index.ts` | ⬜ |
| 8 | Rewrite `flows.ts` deposit + withdrawal with persistence | ⬜ |
| 9 | Admin tRPC procedures `pajCashInitiate` + `pajCashVerify` | ⬜ |
| 10 | Tests | ⬜ |
| 11 | Verify (tsc + vitest) | ⬜ |

## Open blocker: database dialect

The codebase is fully MySQL today (`drizzle-orm/mysql-core`, `mysqlTable`, `mysqlEnum`, `dialect: "mysql"` in `drizzle.config.ts`, MySQL-syntax migrations). Direction taken: **move away from MySQL** — switch to Postgres (production) with SQLite as a faster dev option. This needs to land before tasks #3–#11 because `db.ts` helpers and tests both depend on the dialect choice.

### Files affected by the dialect switch

- `drizzle/schema.ts` — convert imports to `drizzle-orm/pg-core` (and a parallel `drizzle/schema.sqlite.ts` for dev).
- `drizzle.config.ts` — `dialect: "postgresql"`; add `drizzle.config.sqlite.ts` for the SQLite-dev config.
- `drizzle/0000_*.sql`, `drizzle/0001_*.sql`, `drizzle/meta/` — MySQL syntax; regenerated under the new dialect.
- `server/db.ts` — `mysql2`-based driver swap to `pg` (and `better-sqlite3` for dev). Pick driver from `DATABASE_URL` prefix.
- `package.json` — drop `mysql2`, add `pg` + `@types/pg` (and `better-sqlite3` for dev).
- Schema mechanics: `decimal(20,8)` → `numeric(20,8)`; `mysqlEnum` → `pgEnum` (declared at top-level for PG) or `text` + check for SQLite; `timestamp().onUpdateNow()` → `timestamp().$onUpdate(...)` since `ON UPDATE CURRENT_TIMESTAMP` is MySQL-only.

## External resources

- Paj Cash SDK: https://github.com/paj-cash/paj_ramp (npm: `paj_ramp`). Webhook payload `{ id, status: INIT|PAID|COMPLETED|FAILED|CANCELLED, transactionType: ON_RAMP|OFF_RAMP, ... }`. Per-session OTP token via `initiate(email, apiKey)` + `verify(otp, deviceInfo, apiKey)`.
- NEAR Intent: https://docs.near-intents.org/
- Magic Block: https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/quickstart
- Umbra: `@umbra-privacy/sdk@4.0.0` factory-function API (`getUmbraClient`, `getPublicBalanceToEncryptedBalanceDirectDepositorFunction`, etc.). v2.0.3 API surface unconfirmed from public metadata.
