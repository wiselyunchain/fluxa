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
  pajCashApiUrl: process.env.PAJ_CASH_API_URL ?? "https://api.paj.cash",
  pajCashApiKey: process.env.PAJ_CASH_API_KEY ?? "",
  // App
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
};
