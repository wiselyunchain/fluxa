import type { Express, Request, Response } from "express";
import {
  getFiatRequestByReference,
  updateFiatRequestStatus,
  insertUserTransaction,
  getUserWallets,
} from "../db";
import { shieldPublicBalance } from "../services/umbra";
import { ENV } from "../_core/env";

type PajCashWebhookStatus = "INIT" | "PAID" | "COMPLETED" | "FAILED" | "CANCELLED";
type PajCashTransactionType = "ON_RAMP" | "OFF_RAMP";

interface PajCashWebhookBody {
  id?: string;
  status?: PajCashWebhookStatus;
  transactionType?: PajCashTransactionType;
  amount?: number;
  fiatAmount?: number;
  currency?: string;
  recipient?: string;
  mint?: string;
}

const STATUS_MAP = {
  INIT: "pending",
  PAID: "processing",
  COMPLETED: "confirmed",
  FAILED: "failed",
  CANCELLED: "failed",
} as const;

export function registerPajCashWebhook(app: Express): void {
  app.post("/api/webhooks/paj-cash", async (req: Request, res: Response) => {
    const body = req.body as PajCashWebhookBody;
    const ref = body.id;
    const status = body.status;
    const txType = body.transactionType;

    if (!ref || !status) {
      res.status(200).json({ received: true, ignored: "missing id or status" });
      return;
    }

    const fiatStatus = STATUS_MAP[status];
    if (!fiatStatus) {
      res.status(200).json({ received: true, ignored: `unknown status ${status}` });
      return;
    }

    try {
      const fiatRequest = await getFiatRequestByReference(ref);
      if (!fiatRequest) {
        console.warn(`[PajCash webhook] No fiat_request for reference ${ref} — ignoring`);
        res.status(200).json({ received: true, ignored: "no matching request" });
        return;
      }

      const confirmedAt = status === "COMPLETED" ? new Date() : undefined;
      await updateFiatRequestStatus(ref, fiatStatus, confirmedAt);

      if (status === "COMPLETED") {
        if (txType === "ON_RAMP") {
          const wallets = await getUserWallets(fiatRequest.userId);
          const wallet = wallets[0];
          const mint = body.mint ?? ENV.pajCashUsdcMint;
          const usdtAmount = (body.amount ?? 0).toString();

          if (wallet && body.amount) {
            try {
              await shieldPublicBalance({
                userWallet: wallet,
                tokenMint: mint,
                transferAmount: BigInt(Math.floor(body.amount)),
              });
            } catch (shieldErr) {
              console.error(`[PajCash webhook] Shielding failed for ${ref}:`, shieldErr);
            }
          }

          await insertUserTransaction({
            userId: fiatRequest.userId,
            type: "deposit",
            status: "confirmed",
            toChain: "SOLANA",
            toToken: mint,
            fromAmount: fiatRequest.amount,
            toAmount: usdtAmount,
            pajCashReference: ref,
            confirmedAt: new Date(),
          });
        } else if (txType === "OFF_RAMP") {
          await insertUserTransaction({
            userId: fiatRequest.userId,
            type: "withdrawal",
            status: "confirmed",
            fromChain: "SOLANA",
            fromToken: body.mint ?? ENV.pajCashUsdcMint,
            fromAmount: (body.amount ?? 0).toString(),
            toAmount: fiatRequest.amount,
            pajCashReference: ref,
            confirmedAt: new Date(),
          });
        }
      } else if (status === "FAILED" || status === "CANCELLED") {
        await insertUserTransaction({
          userId: fiatRequest.userId,
          type: txType === "OFF_RAMP" ? "withdrawal" : "deposit",
          status: "failed",
          fromAmount: fiatRequest.amount,
          pajCashReference: ref,
        });
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error(`[PajCash webhook] Error processing ${ref}:`, err);
      res.status(200).json({ received: true, error: "internal" });
    }
  });
}
