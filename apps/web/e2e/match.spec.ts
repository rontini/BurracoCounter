import { expect, test, type Page } from '@playwright/test';

async function pick(page: Page, suit: string, ranks: string[]) {
  await page.getByRole('radio', { name: suit }).click();
  for (const r of ranks) {
    await page.getByRole('button', { name: `${r} di ${suit}`, exact: true }).click();
  }
}

test('a full 2v2 hand is scored and persisted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nuova partita' }).click();

  await page.getByLabel('Nome della partita').fill('Sabato sera');
  await page.getByLabel('Nome squadra 1').fill('Noi');
  await page.getByLabel('Nome squadra 2').fill('Loro');
  await page.getByText('Obiettivo 2005').click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();

  await expect(page.getByRole('heading', { name: 'Sabato sera' })).toBeVisible();
  await page.getByRole('link', { name: 'Nuova smazzata' }).click();

  // Squadra "Noi": burraco pulito di cuori 3–9 (45 punti + 200) e chiusura.
  await page.getByRole('button', { name: '+ Aggiungi gioco' }).click();
  await pick(page, 'cuori', ['3', '4', '5', '6', '7', '8', '9']);
  await expect(page.getByText('Gioco 1 · Scala')).toBeVisible();
  await page.getByRole('button', { name: 'Fatto' }).click();

  // Un gioco ambiguo: 2-3-4 di picche, letto con la pinella naturale.
  await page.getByRole('button', { name: '+ Aggiungi gioco' }).click();
  await pick(page, 'picche', ['2', '3', '4']);
  await page.getByRole('button', { name: 'Fatto' }).click();
  await expect(page.getByText('Come va letto questo gioco?')).toBeVisible();
  await page.getByLabel(/pinella naturale/).check();

  await page.getByLabel('Ha chiuso').check();
  await page.getByRole('button', { name: 'Loro →' }).click();

  // Squadra "Loro": tris di K, pozzetto non preso, un asso in mano.
  await page.getByRole('button', { name: '+ Aggiungi gioco' }).click();
  await pick(page, 'fiori', ['K']);
  await pick(page, 'quadri', ['K']);
  await pick(page, 'picche', ['K']);
  await page.getByRole('button', { name: 'Fatto' }).click();
  await page.getByLabel('Pozzetto preso').uncheck();
  await page.getByRole('button', { name: /Aggiungi carte – Giocatore 2/ }).click();
  await pick(page, 'cuori', ['A']);

  await page.getByRole('tab', { name: 'Riepilogo' }).click();
  await page.getByRole('button', { name: 'Conferma smazzata' }).click();

  // Noi: 45 + 30 (2-3-4 = 20+5+5) + 200 + 100 = 375. Loro: 30 − 100 − 15 = −85.
  await expect(page.getByTestId('total-A')).toHaveText('375');
  await expect(page.getByTestId('total-B')).toHaveText('-85');

  await page.reload();
  await expect(page.getByTestId('total-A')).toHaveText('375');
  await page.getByRole('link', { name: /Indietro/ }).click();
  await expect(page.getByText('Sabato sera')).toBeVisible();
});
