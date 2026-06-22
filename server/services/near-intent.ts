import { ENV } from "../_core/env";

export type QuoteStatus =
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export interface QuoteRequest {
  dry?: boolean;
  swapType?: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance: number; // basis points (100 = 1%)
  originAsset: string;       // e.g. nep141:sol-...omft.near
  destinationAsset: string;
  amount: string;            // integer string in base units
  refundTo: string;
  refundType?: "ORIGIN_CHAIN" | "INTENTS";
  recipient: string;
  recipientType?: "DESTINATION_CHAIN" | "INTENTS";
  depositType?: "ORIGIN_CHAIN" | "INTENTS";
  deadline: string;          // ISO 8601
}

export interface Quote {
  depositAddress: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted?: string;
  amountInUsd?: string;
  minAmountIn?: string;
  amountOut: string;
  amountOutFormatted?: string;
  amountOutUsd?: string;
  minAmountOut?: string;
  deadline: string;
  timeWhenInactive?: string;
  timeEstimate?: number;
}

export interface QuoteResponse {
  correlationId: string;
  timestamp: string;
  signature?: string;
  quoteRequest: QuoteRequest;
  quote: Quote;
}

export interface ExecutionStatusResponse {
  correlationId: string;
  status: QuoteStatus;
  updatedAt: string;
  quoteResponse?: QuoteResponse;
  swapDetails?: Record<string, unknown>;
}

export interface SupportedToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: string;
  priceUpdatedAt?: string;
  contractAddress?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class NearIntentClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts?: { baseUrl?: string; apiKey?: string; fetchImpl?: FetchLike }) {
    this.baseUrl = (opts?.baseUrl ?? ENV.nearIntentApiUrl).replace(/\/$/, "");
    this.apiKey = opts?.apiKey ?? ENV.nearIntentApiKey;
    this.fetchImpl = opts?.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async quote(req: QuoteRequest): Promise<QuoteResponse> {
    return this.request<QuoteResponse>("POST", "/quote", req);
  }

  async status(depositAddress: string, depositMemo?: string): Promise<ExecutionStatusResponse> {
    const qs = new URLSearchParams({ depositAddress });
    if (depositMemo) qs.set("depositMemo", depositMemo);
    return this.request<ExecutionStatusResponse>("GET", `/status?${qs.toString()}`);
  }

  async submitDeposit(input: {
    txHash: string;
    depositAddress: string;
    nearSenderAccount?: string;
    memo?: string;
  }): Promise<ExecutionStatusResponse> {
    return this.request<ExecutionStatusResponse>("POST", "/deposit/submit", input);
  }

  async supportedTokens(): Promise<SupportedToken[]> {
    return this.request<SupportedToken[]>("GET", "/tokens");
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`NEAR Intent ${method} ${path} failed: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  }
}

let nearIntentClient: NearIntentClient | null = null;

export function getNearIntentClient(): NearIntentClient {
  if (!nearIntentClient) nearIntentClient = new NearIntentClient();
  return nearIntentClient;
}

// Test seam so tests can inject a client without monkey-patching modules.
export function setNearIntentClient(client: NearIntentClient | null): void {
  nearIntentClient = client;
}

// Common assetId prefix for Solana SPL tokens routed through the omft bridge.
// The token list is authoritative; this is just a convenience constant.
export const SOLANA_ASSET_PREFIX = "nep141:sol-";
