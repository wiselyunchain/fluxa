# MVP Completion Todo List

- [x] **Task 1: Resolve `@umbra-privacy/web-zk-prover` mismatch & Backend Procedures**
  - Fix peer dependency conflict for `@umbra-privacy/web-zk-prover`.
  - Implement `createReceiverClaimableUtxo` (send) and `claimUtxoToEncryptedBalance` (claim) in `server/services/umbra.ts`.
  - Expose `umbra.send` and `umbra.claim` tRPC procedures.

- [x] **Task 2: Build `Swap.tsx` Frontend Page**
  - Create UI for swapping tokens.
  - Integrate `getSupportedTokens` query for asset selection.
  - Integrate quote-preview query.
  - Wire up `flow.swap` execution.

- [x] **Task 3: Build `AnonymousTransfer.tsx` Frontend Page**
  - Create UI for the stealth address/UTXO inbox.
  - Wire `umbra.listClaimable` and `umbra.withdraw`.
  - Integrate `umbra.send` and `umbra.claim` for full anonymous transfers.

- [x] **Task 4: Build Umbra-in / Umbra-out Swap Variant**
  - Add backend logic for privacy-preserving routing (withdraw from encrypted balance → swap → shield output).
  - Add UI support for private swaps in `Swap.tsx`.

- [x] **Task 5: Build Admin Sub-Pages**
  - `UserManagement`
  - `TransactionMonitoring`
  - `ComplianceLogging`
  - `ViewingGrants`

- [ ] **Task 6: E2E, Security, & MVP Confidence Check**
  - Run the application and use `playwright-cli` to visually inspect and interact with the UI.
  - Verify zero "money disappearance" risks (e.g., proper scaling, error handling during transfers, timeouts).
  - Confirm the system meets the bar for MVP testing by a few users.
