import { expect, test } from '@playwright/test';
import { playHand, trackErrors } from './helpers';

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`a whole hand against bots on ${viewport.name}, with card points adding up to 162`, async ({ browser }) => {
    const errors: string[] = [];
    const page = await browser.newPage({ viewport });
    trackErrors(page, errors, viewport.name);
    await page.goto('#/play/bela');
    await page.getByRole('button', { name: 'Počni' }).click();
    await playHand(page);
    const cards = page.getByRole('row').filter({ hasText: 'Karte' }).getByRole('cell');
    const [us, them] = (await cards.allInnerTexts()).slice(-2).map(Number);
    expect(us + them).toBe(162);
    expect(errors).toEqual([]);
  });
}
