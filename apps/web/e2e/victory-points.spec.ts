import { expect, test, type Page } from '@playwright/test';

async function quickHand(page: Page) {
  await page.getByRole('link', { name: 'Nuova smazzata' }).click();
  await page.getByRole('button', { name: '+ Aggiungi gioco' }).click();
  for (const suit of ['fiori', 'quadri', 'picche']) {
    await page.getByRole('radio', { name: suit }).click();
    await page.getByRole('button', { name: `K di ${suit}`, exact: true }).click();
  }
  await page.getByRole('tab', { name: 'Riepilogo' }).click();
  await page.getByRole('button', { name: 'Conferma smazzata' }).click();
}

test('a 4-hand match is converted with the VP table from settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Impostazioni/ }).click();

  await page.getByLabel('Nome della tabella').fill('Casa');
  await page.getByRole('button', { name: '+ Aggiungi riga' }).click();
  await page.getByLabel('Riga 2: differenza massima').fill('150');
  await page.getByLabel('Riga 2: VP vincitore').fill('12');
  await page.getByLabel('Riga 2: VP perdente').fill('8');
  await page.getByRole('button', { name: 'Salva tabella' }).click();
  await expect(page.getByText('Tabella salvata.')).toBeVisible();

  await page.getByRole('link', { name: /Indietro/ }).click();
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();

  for (let i = 0; i < 4; i++) await quickHand(page);

  // 4 × 30 = 120 di differenza → fascia fino a 150 → 12–8.
  await expect(page.getByTestId('vp-A')).toHaveText('12 VP');
  await expect(page.getByTestId('vp-B')).toHaveText('8 VP');
  await expect(page.getByText('Vince Noi!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nuova smazzata' })).toHaveCount(0);
});

test('a VP match without a table points to the settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();
  await expect(page.getByText('Manca la tabella dei Victory Point.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inseriscila nelle impostazioni' })).toBeVisible();
});
