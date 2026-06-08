import { describe, expect, it, vi, beforeEach } from "vitest";
import { NearIntentClient, type QuoteRequest } from "./near-intent";

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function makeFetch(responses: Array<{ status?: number; json?: unknown; text?: string }>) {
  const calls: CapturedCall[] = [];
  let i = 0;
  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    const r = responses[i++] ?? { status: 200, json: {} };
    calls.push({
      url: input,
      method: init?.method ?? "GET",
      headers: (init?.headers as Record<string, string>) ?? {},
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.json,
      text: async () => r.text ?? "",
    } as unknown as Response;
  };
  return { fetchImpl, calls };
}

const baseUrl = "https://1click.test/v0";

const SAMPLE_QUOTE_REQ: QuoteRequest = {
  swapType: "EXACT_INPUT",
  slippageTolerance: 100,
  originAsset: "nep141:sol-usdc.omft.near",
  destinationAsset: "nep141:arb-usdc.omft.near",
  amount: "1000000",
  depositType: "ORIGIN_CHAIN",
  refundType: "ORIGIN_CHAIN",
  refundTo: "SoLanaAddr111",
  recipientType: "DESTINATION_CHAIN",
  recipient: "0xArbAddr",
  deadline: "2099-01-01T00:00:00Z",
};

const SAMPLE_QUOTE_RESP = {
  correlationId: "corr-123",
  timestamp: "2026-06-05T00:00:00Z",
  quoteRequest: SAMPLE_QUOTE_REQ,
  quote: {
    depositAddress: "SoLanaDepositAddr",
    amountIn: "1000000",
    amountInFormatted: "1.0",
    amountOut: "990000",
    amountOutFormatted: "0.99",
    deadline: "2099-01-01T00:00:00Z",
  },
};

describe("NearIntentClient", () => {
  let captured: CapturedCall[] = [];

  beforeEach(() => {
    captured = [];
  });

  it("POST /quote with X-API-Key and JSON body", async () => {
    const { fetchImpl, calls } = makeFetch([{ json: SAMPLE_QUOTE_RESP }]);
    captured = calls;
    const client = new NearIntentClient({ baseUrl, apiKey: "secret", fetchImpl });

    const res = await client.quote(SAMPLE_QUOTE_REQ);

    expect(res.correlationId).toBe("corr-123");
    expect(res.quote.depositAddress).toBe("SoLanaDepositAddr");
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(`${baseUrl}/quote`);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].headers["X-API-Key"]).toBe("secret");
    expect(captured[0].headers["Content-Type"]).toBe("application/json");
    const sent = JSON.parse(captured[0].body!);
    expect(sent.originAsset).toBe(SAMPLE_QUOTE_REQ.originAsset);
    expect(sent.amount).toBe("1000000");
  });

  it("omits X-API-Key when no key is configured", async () => {
    const { fetchImpl, calls } = makeFetch([{ json: SAMPLE_QUOTE_RESP }]);
    captured = calls;
    const client = new NearIntentClient({ baseUrl, apiKey: "", fetchImpl });

    await client.quote(SAMPLE_QUOTE_REQ);

    expect(captured[0].headers["X-API-Key"]).toBeUndefined();
  });

  it("GET /status appends depositAddress and depositMemo", async () => {
    const { fetchImpl, calls } = makeFetch([
      { json: { correlationId: "c", status: "PROCESSING", updatedAt: "now" } },
    ]);
    captured = calls;
    const client = new NearIntentClient({ baseUrl, apiKey: "k", fetchImpl });

    const res = await client.status("DEP_ADDR", "memo-42");

    expect(res.status).toBe("PROCESSING");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].url).toContain(`${baseUrl}/status?`);
    expect(captured[0].url).toContain("depositAddress=DEP_ADDR");
    expect(captured[0].url).toContain("depositMemo=memo-42");
  });

  it("POST /deposit/submit with txHash", async () => {
    const { fetchImpl, calls } = makeFetch([
      { json: { correlationId: "c", status: "KNOWN_DEPOSIT_TX", updatedAt: "now" } },
    ]);
    captured = calls;
    const client = new NearIntentClient({ baseUrl, apiKey: "k", fetchImpl });

    await client.submitDeposit({ txHash: "tx-99", depositAddress: "DEP_ADDR" });

    expect(captured[0].url).toBe(`${baseUrl}/deposit/submit`);
    expect(captured[0].method).toBe("POST");
    const sent = JSON.parse(captured[0].body!);
    expect(sent).toEqual({ txHash: "tx-99", depositAddress: "DEP_ADDR" });
  });

  it("GET /tokens returns the array unwrapped", async () => {
    const { fetchImpl } = makeFetch([
      {
        json: [
          { assetId: "nep141:a", decimals: 6, blockchain: "sol", symbol: "USDC" },
        ],
      },
    ]);
    const client = new NearIntentClient({ baseUrl, apiKey: "k", fetchImpl });

    const tokens = await client.supportedTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].symbol).toBe("USDC");
  });

  it("throws with status and body when the API returns non-2xx", async () => {
    const { fetchImpl } = makeFetch([{ status: 400, text: "bad slippage" }]);
    const client = new NearIntentClient({ baseUrl, apiKey: "k", fetchImpl });

    await expect(client.quote(SAMPLE_QUOTE_REQ)).rejects.toThrow(/400.*bad slippage/);
  });

  it("strips trailing slash from base URL", async () => {
    const { fetchImpl, calls } = makeFetch([{ json: SAMPLE_QUOTE_RESP }]);
    captured = calls;
    const client = new NearIntentClient({ baseUrl: `${baseUrl}/`, apiKey: "k", fetchImpl });

    await client.quote(SAMPLE_QUOTE_REQ);
    expect(captured[0].url).toBe(`${baseUrl}/quote`);
  });
});
