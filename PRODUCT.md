# FluxaX V2: Product Documentation

## 1. Product Overview
FluxaX V2 is a multichain, privacy-first Fiat-to-Crypto (NGN ↔ Crypto) bridge and universal asset router. While it leverages the Solana blockchain for fast backend settlement and privacy routing, its core feature is seamless **multichain interoperability**. It abstracts away the complexities of chain selection, decentralized exchange (DEX) routing, and bridging mechanics, allowing users to express simple financial intents (e.g., "Deposit ₦50,000", "Swap 100 TON to USDC", or "Withdraw 50 USDC to my bank").

The platform achieves this by orchestrating three core layers seamlessly on the backend:
- **Paj Cash**: Handles fiat settlement (NGN) directly via the `paj_ramp` SDK, acting as the bridge between Nigerian bank accounts and stablecoins.
- **Umbra Privacy**: Ensures on-chain privacy by encrypting user balances on the settlement layer and utilizing a UTXO mixer for anonymous transfers.
- **NEAR Intent (1Click)**: Serves as the universal cross-chain router and solver, enabling seamless token swaps across all supported blockchains.

## 2. Goals
- **Multichain Self-Custody**: Support native chain-specific wallet adapters (e.g., Solana Wallet Adapter, EVM/Wagmi, etc.) for all chains supported by NEAR Intent. Fall back to WalletConnect only when a native adapter is unavailable.
- **Simplicity**: Users interact with a clean, high-level intent interface. The server handles all underlying Web3 complexities.
- **Privacy by Default**: User funds rest in encrypted Solana balances via the Umbra protocol. Transactions and holdings are obscured from public on-chain observers.
- **Seamless Fiat Integration**: Instant onboarding and offboarding between NGN bank accounts and crypto stablecoins.
- **Universal Liquidity**: Access to any token on any chain through the NEAR Intent solver network.

## 3. Core Flows

### 3.1. Deposit Flow (Fiat to Crypto)
The deposit flow onramps users from their local bank to a shielded crypto balance.
1. **User Intent**: User requests to deposit NGN (e.g., ₦50,000).
2. **Fiat Settlement**: The backend creates an on-ramp order via the Paj Cash SDK, providing the user with a payment account/reference.
3. **Webhook Trigger**: Once the user transfers the fiat, Paj Cash confirms the payment and sends a `COMPLETED` webhook to FluxaX.
4. **Stablecoin Minting**: Stablecoins (USDC or USDT) are deposited into the user's public Solana address.
5. **Privacy Shielding**: The backend automatically sweeps the public stablecoins into the user's Umbra Encrypted Token Account (ETA), hiding the balance from public view.

### 3.2. Withdrawal Flow (Crypto to Fiat)
The withdrawal flow offramps users from their shielded crypto balance directly to their local bank.
1. **User Intent**: User requests to withdraw a specific amount of stablecoin to their NGN bank account.
2. **Unshielding**: The backend invokes the Umbra SDK to unshield the requested amount directly from the user's encrypted balance to a designated Paj Cash off-ramp address.
3. **Fiat Settlement**: An off-ramp order is created via the Paj Cash SDK, providing the user's bank details.
4. **Fulfillment**: Paj Cash receives the stablecoins on Solana and wires the equivalent NGN to the user's bank account.

### 3.3. Swap Flow (Cross-Chain Routing)
The swap flow allows users to exchange their shielded assets for any supported token on any chain.
1. **User Intent**: User requests to swap an asset (e.g., shielded USDC on Solana to Base ETH).
2. **Quote Generation**: The backend queries the NEAR Intent (1Click) API for a quote and receives a solver deposit address on Solana.
3. **Execution**:
   - **Public Swap**: The backend transfers funds from the user's public wallet to the solver's deposit address.
   - **Private Swap**: The backend dynamically generates an ephemeral wallet, unshields the required funds from the user's Umbra encrypted balance to the ephemeral wallet, and instructs the solver to settle the destination asset to a designated recipient address.
4. **Fulfillment**: The NEAR Intent solver detects the origin deposit and releases the destination asset to the user on the target chain.

### 3.4. Anonymous Transfer Flow (UTXO Mixer)
The anonymous transfer flow allows users to send funds to other users without leaving a traceable on-chain link.
1. **User Intent**: User requests to send funds anonymously to a recipient's public key.
2. **UTXO Creation**: The sender unshields funds from their encrypted balance into a new, single-use UTXO via the Umbra protocol.
3. **UTXO Scanning**: The recipient's client scans the blockchain for UTXOs encrypted with their public key.
4. **Claiming**: The recipient claims the UTXO using a Zero-Knowledge (ZK) proof, sweeping the funds directly into their own Umbra encrypted balance without revealing the sender's identity.
