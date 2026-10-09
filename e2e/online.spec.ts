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

  // Lobby chat: free text at an unrated table, and quick phrases.
  await bruno.page.getByRole('textbox', { name: 'Poruka stolu' }).fill('Bok, Ana!');
  await bruno.page.getByRole('button', { name: 'Pošalji' }).click();
  await expect(ana.page.getByRole('listitem').filter({ hasText: 'Bok, Ana!' })).toBeVisible();
  await ana.page.getByRole('button', { name: 'Sretno!' }).click();
  await expect(bruno.page.getByRole('listitem').filter({ hasText: 'Ana: Sretno!' })).toBeVisible();

  await ana.page.getByRole('button', { name: 'Pokreni igru' }).click();

  // Each sees their own six cards (plus two face down), and they differ.
  for (const p of [ana.page, bruno.page]) await expect(p.locator('.hand .hand-card')).toHaveCount(8);
  const hand = (p: typeof ana.page) => p.locator('.hand .hand-card:not(.hand-card--talon)').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const [a, b] = [await hand(ana.page), await hand(bruno.page)];
  expect(a.filter((c) => b.includes(c))).toEqual([]);

  // At the table only quick phrases: Bruno's shows up on Ana's screen.
  await bruno.page.getByRole('button', { name: 'Brze poruke' }).click();
  await expect(bruno.page.getByRole('dialog', { name: 'Brze poruke' }).getByRole('textbox')).toHaveCount(0);
  await bruno.page.getByRole('dialog', { name: 'Brze poruke' }).getByRole('button', { name: 'Bravo!' }).click();
  await expect(ana.page.getByText('Bruno: Bravo!')).toBeVisible();

  // Ana speaks first. Near the end of her turn timer a countdown appears, for her only.
  await expect(ana.page.getByRole('timer')).toBeVisible({ timeout: 40_000 });
  await expect(bruno.page.getByRole('timer')).toHaveCount(0);

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
  await expect(ana.page.getByText('Brzo · 20 s')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Pokreni igru' }).click();
  // 20 s per move is inside the last-20-seconds countdown, so it shows right away (normal: after 25 s).
  await expect(ana.page.getByRole('timer')).toBeVisible({ timeout: 5000 });
  expect(errors).toEqual([]);
});

test('muting a player hides their chat for the muter only', async ({ browser }) => {
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

  await ana.page.getByRole('button', { name: 'Igrači za stolom' }).click();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Utišaj' }).click();
  await expect(ana.page.getByRole('dialog').getByRole('button', { name: 'Poništi utišavanje' })).toBeVisible();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Zatvori' }).click();

  await bruno.page.getByRole('button', { name: 'Ups!' }).click();
  await expect(bruno.page.getByRole('listitem').filter({ hasText: 'Bruno: Ups!' })).toBeVisible();
  await ana.page.getByRole('button', { name: 'Hvala!' }).click();
  await expect(ana.page.getByRole('listitem').filter({ hasText: 'Ana: Hvala!' })).toBeVisible();
  await expect(ana.page.getByRole('listitem').filter({ hasText: 'Bruno: Ups!' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
