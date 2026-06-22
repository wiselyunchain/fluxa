import {
  getPendingSwapTransactions,
  updateUserTransactionStatus,
} from "../db";
import { getNearIntentClient, type QuoteStatus, type NearIntentClient } from "./near-intent";
import type { UserTransaction } from "../../drizzle/schema";

export interface SwapPollerOptions {
  intervalMs?: number;
  batchSize?: number;
}

export interface SwapPollerTickResult {
  scanned: number;
  settled: number;
  failed: number;
  errors: number;
}

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 100;

type TerminalUserStatus = "confirmed" | "failed";

function mapStatus(status: QuoteStatus): TerminalUserStatus | null {
  switch (status) {
    case "SUCCESS":
      return "confirmed";
    case "FAILED":
    case "REFUNDED":
      return "failed";
    case "KNOWN_DEPOSIT_TX":
    case "PENDING_DEPOSIT":
    case "INCOMPLETE_DEPOSIT":
    case "PROCESSING":
      return null;
    default:
      return null;
  }
}

async function settleOne(
  txn: UserTransaction,
  client: NearIntentClient,
): Promise<TerminalUserStatus | null> {
  if (!txn.nearIntentDepositAddress) return null;
  const res = await client.status(
    txn.nearIntentDepositAddress,
    txn.nearIntentDepositMemo ?? undefined,
  );
  const next = mapStatus(res.status);
  if (next === null) return null;

  await updateUserTransactionStatus({
    id: txn.id,
    status: next,
    confirmedAt: next === "confirmed" ? new Date() : undefined,
  });
  return next;
}

export async function runSwapPollerOnce(
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<SwapPollerTickResult> {
  const client = getNearIntentClient();
  const pending = await getPendingSwapTransactions(batchSize);

  let settled = 0;
  let failed = 0;
  let errors = 0;

  for (const txn of pending) {
    try {
      const next = await settleOne(txn, client);
      if (next === "confirmed") settled += 1;
      else if (next === "failed") failed += 1;
    } catch (err) {
      errors += 1;
      console.warn(`[SwapPoller] Failed to process txn #${txn.id}:`, err);
    }
  }

  return { scanned: pending.length, settled, failed, errors };
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startSwapPoller(opts: SwapPollerOptions = {}): void {
  if (intervalHandle) return;
  const interval = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  const tick = async () => {
    if (running) return; // skip overlapping ticks
    running = true;
    try {
      await runSwapPollerOnce(batchSize);
    } catch (err) {
      console.error("[SwapPoller] Tick failed:", err);
    } finally {
      running = false;
    }
  };

  intervalHandle = setInterval(tick, interval);
  // Don't keep the event loop alive solely for the poller.
  if (typeof intervalHandle.unref === "function") intervalHandle.unref();

  console.log(`[SwapPoller] Started (interval ${interval}ms, batch ${batchSize})`);
}

export function stopSwapPoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function _resetSwapPollerForTests(): void {
  stopSwapPoller();
  running = false;
}
