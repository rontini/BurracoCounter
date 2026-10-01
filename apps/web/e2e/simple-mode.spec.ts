import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('simple mode: one photo per team, who closed, score', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByText('Semplice (una foto)').click();
  await page.getByText('Obiettivo 2005').click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();
  await page.getByRole('link', { name: 'Nuova smazzata' }).click();
  await expect(page.getByTestId('model-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });

  // Squadra "Noi": nella foto c'è solo un 5 di quadri, che non forma giochi → carte in mano.
  await page.getByLabel('Foto di Noi – Dalla galleria').setInputFiles(fixture('5-quadri.jpg'));
  await expect(page.getByTestId('recognition-time')).toBeVisible({ timeout: 30_000 });
  const hand = page.getByTestId('simple-hand').getByTestId('simple-card');
  await expect(hand.first()).toHaveAttribute('data-card', '5♦');

  // Correzione: tolgo i doppioni lasciando un solo 5♦ in mano.
  while ((await hand.count()) > 1) {
    await hand.last().click();
    await page.getByRole('button', { name: 'Rimuovi questa carta' }).click();
  }
  // Aggiungo a mano un gioco: tris di K.
  await page.getByRole('button', { name: '+ Nuovo gioco' }).click();
  for (const suit of ['fiori', 'quadri', 'picche']) {
    await page.getByRole('radio', { name: suit }).click();
    await page.getByRole('button', { name: `K di ${suit}`, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Fatto' }).click();
  await expect(page.getByTestId('simple-meld')).toHaveCount(1);
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByTestId('simple-summary-A')).toContainText('1 giochi, 1 carte in mano');

  // Squadra "Loro": foto vuota di giochi, tutto in mano.
  await page.getByLabel('Foto di Loro – Dalla galleria').setInputFiles(fixture('10-fiori.jpg'));
  await expect(page.getByTestId('recognition-time')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByTestId('simple-summary-B')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Conferma smazzata' })).toBeDisabled();
  await page.getByText('Nessuno', { exact: true }).click();
  await page.getByRole('button', { name: 'Conferma smazzata' }).click();

  // Noi: tris di K (30) − 5♦ in mano (5) = 25.
  await expect(page.getByTestId('total-A')).toHaveText('25', { timeout: 10_000 });
});
