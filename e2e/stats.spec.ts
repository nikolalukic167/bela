import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { guest } from './helpers';

const local = [
  { id: 'local:1001:9:1010-700', playedAt: 2, source: 'local', target: 1001, scores: [1010, 700], won: true, players: [], hands: { hands: 10, calls: 4, falls: 1, points: 1010 } },
  { id: 'local:1001:8:640-1001', playedAt: 1, source: 'local', target: 1001, scores: [640, 1001], won: false, players: [], hands: { hands: 9, calls: 2, falls: 1, points: 640 } },
];

test('personal stats: local games against bots in their own section, online stats for a signed-in player', async ({ browser }) => {
  const errors: string[] = [];
  const { page } = await guest(browser, 'Statko', errors);
  await page.evaluate((h) => localStorage.setItem('cards:bela:history', JSON.stringify(h)), local);
  await page.goto('#/stats');

  const localSection = page.getByRole('region', { name: 'Protiv botova na ovom uređaju' });
  await expect(localSection).toContainText('Prikazuje se odvojeno');
  const tile = (label: string) => localSection.locator('dl > div').filter({ hasText: label }).locator('dd').first();
  await expect(tile('Partije')).toHaveText('2');
  await expect(tile('Pobjede')).toHaveText('50%');
  await expect(tile('Prosjek bodova')).toHaveText('825');
  await expect(tile('Zove adut')).toHaveText('32%'); // 6 of 19 hands
  await expect(tile('Pad kad zove')).toHaveText('33%'); // 2 of 6 calls

  const online = page.getByRole('region', { name: 'Online partije' });
  await expect(online).toContainText('Još nema završenih partija.');
  await expect(online).toContainText('Još nema online partija s partnerom');

  const { violations } = await new AxeBuilder({ page }).options({ preload: false }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  expect(errors).toEqual([]);
});
