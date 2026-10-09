import { expect, test } from '@playwright/test';
import { guest } from './helpers';

test('two friends at one table: create, share, join, play, drop out and come back', async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  const ana = await guest(browser, 'Ana', errors);
  await ana.page.getByRole('button', { name: 'Novi stol' }).click();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(ana.page).toHaveURL(/#\/t\/[A-Z2-9]{8}$/);
  const link = ana.page.url();

  const bruno = await guest(browser, 'Bruno', errors);
  await bruno.page.goto(link);
  await bruno.page.getByRole('button', { name: 'Sjedni za stol' }).click();
  await expect(ana.page.getByText('Bruno')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Pokreni igru' }).click();

  // Each sees their own six cards (plus two face down), and they differ.
  for (const p of [ana.page, bruno.page]) await expect(p.locator('.hand .hand-card')).toHaveCount(8);
  const hand = (p: typeof ana.page) => p.locator('.hand .hand-card:not(.hand-card--talon)').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const [a, b] = [await hand(ana.page), await hand(bruno.page)];
  expect(a.filter((c) => b.includes(c))).toEqual([]);

  // Ana speaks first and passes; Bruno's screen moves on to his trump call.
  await ana.page.getByRole('button', { name: 'Dalje' }).click();
  await expect(bruno.page.locator('.trump-btn').first()).toBeVisible();

  // Bruno closes his tab. After the grace period a bot plays for him and Ana sees him as away.
  await bruno.page.close();
  await expect(ana.page.locator('.opponent').getByText('Bruno (odspojen)')).toBeVisible({ timeout: 150_000 });

  // He opens the link again and is back in his own seat.
  const back = await bruno.ctx.newPage();
  await back.goto(link);
  await expect(back.locator('.hand .hand-card').first()).toBeVisible();
  await expect(ana.page.getByText('Bruno (odspojen)')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the leaderboard is public', async ({ page }) => {
  await page.goto('#/leaderboard');
  await expect(page.getByRole('heading', { name: 'Ljestvica' })).toBeVisible();
  await expect(page.getByText('Još nitko nema dovoljno rangiranih partija.')).toBeVisible();
});

test('the host replaces the invite code: the old link stops working, the new one seats a friend', async ({ browser }) => {
  const errors: string[] = [];
  const ana = await guest(browser, 'Ana', errors);
  await ana.page.getByRole('button', { name: 'Novi stol' }).click();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(ana.page).toHaveURL(/#\/t\/[A-Z2-9]{8}$/);
  const oldLink = ana.page.url();

  ana.page.once('dialog', (d) => void d.accept());
  await ana.page.getByRole('button', { name: 'Nova šifra' }).click();
  await expect(ana.page).not.toHaveURL(oldLink);
  await expect(ana.page).toHaveURL(/#\/t\/[A-Z2-9]{8}$/);
  const newLink = ana.page.url();

  const cvita = await guest(browser, 'Cvita', errors);
  await cvita.page.goto(oldLink);
  await expect(cvita.page.getByText('Ovaj stol ne postoji.')).toBeVisible();
  await cvita.page.goto(newLink);
  await cvita.page.getByRole('button', { name: 'Sjedni za stol' }).click();
  await expect(ana.page.getByText('Cvita')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a quick table: the host picks the timer profile, and the move countdown starts at once', async ({ browser }) => {
  const errors: string[] = [];
  const ana = await guest(browser, 'Ana', errors);
  await ana.page.getByLabel('Vrijeme za potez').selectOption('quick');
  await ana.page.getByRole('button', { name: 'Novi stol' }).click();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(ana.page.getByText('Brzo · 15 s')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Pokreni igru' }).click();
  // 15 s per move is inside the last-20-seconds countdown, so it shows right away (normal: after 10 s).
  await expect(ana.page.getByRole('timer')).toBeVisible({ timeout: 5000 });
  expect(errors).toEqual([]);
});

test('public lobby: one player opens a public table, another finds it in the list and sits down', async ({ browser }) => {
  const errors: string[] = [];
  const ana = await guest(browser, 'Ana', errors);
  await ana.page.getByRole('checkbox', { name: 'Javni stol' }).check();
  await ana.page.getByRole('button', { name: 'Novi stol' }).click();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(ana.page).toHaveURL(/#\/t\/[A-Z2-9]{8}$/);
  await expect(ana.page.getByText('Javni', { exact: true })).toBeVisible();

  const bruno = await guest(browser, 'Bruno', errors);
  const publicList = bruno.page.getByRole('region', { name: 'Javni stolovi' });
  await expect(publicList.getByText('Ana')).toBeVisible();
  await publicList.getByRole('button', { name: 'Pridruži se: Ana' }).click();
  await expect(bruno.page).toHaveURL(ana.page.url());
  await expect(ana.page.getByText('Bruno')).toBeVisible();
  expect(errors).toEqual([]);
});
