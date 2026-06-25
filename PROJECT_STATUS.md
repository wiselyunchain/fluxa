# FluxaX V2 — Project Status

> Snapshot at HEAD. Working tree clean. Tests: **92 / 92 passing** (10 files).

## What FluxaX is right now

A privacy-first NGN ↔ crypto bridge on Solana. The V1 multi-chain wallet / Paystack / LI.FI MVP was torn down in commit `240514f`. The **V2 scaffold** has been filled in significantly:
- Paj Cash (NGN settlement) is fully integrated using the real `paj_ramp` SDK, complete with a webhook receiver that drives state transitions and persists to Postgres.
- Umbra privacy is wired for both the deposit and withdrawal paths: deposits are shielded into the user's encrypted balance, and withdrawals directly unshield from the encrypted balance to the off-ramp address.

## Phase scorecard against the 16-week plan

Legend: ✅ done · 🟡 partial · 🔴 stub only · ⬜ not started

| Phase | Area | State |
|---|---|---|
| 1 | Foundation (schema, env, migrations) | ✅ — Schema is fully migrated to Postgres with V2 tables (`pajCashSessions`, `umbraEncryptedBalances`, `umbraUtxos`). Environment variables cover Umbra/Paj Cash/Solana/NEAR. |
| 2 | Umbra privacy | 🟡 — `shieldPublicBalance` and `unshieldEncryptedBalance` are fully implemented using `@umbra-privacy/sdk`. UTXO scanning is implemented. Receiver-claimable UTXO creation and claiming are blocked pending `@umbra-privacy/web-zk-prover` version mismatch resolution. |
| 3 | Paj Cash NGN settlement | ✅ — Fully implemented. Replaced hand-rolled client with `paj_ramp` SDK. Webhook route (`POST /api/webhooks/paj-cash`) handles state transitions. Admin OTP capture is built. |
| 4 | NEAR Intent routing | 🟡 — HTTP client implemented (`quote`, `status`, `submitDeposit`). Swap poller runs and updates statuses. Missing full Umbra integration (shielded-in → swap → shielded-out). |
| 5 | User flows & backend | 🟡 — Deposit, withdrawal, and swap flows implemented and write to `userTransactions` / `fiatRequests`. Anonymous transfer flow (UTXO mixer) not started. |
| 6 | Frontend | 🟡 — Core pages present. **Missing**: `Swap.tsx`, `AnonymousTransfer.tsx`, admin sub-pages (`UserManagement`, `TransactionMonitoring`, `ComplianceLogging`, `ViewingGrants`). |
| 7 | Testing & security | 🔴 — no E2E suite, no security/privacy audit, no load tests, no deployment runbook. |

## What's left

- **Phase 2 (Umbra):** Resolve `@umbra-privacy/web-zk-prover` ↔ `@umbra-privacy/sdk` peer-dep mismatch to unlock anonymous transfers (send + claim).
- **Phase 6 (Frontend):** Build `Swap.tsx`, `AnonymousTransfer.tsx`, and the four admin sub-pages.
- **Phase 7 (Security & E2E):** End-to-end loop verification on devnet + Paj Cash sandbox. Security and privacy reviews.

## External resources

- Paj Cash SDK: https://github.com/paj-cash/paj_ramp (npm: `paj_ramp`).
- NEAR Intent: https://docs.near-intents.org/
- Magic Block: https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/quickstart
- Umbra: `@umbra-privacy/sdk@4.0.0`.
