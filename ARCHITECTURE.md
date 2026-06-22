# FluxaX V2 Architecture

> Single source of truth, replacing `ARCHITECTURE_V2_FINAL.md`, `ARCHITECTURE_V2_CORRECTED.md`, `ARCHITECTURE_V2_PRIVACY_FIRST.md`, and `ARCHITECTURE_SUMMARY_V2.md`. Sections are tagged ✅ implemented · 🟡 partial · ⬜ planned so the doc tells the truth about what is wired up. If you change code and the state shifts, change the tag.

## Executive summary

FluxaX V2 is a privacy-first NGN ↔ crypto bridge built on Solana. Users express simple intents (deposit naira, withdraw to bank, swap any token to any token). The server orchestrates three external services so the user never sees chain selection, DEX routing, or bridge mechanics:

- **NEAR Intent (1Click)** — universal cross-chain router. Solver quotes + deposit-address handoff.
- **Umbra** — on-chain privacy via encrypted balances + a UTXO mixer for anonymous transfers.
- **Paj Cash** — fiat settlement; the `paj_ramp` SDK handles bank → Solana on-ramp and Solana → bank off-ramp directly. No Paystack in V2.

Settlement happens on Solana in a USD-pegged stablecoin (USDC and USDT both accepted as the user's chosen settle mint — see §Settlement asset).

---

## Three-layer model

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: User intent                                        │
│  "Deposit ₦50,000" / "Withdraw 50 USDC to bank" /           │
│  "Swap 100 TON to USDC" / "Send 20 USDC anonymously"        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: NEAR Intent (1Click) — universal router            │
│  - quote(originAsset, destinationAsset, amount, ...)        │
│  - solver returns a deposit address on the origin chain     │
│  - server transfers tokens to that address                  │
│  - solver settles to the recipient on the destination chain │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Solana settlement + privacy                        │
│  - SPL stablecoin (USDC or USDT) is the settle asset        │
│  - Umbra encrypts the on-chain balance after settlement     │
│  - Paj Cash converts NGN ↔ stablecoin via paj_ramp SDK      │
└─────────────────────────────────────────────────────────────┘
```

Users see Layer 1. Everything else is server-side.

---

## Components

### 1. NEAR Intent (1Click) — ✅ implemented

`server/services/near-intent.ts` is a REST client for `https://1click.chaindefuser.com/v0` (override with `NEAR_INTENT_API_URL`).

| Endpoint | Purpose |
|---|---|
| `POST /quote` | Quote a conversion; returns `{ correlationId, quote: { depositAddress, depositMemo?, amountIn, amountOut, deadline, … } }`. |
| `POST /deposit/submit` | Best-effort tip the solver that the deposit has hit Solana. |
| `GET /status?depositAddress=…` | Poll execution state (`PENDING_DEPOSIT → PROCESSING → SUCCESS \| REFUNDED \| FAILED`). |
| `GET /tokens` | Solver's supported asset list. AssetIds use the `nep141:…` prefix (e.g. `nep141:sol-...omft.near` for Solana SPL). |

Auth: `X-API-Key` header (`NEAR_INTENT_API_KEY`, optional in staging).

Quote shape from `server/services/near-intent.ts`:

```typescript
const quote = await client.quote({
  swapType: "EXACT_INPUT",
  slippageTolerance: 100,            // bps
  originAsset: "nep141:sol-...omft.near",
  destinationAsset: "nep141:base-...omft.near",
  amount: "1000000",                  // base units, integer string
  depositType: "ORIGIN_CHAIN",
  refundType: "ORIGIN_CHAIN",
  refundTo: userMainAddress,
  recipientType: "DESTINATION_CHAIN",
  recipient: userMainAddress,
  deadline: new Date(Date.now() + 600_000).toISOString(),
});
```

### 2. Umbra — ✅ implemented (without claim flow)

`server/services/umbra.ts` uses `@umbra-privacy/sdk@4.0.0`. Client construction goes through the factory + cached per-keypair:

```typescript
const signer = await createSignerFromPrivateKeyBytes(secretKey);
const client = await getUmbraClient({
  signer,
  network: "devnet" | "mainnet" | "localnet",
  rpcUrl: ENV.solanaRpcUrl,
  rpcSubscriptionsUrl: ENV.solanaRpcSubscriptionsUrl,
  indexerApiEndpoint: ENV.umbraIndexerEndpoint || undefined,
});
```

Two privacy primitives:

#### Encrypted balances (confidential mode) — ✅
Tokens move between the user's public ATA and an Encrypted Token Account (ETA). On-chain observers see a transaction; the amount is encrypted via Arcium MPC + X25519. Implemented through:

- `getPublicBalanceToEncryptedBalanceDirectDepositorFunction({ client })` → `shieldPublicBalance(...)`
- `getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({ client })` → `unshieldEncryptedBalance(...)`

Bookkeeping rides on `umbra_encrypted_balances` (idempotent delta upsert keyed by `userId + tokenMint`).

#### UTXO mixer (anonymous mode) — 🟡 scan implemented, claim ⬜

- `getClaimableUtxoScannerFunction({ client })` is wired; `scanIncomingUtxos(...)` persists receiver-claimable UTXOs into `umbra_utxos` (idempotent on commitment hash).
- The claim step (`getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction` + `@umbra-privacy/web-zk-prover`) is **not wired**. Blocker: prover v2.0.1 declares a peer-dep on `@umbra-privacy/sdk@2.0.3` while the lockfile has `4.0.0`. Either pin a matching pair or wait for prover v4 to land.

**Fees** (Umbra protocol): 35 bps. Mixer UTXO creation also pays ~0.0005 SOL one-time rent.

**Supported tokens (constant)**: USDC, USDT, wSOL, UMBRA — declared in `UMBRA_SUPPORTED_TOKENS` at the bottom of `server/services/umbra.ts`.

### 3. Paj Cash (`paj_ramp` SDK) — ✅ implemented

`server/services/paj-cash.ts` wraps `paj_ramp` directly — no Paystack. Two pieces:

#### Platform session lifecycle — ✅
The SDK uses a **per-platform session token** issued via an OTP exchange. The token is encrypted at rest in `paj_cash_sessions` and decrypted on each order call. There is no per-user OAuth flow on the Paj Cash side; FluxaX holds one platform session and creates orders on behalf of users.

```typescript
// One-time (admin tRPC): initiate sends an OTP to email
await initiate(email, ENV.pajCashApiKey);

// One-time (admin tRPC): verify exchanges OTP for a session token
const { token, expiresAt } = await verify(email, otp, PLATFORM_DEVICE, ENV.pajCashApiKey);
// token is AES-256-GCM encrypted and upserted into paj_cash_sessions
```

#### Order creation — ✅
```typescript
// On-ramp (NGN → stablecoin to user's Solana address)
const order = await createOnrampOrder({
  fiatAmount,
  currency: Currency.NGN,
  recipient: userMainAddress,
  mint: ENV.pajCashUsdcMint,         // USDC or USDT mint
  chain: Chain.SOLANA,
  webhookURL: ENV.pajCashWebhookUrl,
}, token);

// Off-ramp (stablecoin → NGN to user's bank)
const order = await createOfframpOrder({
  bank: bankId,
  accountNumber,
  currency: Currency.NGN,
  amount: stablecoinAmount,
  mint: ENV.pajCashUsdcMint,
  chain: Chain.SOLANA,
  webhookURL: ENV.pajCashWebhookUrl,
}, token);
```

Read-through helpers exposed: `listBanks()`, `resolveAccount(bankId, accountNumber)`, `getRates()`.

#### Webhook receiver — 🟡 functional, no signature verification

`POST /api/webhooks/paj-cash` (registered from `server/routes/paj-cash-webhook.ts` via `server/_core/index.ts`). Body shape:

```typescript
{
  id: string;                                                     // paj_ramp reference
  status: "INIT" | "PAID" | "COMPLETED" | "FAILED" | "CANCELLED";
  transactionType: "ON_RAMP" | "OFF_RAMP";
  amount?: number;
  fiatAmount?: number;
  mint?: string;
  …
}
```

Status mapping: `INIT → pending`, `PAID → processing`, `COMPLETED → confirmed`, `FAILED|CANCELLED → failed`. On `ON_RAMP COMPLETED` the route calls `shieldPublicBalance(...)` to encrypt the inbound stablecoin and writes a `user_transactions` row. On `OFF_RAMP COMPLETED` it writes a withdrawal row.

⬜ **Open**: there is no HMAC/signature verification on the webhook. Anyone who guesses a `paj_ramp` reference id can flip a request status. Must be addressed before mainnet (`paj_ramp` should expose a signing secret; mirror the verify step into the route).

### 4. Solana wallet + transfer plumbing — ✅

- `server/utils/wallet-crypto.ts` — AES-256-GCM via `WALLET_ENCRYPTION_KEY`. Used for keypair material *and* the Paj Cash session token.
- `server/utils/solana-transfer.ts` — `sendSplToken({ fromWallet, toAddress, mint, amount })` using `@solana/web3.js`.
- `server/services/rpc-provider.ts` — multi-chain balance/gas helpers (kept from V1 for the `userWallets` non-Solana rows used in NEAR Intent quoting; trim if those chains are dropped).

---

## Settlement asset — USDC and USDT (user-selectable)

Both Circle's USDC and Tether's USDT on Solana are accepted as the settle mint:

| Token | Mint (mainnet) | Status |
|---|---|---|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | ✅ default in env (`PAJ_CASH_USDC_MINT`) |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | ⬜ planned: enable as a user-selectable alternative |

⬜ **Code delta required** for "user-selectable":
- Generalise `ENV.pajCashUsdcMint` into `ENV.pajCashAcceptedMints` (list) or rename + add a sibling for USDT; today the env is single-mint.
- Add a `mint` field on the deposit/withdrawal flow inputs; default to USDC, allow USDT.
- Update the webhook to trust `body.mint` rather than falling back to the env default.
- UI: mint selector on Deposit / Withdraw pages.

Why a stablecoin (either): preserves value across the NGN ↔ chain hop; Umbra has full encrypted-balance support for both mints; Paj Cash quotes against either.

---

## User flows

### Deposit (NGN → private stablecoin) — 🟡

Implemented in `server/services/flows.ts::handleDeposit`. Webhook completes the loop.

```
1. User: "Deposit ₦50,000"  [pick mint: USDC | USDT]
2. handleDeposit
   ├── createOnrampOrder({fiatAmount, recipient=userMainAddress, mint, chain=SOLANA, webhookURL})
   ├── insertFiatRequest({type:"deposit", amount, currency:"NGN", pajCashReference, status:"pending"})
   └── return { reference, accountNumber, accountName, bank, fiatAmount, usdtAmount, rate, fee, mint }
3. User transfers NGN to the returned bank account
4. paj_ramp sends stablecoin to userMainAddress on Solana
5. Webhook: ON_RAMP / COMPLETED
   ├── shieldPublicBalance({userWallet, tokenMint, transferAmount})  ← Umbra encrypts the inbound balance
   ├── upsertUmbraEncryptedBalance(+amount)
   └── insertUserTransaction({type:"deposit", status:"confirmed", toChain:"SOLANA", …})
```

⬜ Frontend: `Deposit.tsx` exists but needs a mint selector once dual-mint lands.

### Withdrawal (private stablecoin → NGN) — 🟡

`server/services/flows.ts::handleWithdrawal`. The current code does an unshielded SPL transfer from `mainAddress` to Paj Cash's quoted address; ideally the unshield step happens explicitly first.

```
1. User: "Withdraw 50 USDC to bank [bankId, accountNumber]"
2. handleWithdrawal
   ├── createOfframpOrder({bank, accountNumber, currency:NGN, amount, mint, chain, webhookURL})
   ├── insertFiatRequest({type:"withdrawal", amount=order.fiatAmount, …, pajCashReference, status:"pending"})
   ├── sendSplToken({fromWallet, toAddress=order.address, mint, amount})    ← public ATA → Paj Cash
   └── return { reference, transferSignature, pajCashAddress, fiatAmount, rate, fee }
3. paj_ramp converts and settles to user's bank
4. Webhook: OFF_RAMP / COMPLETED → insertUserTransaction({type:"withdrawal", status:"confirmed", …})
```

🟡 The withdrawal source is the user's public ATA, not the encrypted balance. To stay private end-to-end, prepend an `unshieldEncryptedBalance(...)` step that moves funds from the ETA into the public ATA right before the transfer — or wire the encrypted-direct-to-recipient path if Umbra supports it. (`unshieldEncryptedBalance` is already implemented; just not called from `handleWithdrawal`.)

### Swap (any token → any token via 1Click) — ✅

`server/services/flows.ts::handleSwap` is the closest thing in the repo to a real user flow today.

```
1. User: "Swap 100 TON → USDC on Solana"
2. handleSwap
   ├── client.quote({originAsset, destinationAsset, amount, ...})  → { correlationId, quote: { depositAddress, … } }
   ├── sendSplToken({fromWallet, toAddress=depositAddress, mint=fromMintAddress, amount})
   ├── insertUserTransaction({type:"swap", status:"pending", nearIntentId=correlationId, nearIntentDepositAddress, …})
   └── client.submitDeposit({txHash, depositAddress})   ← best-effort tip; solver also watches deposit address
3. Solver settles destinationAsset to recipient on the destination chain
4. ⬜ Status reconciliation: poll /status by depositAddress (server/services/swap-poller.ts is the place)
```

⬜ Post-swap composition: an SPL settlement that lands on Solana should typically chain into `shieldPublicBalance(...)` so the user's resulting balance is encrypted by default. Not wired today.

### Anonymous transfer (UTXO mixer) — ⬜

Schema (`umbra_utxos`) and the scanner (`scanIncomingUtxos`) are in place. What's missing:

- Creator function `getPublicBalanceToReceiverClaimableUtxoCreatorFunction({ client }, { zkProver })` to mint a UTXO into the Merkle tree.
- Claim function `getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction({ client }, { zkProver, relayer })` for the recipient.
- Both need `@umbra-privacy/web-zk-prover` — currently has a peer-dep mismatch with `@umbra-privacy/sdk@4.0.0` (see §Open issues).
- Frontend `AnonymousTransfer.tsx` (does not exist).

---

## Database schema — Postgres, ✅

`drizzle/schema.ts` uses `drizzle-orm/pg-core` (dialect `postgresql`). MySQL is gone. Tables present in HEAD:

| Table | Purpose |
|---|---|
| `users` | Identity / role. |
| `solana_wallets` | One Solana keypair per user. `mainKeypair` is AES-256-GCM encrypted via `WALLET_ENCRYPTION_KEY`. |
| `user_transactions` | Append-only user-facing history. Written by webhook (deposits/withdrawals) and `handleSwap`. |
| `fiat_requests` | NGN side of deposits/withdrawals. `pajCashReference` is the join key with the `paj_ramp` order id. |
| `paj_cash_sessions` | Encrypted platform session token + `expiresAt`. Loaded on every order call. |
| `umbra_encrypted_balances` | Per `(userId, tokenMint)` running delta tracking what Umbra holds. |
| `umbra_utxos` | Persisted mixer UTXOs (commitment, mint, amount, type) for scan idempotency. |
| `risk_flags` / `audit_logs` | Admin compliance surface. |
| `solana_stealth_addresses` | ⬜ **Dead table** — no flow writes to it. Either delete or wire it. |

Conventions: `numeric(20, 8)` for token amounts (was `decimal` under MySQL), `timestamp().$onUpdate(...)` for `updatedAt` (PG doesn't have `ON UPDATE CURRENT_TIMESTAMP`), enums as `pgEnum`.

---

## Privacy model

| Entity | Knows | Does not know |
|---|---|---|
| User | Their intent; balance (after local decrypt); transaction history. | Internal solver routing; other users' data. |
| Paj Cash | NGN amount, user's bank account (off-ramp), platform identity. | Other on-chain history; encrypted balances. |
| NEAR Intent solver | Asset conversions on the route. | User identity; what happens after settlement. |
| Solana blockchain | Encrypted balances exist; transactions occurred. | Settled amounts (encrypted by Umbra); mixer sender↔recipient link. |
| Umbra MPC network | Encrypted balance fragments. | Plaintext amounts; user identity. |
| FluxaX server | User identity; references to encrypted balances; audit trail. | Plaintext on-chain amounts (without the user's key); mixer linkage if anonymous transfers are used. |

Compliance: a server-side audit trail (`audit_logs`, `risk_flags`) is preserved even when the on-chain transaction is private. Umbra supports viewing grants for auditors — not wired yet.

---

## Environment

From `server/_core/env.ts`:

```
DATABASE_URL                          Postgres connection string
JWT_SECRET                            Session cookie signing
WALLET_ENCRYPTION_KEY                 AES-256-GCM key for keypair + Paj Cash token at rest
APP_BASE_URL                          Public base URL (used in webhookURL composition)

SOLANA_RPC_URL                        https://api.devnet.solana.com (default)
SOLANA_RPC_SUBSCRIPTIONS_URL          wss://api.devnet.solana.com (default)
SOLANA_NETWORK                        devnet | mainnet | localnet

UMBRA_INDEXER_ENDPOINT                https://indexer.umbra.cash (default)
UMBRA_RELAYER_ENDPOINT                https://relayer.umbra.cash (default)

PAJ_CASH_API_KEY                      issued by paj_ramp (no checked-in default)
PAJ_CASH_ENVIRONMENT                  Staging | Production | Local
PAJ_CASH_WEBHOOK_URL                  e.g. https://<APP_BASE_URL>/api/webhooks/paj-cash
PAJ_CASH_USDC_MINT                    EPjFW... (USDC mainnet default). ⬜ becomes a list once dual-mint lands.

NEAR_INTENT_API_URL                   https://1click.chaindefuser.com/v0 (default)
NEAR_INTENT_API_KEY                   optional in staging
```

`.env*` is gitignored (`.gitignore`). The `paj_ramp` key (the one you handed me, `78603020-…`) goes into a local `.env` as `PAJ_CASH_API_KEY=…` — never committed.

---

## Open issues / known gaps

| # | Issue | Where | Severity |
|---|---|---|---|
| 1 | No webhook signature verification | `server/routes/paj-cash-webhook.ts` | High — must fix before mainnet |
| 2 | Umbra ZK prover peer-dep mismatch (`web-zk-prover@2.0.1` ↔ `sdk@4.0.0`) | `package.json` | High — blocks mixer claim + UTXO creation |
| 3 | Withdrawal pulls from public ATA, not the encrypted balance | `flows.ts::handleWithdrawal` | Medium — leaks the off-ramp amount on-chain |
| 4 | Swap result lands in public ATA, not encrypted | `flows.ts::handleSwap` | Medium — defeats privacy for swap-then-hold |
| 5 | `solana_stealth_addresses` table unused | `drizzle/schema.ts` | Low — delete or wire |
| 6 | `magic-block.ts` was deleted alongside this doc | — | Resolved |
| 7 | Dual-mint USDC/USDT not yet enabled in code | `env.ts`, `flows.ts`, `paj-cash-webhook.ts`, UI | Planned |
| 8 | Frontend: `Swap.tsx`, `AnonymousTransfer.tsx`, admin sub-pages | `client/src/pages/` | Planned |
| 9 | E2E + load + security audit | `server/tests/` (unit only today) | Planned |

---

## External references

- **Paj Cash SDK** — https://github.com/paj-cash/paj_ramp (npm: `paj_ramp`)
- **NEAR Intent 1Click** — https://docs.near-intents.org/
- **Umbra SDK** — `@umbra-privacy/sdk@4.0.0` (factory-function API)
- **Solana docs** — https://docs.solana.com/

---

## Document conventions

- ✅ implemented — wired through to the relevant external service, tested.
- 🟡 partial — code exists but a gap is named in §Open issues.
- ⬜ planned — described in this doc as the target state, not in the codebase yet.

When a tag changes, update this doc in the same commit. A divergence between code and architecture doc is what produced the original four-doc mess; don't recreate it.
