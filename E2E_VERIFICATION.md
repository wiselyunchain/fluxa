# End-to-End Verification — wallet connect → private off-ramp

> Run on 2026-06-23 against local dev (`npm run dev`, Postgres, `SOLANA_NETWORK=devnet`, `PAJ_CASH_ENVIRONMENT=Staging`).
> Scope: "verify what works today" — no application code changed. One missing local **config** value was supplied (see Finding 3).

## Per-link result

| # | Link | Result | Evidence |
|---|---|---|---|
| 0 | Static: `tsc --noEmit` | ✅ pass | exit 0 |
| 0 | Static: `vitest run` | ✅ **92/92 pass** | 10 files, ~13s (docs' "59/59" is stale) |
| 1 | Server boots + serves | ✅ | `Server running on http://localhost:3000/`, Postgres connected, client served |
| 2 | Wallet connect — real OAuth login | ⛔ blocked (external) | `[OAuth] ERROR: OAUTH_SERVER_URL is not configured!` — login portal not reachable locally |
| 3 | Session auth (`auth.me`) | ✅ *after config fix* | returns the user once `VITE_APP_ID` set (see Finding 3) |
| 4 | Wallet provisioning (`auth.createWallet`) | ✅ | real Solana address `6Zn93cMxSZkaQffXcMM6jtFaoD7iR1PXB2yBXMHtDrXU`, keypair AES-256-GCM encrypted at rest, balance 0 |
| 5 | Off-ramp orchestration (`flow.withdraw`) | ✅ runs → ⛔ stops at first real wall | input validation, auth, routing, `handleWithdrawal` all execute; stops at `getPlatformSessionToken` |
| 6 | Paj Cash platform session | ⛔ blocked (external) | `No active Paj Cash session — admin must run pajCashInitiate + pajCashVerify` (`paj-cash.ts:74`) |
| 7 | On-chain SPL transfer | ⛔ not reached | wallet balance 0; would fail at `sendSplToken` even with a session |
| 8 | History / transaction reads | ⛔ broken (Finding 2) | the webhook *write* succeeds (sets no missing column), but read paths (`getUserTransactions`, swap poller) hit the missing-column bug |

No orphan/partial rows were written: `fiat_requests = 0` after the failed withdraw (the order call throws before `insertFiatRequest`).

## Findings (real issues, not just missing creds)

### Finding 1 — The off-ramp is NOT private (pre-existing, ARCHITECTURE.md issue #3)
`flows.ts::handleWithdrawal` (line 75) does a plain `sendSplToken` from the user's **public** ATA. There is no `unshieldEncryptedBalance` step pulling from the Umbra encrypted balance first. So even if every external wall were cleared, the off-ramp would leak the amount on-chain — there is **no private off-ramp in the code yet to verify**. (The on-ramp *appears* to end private — the webhook calls `shieldPublicBalance` on `ON_RAMP COMPLETED` — but this is **read from code, not exercised**; `flow.deposit` was not driven in this run.)

**Scope note:** only the off-ramp was driven. The deposit / on-ramp flow (`flow.deposit`) was not exercised. If the goal's "offramping and private offramping" meant on-ramp too, that path is still uncovered.

### Finding 2 — Schema drift: `user_transactions` missing columns (DB not migrated)
The code schema (`drizzle/schema.ts`) declares `nearIntentDepositAddress` + `nearIntentDepositMemo` and index `idx_pending_swaps`, but the live `user_transactions` table has neither. Effects observed:
- `[SwapPoller] Tick failed: column "nearIntentDepositAddress" does not exist` — crashes every poll tick.
- Any transaction-history read (`getUserTransactions` selects those columns) will fail → History page broken, and the off-ramp's webhook `insertUserTransaction`/read-back path is broken.

Fix: run `npm run db:push` (drizzle-kit generate + migrate) to apply the latest schema. (Not done here — out of "no changes" scope.)

### Finding 3 — Sessions break when `VITE_APP_ID` is unset
`ENV.appId = process.env.VITE_APP_ID ?? ""`. With it unset, `createSessionToken` mints a JWT carrying `appId=""`, which `verifySession` rejects (`[Auth] Session payload missing required fields`). Because the OAuth callback uses the **same** `createSessionToken`, a successful real login would also mint an unusable session. So auth is fully broken locally until `VITE_APP_ID` is set — independent of the OAuth-portal wall. I added `VITE_APP_ID=fluxa-local` to `.env` to proceed past this gate.

### Finding 4 — Latent unit bug in the off-ramp transfer (one wall past where it stopped)
`handleWithdrawal` calls `sendSplToken({ amount: BigInt(Math.floor(input.usdtAmount)) })`. `sendSplToken` passes that value as **raw base units** to `createTransferInstruction` (no decimal scaling). USDC/USDT have 6 decimals, so a "5 USDC" withdrawal would transfer `5` base units = **0.000005 USDC**. This would surface immediately once a Paj Cash session exists. Fix: scale by `10 ** mintDecimals` before the transfer.

## External preconditions still required for a true money E2E
1. `OAUTH_SERVER_URL` + a real account (real "wallet connect" login).
2. A Paj Cash platform session via admin `pajCashInitiate` + `pajCashVerify` (real OTP to platform email).
3. On-chain USDC funded into the user's devnet wallet.
4. A reachable inbound webhook (`/api/webhooks/paj-cash`) for `OFF_RAMP COMPLETED`.

## Verdict
The local backend chain **wallet/session → wallet provisioning → off-ramp orchestration** works and was exercised end-to-end via the real tRPC procedures. The off-ramp stops at the first genuine wall (no Paj Cash session). A *private* off-ramp cannot be verified because it isn't implemented yet (Finding 1), and full completion/history is blocked by un-applied migrations (Finding 2). Two local config/wiring gaps (Findings 2, 3) and one missing feature (Finding 1) stand between the current state and a real private off-ramp.

## Cleanup notes
- Temp seed script removed.
- Test user (`openId=verify-e2e-0001`, id 1) + its wallet remain in the local DB; delete if undesired.
- `.env` change: added `VITE_APP_ID=fluxa-local` (Finding 3). Revert if not wanted.
