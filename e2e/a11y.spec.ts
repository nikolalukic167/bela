import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { guest, trackErrors } from './helpers';

/** Fails on any WCAG 2.1 A/AA violation axe finds on the page as it is now. */
async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    // Don't let axe fetch cross-origin stylesheets: the CSP rightly blocks that and logs an error.
    // (options() replaces all options, so it goes before withTags.)
    .options({ preload: false })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.failureSummary ?? ''} ${n.html}`).join(', ')}`)).toEqual([]);
}

test('home page has no axe violations', async ({ page }) => {
  await page.goto('#/');
  await expect(page.getByRole('button', { name: 'Igraj protiv botova' })).toBeVisible();
  await expectAccessible(page);
});

test('the table has no axe violations, in trump calling and in play', async ({ page }) => {
  await page.goto('#/play/bela');
  await page.getByRole('button', { name: 'Počni' }).click();
  await expect(page.locator('.hand .hand-card').first()).toBeVisible();
  await expectAccessible(page);
  const trump = page.locator('.trump-btn').first();
  if (await trump.isVisible()) await trump.click();
  await expect(page.locator('.trump-panel')).toHaveCount(0, { timeout: 20_000 });
  await expectAccessible(page);
});

test('the online lobby and a table lobby have no axe violations', async ({ browser }) => {
  const errors: string[] = [];
  const { page } = await guest(browser, 'Axe', errors);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Novi stol' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(page).toHaveURL(/#\/t\/[A-Z2-9]{8}$/);
  await expect(page.getByRole('button', { name: 'Pokreni igru' })).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('the public lobby list and a public table lobby have no axe violations', async ({ browser }) => {
  const errors: string[] = [];
  const host = await guest(browser, 'Axe Javni', errors);
  await host.page.getByRole('checkbox', { name: 'Javni stol' }).check();
  await host.page.getByRole('button', { name: 'Novi stol' }).click();
  await host.page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(host.page.getByText('Javni', { exact: true })).toBeVisible();
  await expectAccessible(host.page);
  const visitor = await guest(browser, 'Axe Gost', errors);
  await expect(visitor.page.getByRole('region', { name: 'Javni stolovi' }).getByText('Axe Javni')).toBeVisible();
  await expectAccessible(visitor.page);
  expect(errors).toEqual([]);
});

test('the tutorial guides a whole hand, played with the keyboard only', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const errors: string[] = [];
  trackErrors(page, errors, 'tutorial');
  await page.goto('#/');
  await page.getByRole('link', { name: /vodič/ }).click();
  const tip = page.getByRole('complementary', { name: 'Savjet' });
  await expect(tip).toContainText('zovi srce'); // hearts in the default Hungarian deck
  await expectAccessible(page);

  // Only hearts may be called, and the picker already has focus.
  await expect(page.locator('.trump-btn:not([disabled])')).toHaveCount(1);
  await expect(page.locator('.trump-btn:not([disabled])')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tip).toContainText('otvaraš prvi štih');

  // Play every turn from the keyboard: focus returns to the hand, Enter plays (desktop has hover).
  const summary = page.getByRole('dialog').filter({ hasText: /Kraj partije|Pad|Prolaz|Kraj ruke/ });
  let sawDeclarations = false;
  for (let i = 0; i < 400 && !(await summary.isVisible()); i++) {
    if ((await tip.textContent())?.includes('Zvanja!')) sawDeclarations = true;
    const focused = page.locator('.hand button.hand-card:focus');
    if ((await page.locator('.your-turn').isVisible()) && (await focused.count()) === 1) await page.keyboard.press('Enter');
    else await page.waitForTimeout(150);
  }
  await expect(summary).toBeVisible();
  expect(sawDeclarations).toBe(true);
  await expect(summary).toContainText('162');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Završi vodič' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(errors).toEqual([]);
});

test('reduced motion turns animations off', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('#/play/bela');
  await page.getByRole('button', { name: 'Počni' }).click();
  const card = page.locator('.hand .hand-card').first();
  await expect(card).toBeVisible();
  const duration = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);
  await ctx.close();
});

test('the menu opens and closes from the keyboard and passes axe', async ({ page }) => {
  await page.goto('#/play/bela');
  await page.getByRole('button', { name: 'Počni' }).click();
  const open = page.getByRole('button', { name: 'Otvori izbornik' });
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'Izbornik' }).getByRole('link').first()).toBeFocused();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  await expect(open).toBeFocused();
});

for (const route of ['#/rules/bela', '#/history', '#/leaderboard']) {
  test(`${route} has no axe violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expectAccessible(page);
  });
}
