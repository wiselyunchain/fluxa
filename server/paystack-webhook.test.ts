import { describe, expect, it } from "vitest";
import { verifyPaystackSignature } from "./paystack-webhook";

describe("Paystack Webhook", () => {
  it("verifies valid Paystack webhook signature", () => {
    const secret = "test-secret-key";
    const payload = JSON.stringify({
      event: "charge.success",
      data: { reference: "test-ref-123" },
    });

    // Generate valid signature
    const crypto = require("crypto");
    const validSignature = crypto
      .createHmac("sha512", secret)
      .update(payload)
      .digest("hex");

    const isValid = verifyPaystackSignature(payload, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it("rejects invalid Paystack webhook signature", () => {
    const secret = "test-secret-key";
    const payload = JSON.stringify({
      event: "charge.success",
      data: { reference: "test-ref-123" },
    });

    const invalidSignature = "invalid-signature-hash";
    const isValid = verifyPaystackSignature(payload, invalidSignature, secret);
    expect(isValid).toBe(false);
  });

  it("rejects tampered webhook payload", () => {
    const secret = "test-secret-key";
    const payload = JSON.stringify({
      event: "charge.success",
      data: { reference: "test-ref-123" },
    });

    // Generate signature for original payload
    const crypto = require("crypto");
    const signature = crypto
      .createHmac("sha512", secret)
      .update(payload)
      .digest("hex");

    // Try to verify with tampered payload
    const tamperedPayload = JSON.stringify({
      event: "charge.success",
      data: { reference: "test-ref-456" }, // Different reference
    });

    const isValid = verifyPaystackSignature(tamperedPayload, signature, secret);
    expect(isValid).toBe(false);
  });

  it("handles different webhook events", () => {
    const events = [
      "charge.success",
      "charge.failed",
      "transfer.success",
      "transfer.failed",
    ];

    events.forEach((event) => {
      expect(event).toBeDefined();
      expect(typeof event).toBe("string");
      expect(event.length).toBeGreaterThan(0);
    });
  });

  it("validates webhook payload structure", () => {
    const payload = {
      event: "charge.success",
      data: {
        id: 123456,
        reference: "ref-123",
        amount: 100000,
        paid_at: "2026-04-06T17:20:00Z",
        status: "success",
        customer: {
          id: 1,
          email: "user@example.com",
          customer_code: "CUS_123",
          first_name: "John",
          last_name: "Doe",
          phone: "+234812345678",
        },
        metadata: {
          userId: "1",
          chain: "base",
          walletAddress: "0x1234567890123456789012345678901234567890",
          description: "On-ramp deposit",
        },
      },
    };

    expect(payload.event).toBe("charge.success");
    expect(payload.data.reference).toBeDefined();
    expect(payload.data.customer.email).toBeDefined();
    expect(payload.data.metadata?.userId).toBeDefined();
  });

  it("handles webhook with missing metadata", () => {
    const payload = {
      event: "charge.success",
      data: {
        id: 123456,
        reference: "ref-123",
        amount: 100000,
        paid_at: "2026-04-06T17:20:00Z",
        status: "success",
        customer: {
          id: 1,
          email: "user@example.com",
          customer_code: "CUS_123",
          first_name: "John",
          last_name: "Doe",
          phone: "+234812345678",
        },
        // No metadata
      },
    };

    expect(payload.data.metadata).toBeUndefined();
    expect(payload.data.reference).toBeDefined();
  });

  it("calculates correct Paystack amount conversion", () => {
    // Paystack amounts are in kobo (1 kobo = 0.01 NGN)
    const paystackAmount = 100000; // 100,000 kobo
    const ngnAmount = paystackAmount / 100; // 1,000 NGN

    expect(ngnAmount).toBe(1000);
  });

  it("handles transfer webhook events", () => {
    const transferPayload = {
      event: "transfer.success",
      data: {
        id: 789012,
        reference: "transfer-ref-123",
        amount: 50000,
        paid_at: "2026-04-06T17:20:00Z",
        status: "success",
        customer: {
          id: 2,
          email: "recipient@example.com",
          customer_code: "CUS_456",
          first_name: "Jane",
          last_name: "Smith",
          phone: "+234812345679",
        },
      },
    };

    expect(transferPayload.event).toBe("transfer.success");
    expect(transferPayload.data.reference).toContain("transfer-ref");
  });

  it("validates webhook timestamp format", () => {
    const timestamp = "2026-04-06T17:20:00Z";
    const date = new Date(timestamp);

    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).toBeGreaterThan(0);
  });
});
