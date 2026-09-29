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

async function playMatch(page: Page) {
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();
  for (let i = 0; i < 4; i++) await quickHand(page);
}

test('a 4-hand match uses the default VP table', async ({ page }) => {
  await page.goto('/');
  await playMatch(page);

  // 4 × 30 = 120 di differenza → fascia 55–150 → 11–9.
  await expect(page.getByTestId('vp-A')).toHaveText('11 VP');
  await expect(page.getByTestId('vp-B')).toHaveText('9 VP');
  await expect(page.getByText('Vince Noi!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nuova smazzata' })).toHaveCount(0);
});

test('the VP table edited in settings applies to new matches', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Impostazioni/ }).click();
  await expect(page.getByText(/Stai usando la tabella predefinita/)).toBeVisible();

  await page.getByLabel('Nome della tabella').fill('Casa');
  await page.getByLabel('Riga 2: VP vincitore').fill('12');
  await page.getByLabel('Riga 2: VP perdente').fill('8');
  await page.getByRole('button', { name: 'Salva tabella' }).click();
  await expect(page.getByText('Tabella salvata.')).toBeVisible();

  await page.getByRole('link', { name: /Indietro/ }).click();
  await playMatch(page);
  await expect(page.getByTestId('vp-A')).toHaveText('12 VP');
  await expect(page.getByTestId('vp-B')).toHaveText('8 VP');
});

test('a VP match without a table can apply the saved one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByText('Personalizza le regole').click();
  await page.getByRole('button', { name: 'Rimuovi tabella' }).click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();

  await expect(page.getByText('Manca la tabella dei Victory Point.')).toBeVisible();
  await page.getByRole('button', { name: /Usa la tabella/ }).click();
  await expect(page.getByText('Manca la tabella dei Victory Point.')).toHaveCount(0);
});
