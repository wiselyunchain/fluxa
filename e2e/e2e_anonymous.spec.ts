import { test, expect } from '@playwright/test';
import { Keypair } from '@solana/web3.js';

test('Anonymous Transfer Flow', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).process = { env: {} };
    (window as any).global = window;
  });
  // Setup: Simulate a logged-in user by injecting the auth cookie
  // Assuming a test user was created with a known openId
  const testOpenId = 'test_e2e_user';
  
  // Set the cookie directly in the browser context
  await page.context().addCookies([{
    name: 'app_session_id',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJ2ZXJpZnktZTJlLTAwMDEiLCJhcHBJZCI6ImZsdXhhLWxvY2FsIiwibmFtZSI6IkUyRSBVc2VyIiwiZXhwIjoxODE1NjY1MTQ1fQ.Kx3Bv-BoRtZS8HGeHAfydmrXycy6LbH5Gl2KEpiLp14',
    domain: 'localhost',
    path: '/',
  }]);

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  // Navigate to the anonymous transfer page
  await page.goto('http://localhost:3000/transfer');
  
  // Wait for the page to load
  await expect(page.getByRole('heading', { name: 'Anonymous Transfers' })).toBeVisible();

  // Test the 'Send Privately' flow
  const stealthKeyInput = page.getByLabel('Recipient Stealth Public Key');
  const amountInput = page.getByLabel('Amount (USDC)');
  const sendButton = page.getByRole('button', { name: 'Send Anonymously' });
  const dummyReceiver = Keypair.generate().publicKey.toBase58();

  // Fill in the form
  await stealthKeyInput.fill(dummyReceiver);
  await amountInput.fill('0.5');

  // Submit the form
  await sendButton.click();

  // Expect a toast notification for failure due to insufficient balance (pre-check runs before SDK call)
  await expect(page.getByText('Transfer Failed')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Insufficient encrypted balance/)).toBeVisible();

  // Test the 'Inbox' tab
  const inboxTab = page.getByRole('tab', { name: 'Inbox' });
  await inboxTab.click();

  // Trigger a scan
  const scanButton = page.getByRole('button', { name: 'Scan' });
  await scanButton.click();

  // Expect scan complete toast
  await expect(page.getByText('Scan Complete')).toBeVisible({ timeout: 15000 });
});
