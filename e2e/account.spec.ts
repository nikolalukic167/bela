import { expect, test, type Page } from '@playwright/test';
import { guest, trackErrors } from './helpers';

const openMenu = (page: Page) => page.getByLabel('Otvori izbornik').first().click();

test('an offensive guest name is refused at sign-in', async ({ page }) => {
  const errors: string[] = [];
  trackErrors(page, errors, 'guest');
  await page.goto('#/online');
  await page.getByRole('button', { name: 'Prijava' }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('Kur4c');
  await page.getByRole('button', { name: 'Nastavi' }).click();
  await expect(page.getByRole('alert')).toHaveText('To ime nije dopušteno. Odaberi drugo.');
  // The privacy page is linked from the same dialog.
  await page.getByRole('link', { name: 'Što spremamo o tebi' }).click();
  await expect(page.getByRole('heading', { name: 'Privatnost', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Brisanje računa' })).toBeVisible();
  // The refused sign-in is logged by the Convex client; nothing else may go wrong.
  expect(errors.filter((e) => !/"code":"NAME_NOT_ALLOWED"/.test(e))).toEqual([]);
});

test('rename, block a player, then delete the account', async ({ browser }) => {
  const errors: string[] = [];
  const ana = await guest(browser, 'Ema', errors);
  const bruno = await guest(browser, 'Filip', errors);

  // Rename on the account page: a filtered name is refused, a fine one is saved.
  await openMenu(ana.page);
  await ana.page.getByRole('link', { name: 'Moj račun' }).click();
  const name = ana.page.getByRole('textbox', { name: 'Ime' });
  await name.fill('sh1t');
  await ana.page.getByRole('button', { name: 'Spremi' }).click();
  await expect(ana.page.getByRole('alert')).toHaveText('To ime nije dopušteno. Odaberi drugo.');
  await name.fill('Ema Marija');
  await ana.page.getByRole('button', { name: 'Spremi' }).click();
  await expect(ana.page.getByRole('status')).toHaveText('Spremljeno.');

  // Ema opens a table, Filip joins, Ema blocks him: he can't sit down again.
  await ana.page.goto('#/online');
  await ana.page.getByRole('button', { name: 'Novi stol' }).click();
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Novi stol' }).click();
  await expect(ana.page).toHaveURL(/#\/t\/[A-Z2-9]{8}$/);
  const link = ana.page.url();
  await bruno.page.goto(link);
  await bruno.page.getByRole('button', { name: 'Sjedni za stol' }).click();
  await expect(ana.page.getByText('Filip')).toBeVisible();
  await expect(ana.page.getByLabel('Tim A').getByText('Ema Marija')).toBeVisible();

  await ana.page.getByRole('button', { name: 'Igrači za stolom' }).click();
  ana.page.once('dialog', (d) => void d.accept());
  await ana.page.getByRole('button', { name: 'Blokiraj' }).click();
  await expect(ana.page.getByRole('button', { name: 'Blokiran' })).toBeDisabled();
  await ana.page.getByRole('button', { name: 'Prijavi' }).click();
  await ana.page.getByRole('radio', { name: 'Vrijeđanje ili uznemiravanje' }).check();
  await ana.page.getByRole('button', { name: 'Pošalji prijavu' }).click();
  await expect(ana.page.getByRole('button', { name: 'Prijavljeno. Hvala.' })).toBeDisabled();
  await ana.page.getByRole('button', { name: 'Zatvori' }).click();

  await bruno.page.getByRole('button', { name: 'Napusti stol' }).click();
  await expect(bruno.page).toHaveURL(/#\/online$/);
  await bruno.page.goto(link);
  await bruno.page.getByRole('button', { name: 'Sjedni za stol' }).click();
  await expect(bruno.page.getByRole('alert')).toHaveText('Ne možeš sjesti za ovaj stol.');

  // The block shows on Ema's account page, where she deletes her account.
  await openMenu(ana.page);
  await ana.page.getByRole('link', { name: 'Moj račun' }).click();
  await expect(ana.page.getByText('Filip')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Obriši moj račun' }).click();
  await ana.page.getByRole('button', { name: 'Da, obriši zauvijek' }).click();
  await expect(ana.page).toHaveURL(/#\/$/);
  await openMenu(ana.page);
  await expect(ana.page.getByRole('button', { name: 'Prijava' })).toBeVisible();

  // Her table closed with her (Filip had left), so the link leads nowhere now.
  await bruno.page.goto(link);
  await expect(bruno.page.getByText('Ovaj stol ne postoji.')).toBeVisible();
  // Only the two refusals above are logged by the Convex client.
  expect(errors.filter((e) => !/"code":"(NAME_NOT_ALLOWED|BLOCKED)"/.test(e))).toEqual([]);
});

test('a taken guest name is refused with a free variant to pick', async ({ browser }) => {
  const errors: string[] = [];
  const first = await guest(browser, 'Gita', errors);
  const page = await browser.newPage();
  trackErrors(page, errors, 'second');
  await page.goto('#/online');
  await page.getByRole('button', { name: 'Prijava' }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill(' gita ');
  await page.getByRole('button', { name: 'Nastavi' }).click();
  await expect(page.getByRole('alert')).toHaveText('To ime je zauzeto. Odaberi drugo.');
  await expect(page.getByText('Slobodno je: gita 2')).toBeVisible();
  await page.getByRole('button', { name: 'Uzmi to ime' }).click();
  await expect(page.getByRole('dialog').getByRole('textbox').first()).toHaveValue('gita 2');
  await page.getByRole('button', { name: 'Nastavi' }).click();
  await expect(page.getByRole('button', { name: 'Novi stol' })).toBeVisible();
  await first.ctx.close();
  expect(errors.filter((e) => !/"code":"NAME_TAKEN"/.test(e))).toEqual([]);
});
