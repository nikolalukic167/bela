import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Records page errors and console errors (CSP violations show up here). */
export function trackErrors(page: Page, errors: string[], who: string) {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${who} console: ${m.text()}`);
  });
}

/** A fresh browser profile signed in as a guest. */
export async function guest(browser: Browser, name: string, errors: string[]): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  trackErrors(page, errors, name);
  await page.goto('#/online');
  await page.getByRole('button', { name: 'Prijava' }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill(name);
  await page.getByRole('button', { name: 'Nastavi' }).click();
  await expect(page.getByRole('button', { name: 'Novi stol' })).toBeVisible();
  return { ctx, page };
}

/** Plays the signed-in seat's turns (call trump, first playable card) until the hand summary shows. */
export async function playHand(page: Page) {
  const summary = page.getByRole('dialog').filter({ hasText: /Kraj partije|Pad|Prolaz/ });
  for (let i = 0; i < 600 && !(await summary.isVisible()); i++) {
    const trump = page.locator('.trump-btn').first();
    const card = page.locator('.hand .hand-card:not(.hand-card--talon):not([disabled])').first();
    if (await trump.isVisible()) await trump.click();
    else if ((await page.locator('.your-turn').isVisible()) && (await card.isVisible())) {
      await card.click();
      const confirm = page.getByRole('button', { name: /^Odigraj/ });
      if (await confirm.isVisible()) await confirm.click();
    } else await page.waitForTimeout(200);
  }
  await expect(summary).toBeVisible();
}
