export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Solana RPC
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  solanaRpcSubscriptionsUrl: process.env.SOLANA_RPC_SUBSCRIPTIONS_URL ?? "wss://api.devnet.solana.com",
  solanaNetwork: process.env.SOLANA_NETWORK ?? "devnet",
  // Umbra
  umbraIndexerEndpoint: process.env.UMBRA_INDEXER_ENDPOINT ?? "https://indexer.umbra.cash",
  umbraRelayerEndpoint: process.env.UMBRA_RELAYER_ENDPOINT ?? "https://relayer.umbra.cash",
  // Paj Cash
  pajCashApiKey: process.env.PAJ_CASH_API_KEY ?? "",
  pajCashEnvironment: process.env.PAJ_CASH_ENVIRONMENT ?? "Staging",
  pajCashWebhookUrl: process.env.PAJ_CASH_WEBHOOK_URL ?? "",
  pajCashUsdcMint: process.env.PAJ_CASH_USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  // App
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  nearIntentApiUrl: process.env.NEAR_INTENT_API_URL ?? "https://1click.chaindefuser.com/v0",
  nearIntentApiKey: process.env.NEAR_INTENT_API_KEY ?? "",
  walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY ?? "",
};
