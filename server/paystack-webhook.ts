import { Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { fiatRequests, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    paid_at: string;
    paidAt: string;
    status: string;
    customer: {
      id: number;
      email: string;
      customer_code: string;
      first_name: string;
      last_name: string;
      phone: string;
    };
    metadata?: {
      userId: string;
      chain: string;
      walletAddress: string;
      description: string;
    };
  };
}

/**
 * Verify Paystack webhook signature
 */
export function verifyPaystackSignature(
  payload: string,
  signature: string,
  paystackSecret: string
): boolean {
  const hash = crypto
    .createHmac("sha512", paystackSecret)
    .update(payload)
    .digest("hex");

  return hash === signature;
}

/**
 * Handle Paystack webhook events
 */
export async function handlePaystackWebhook(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecret) {
      console.error("[Paystack Webhook] Missing PAYSTACK_SECRET_KEY");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    // Verify webhook signature
    const payload = JSON.stringify(req.body);
    if (!verifyPaystackSignature(payload, signature, paystackSecret)) {
      console.warn("[Paystack Webhook] Invalid signature");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const webhookData: PaystackWebhookPayload = req.body;

    // Handle different webhook events
    switch (webhookData.event) {
      case "charge.success":
        await handleChargeSuccess(webhookData);
        break;
      case "charge.failed":
        await handleChargeFailed(webhookData);
        break;
      case "transfer.success":
        await handleTransferSuccess(webhookData);
        break;
      case "transfer.failed":
        await handleTransferFailed(webhookData);
        break;
      default:
        console.log(`[Paystack Webhook] Unhandled event: ${webhookData.event}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[Paystack Webhook] Error:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle successful charge (payment received)
 */
async function handleChargeSuccess(payload: PaystackWebhookPayload): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Paystack Webhook] Database unavailable");
    return;
  }

  try {
    const { data } = payload;
    const metadata = data.metadata as any;

    console.log(`[Paystack Webhook] Processing successful charge: ${data.reference}`);

    // Update fiat request status
    await db
      .update(fiatRequests)
      .set({
        status: "completed",
        paymentReference: data.reference,
        completedAt: new Date(data.paid_at || data.paidAt),
      })
      .where(eq(fiatRequests.paymentReference, data.reference));

    // Get user info for notification
    if (metadata?.userId) {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(metadata.userId)))
        .limit(1);

      if (user.length > 0) {
        // Update user's wallet balance (simplified - in production, query blockchain)
        const amountNGN = data.amount / 100;
        
        // Notify owner of successful payment
        await notifyOwner({
          title: "Payment Received",
          content: `User ${user[0].email} received ₦${amountNGN.toLocaleString()} payment. Reference: ${data.reference}`,
        });

        console.log(
          `[Paystack Webhook] Payment confirmed for user ${user[0].email}: ₦${amountNGN}`
        );
      }
    }
  } catch (error: any) {
    console.error("[Paystack Webhook] Error processing charge success:", error);
  }
}

/**
 * Handle failed charge (payment rejected)
 */
async function handleChargeFailed(payload: PaystackWebhookPayload): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Paystack Webhook] Database unavailable");
    return;
  }

  try {
    const { data } = payload;

    console.log(`[Paystack Webhook] Processing failed charge: ${data.reference}`);

    // Update fiat request status
    await db
      .update(fiatRequests)
      .set({
        status: "failed",
        paymentReference: data.reference,
      })
      .where(eq(fiatRequests.paymentReference, data.reference));

    // Notify owner of failed payment
    await notifyOwner({
      title: "Payment Failed",
      content: `Payment failed for reference ${data.reference}. Customer: ${data.customer.email}`,
    });

    console.log(`[Paystack Webhook] Payment failed: ${data.reference}`);
  } catch (error: any) {
    console.error("[Paystack Webhook] Error processing charge failed:", error);
  }
}

/**
 * Handle successful transfer (withdrawal completed)
 */
async function handleTransferSuccess(payload: PaystackWebhookPayload): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Paystack Webhook] Database unavailable");
    return;
  }

  try {
    const { data } = payload;

    console.log(`[Paystack Webhook] Processing successful transfer: ${data.reference}`);

    // Update fiat request status
    await db
      .update(fiatRequests)
      .set({
        status: "completed",
        paymentReference: data.reference,
        completedAt: new Date(data.paid_at || data.paidAt),
      })
      .where(eq(fiatRequests.paymentReference, data.reference));

    // Notify owner of successful withdrawal
    await notifyOwner({
      title: "Withdrawal Completed",
      content: `Withdrawal of ₦${(data.amount / 100).toLocaleString()} completed. Reference: ${data.reference}`,
    });

    console.log(`[Paystack Webhook] Withdrawal completed: ${data.reference}`);
  } catch (error: any) {
    console.error("[Paystack Webhook] Error processing transfer success:", error);
  }
}

/**
 * Handle failed transfer (withdrawal rejected)
 */
async function handleTransferFailed(payload: PaystackWebhookPayload): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Paystack Webhook] Database unavailable");
    return;
  }

  try {
    const { data } = payload;

    console.log(`[Paystack Webhook] Processing failed transfer: ${data.reference}`);

    // Update fiat request status
    await db
      .update(fiatRequests)
      .set({
        status: "failed",
        paymentReference: data.reference,
      })
      .where(eq(fiatRequests.paymentReference, data.reference));

    // Notify owner of failed withdrawal
    await notifyOwner({
      title: "Withdrawal Failed",
      content: `Withdrawal failed for reference ${data.reference}. Amount: ₦${(data.amount / 100).toLocaleString()}`,
    });

    console.log(`[Paystack Webhook] Withdrawal failed: ${data.reference}`);
  } catch (error: any) {
    console.error("[Paystack Webhook] Error processing transfer failed:", error);
  }
}

/**
 * Register webhook endpoint with Paystack
 */
export async function registerPaystackWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;

    if (!paystackSecret || !paystackPublicKey) {
      console.error("[Paystack] Missing API credentials");
      return false;
    }

    // In production, call Paystack API to register webhook
    // For now, just log the webhook URL
    console.log(`[Paystack] Webhook URL: ${webhookUrl}`);
    console.log("[Paystack] Register this URL in your Paystack dashboard under Settings > Webhooks");

    return true;
  } catch (error: any) {
    console.error("[Paystack] Error registering webhook:", error);
    return false;
  }
}
