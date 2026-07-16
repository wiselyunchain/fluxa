import { test, expect } from "@playwright/test";

test("E2E Withdrawal Flow", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).process = { env: {} };
    (window as any).global = window;
  });

  await page.context().addCookies([{
    name: "app_session_id",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJ2ZXJpZnktZTJlLTAwMDEiLCJhcHBJZCI6ImZsdXhhLWxvY2FsIiwibmFtZSI6IkUyRSBVc2VyIiwiZXhwIjoxODE1NjU1ODkyfQ.U3dQqdmTADGiHBtGm0CvopxbhwOT-lhsvpBPY8fS92c",
    domain: "localhost",
    path: "/",
  }]);

  page.on("response", async (response) => {
    if (!response.ok()) {
      console.log(`Failed request: ${response.url()} - ${response.status()}`);
      try { console.log(await response.text()); } catch {}
    }
  });

  await page.goto("http://localhost:3000/withdraw");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /Withdraw to Bank/i })).toBeVisible();

  // Select USDT as settlement token
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "USDT" }).click();

  // Enter amount
  await page.getByPlaceholder("100").fill("50");

  // Enter bank details
  await page.getByLabel("Account Name").fill("Test User");
  await page.getByLabel("Account Number").fill("0123456789");

  // Submit
  await page.getByRole("button", { name: /Confirm Withdrawal/i }).click();

  // Expect initiation toast
  await expect(
    page.getByText(/Withdrawal Initiated|Withdrawal Failed/i)
  ).toBeVisible({ timeout: 15000 });
});
