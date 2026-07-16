import { test, expect } from '@playwright/test';

test('E2E Swap', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).process = { env: {} };
    (window as any).global = window;
  });
  // Inject session cookie
  await page.context().addCookies([{
    name: 'app_session_id',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJ2ZXJpZnktZTJlLTAwMDEiLCJhcHBJZCI6ImZsdXhhLWxvY2FsIiwibmFtZSI6IkUyRSBVc2VyIiwiZXhwIjoxODE1NjU1ODkyfQ.U3dQqdmTADGiHBtGm0CvopxbhwOT-lhsvpBPY8fS92c',
    domain: 'localhost',
    path: '/'
  }]);

  page.on('response', async (response) => {
    if (!response.ok()) {
      console.log(`Failed request: ${response.url()} - ${response.status()}`);
      try {
        const text = await response.text();
        console.log(`Response body: ${text}`);
      } catch (e) {
        console.log('Could not read response body');
      }
    }
  });

  await page.goto('http://localhost:3000/swap');
  
  await page.waitForLoadState('networkidle');

  // Select Pay Token
  await page.getByRole('combobox').first().click();
  await page.locator('text=\'USDC (sol)\'').click();

  // Fill amount
  await page.getByPlaceholder('0.00').fill('10');

  // Select Receive Token
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: '$WIF (sol)' }).click();

  // Toggle Private Swap
  await page.getByRole('switch').click();

  // Wait for quote to fetch and Swap button to become enabled
  await page.waitForTimeout(3000);

  // Click Swap if enabled
  const swapBtn = page.getByRole('button', { name: 'Swap' });
  if (await swapBtn.isEnabled()) {
    console.log("Swap button enabled! Clicking...");
    await swapBtn.click();
    await page.waitForTimeout(5000);
  } else {
    console.log("Swap button disabled.");
    const bodyText = await page.innerText('body');
    if (bodyText.includes('Failed to fetch quote')) {
        console.log("UI says: Failed to fetch quote.");
    }
  }
});
