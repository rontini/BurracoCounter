import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('simple mode: photo of the melds, optional hand points, who closed, score', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByText('Semplice (una foto)').click();
  await page.getByText('Obiettivo 2005').click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();
  await page.getByRole('link', { name: 'Nuova smazzata' }).click();
  await expect(page.getByTestId('model-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });

  // Squadra "Noi": nella foto c'è un solo 5 di quadri; i suoi 4 angoli diventano una carta.
  await page.getByLabel('Foto di Noi – Dalla galleria').setInputFiles(fixture('5-quadri.jpg'));
  await expect(page.getByTestId('recognition-time')).toBeVisible({ timeout: 30_000 });
  const cards = page.getByTestId('simple-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-card', '5♦');
  // Una carta sola non è un gioco: la tolgo e inserisco a mano un tris di K.
  await cards.first().click();
  await page.getByRole('button', { name: 'Rimuovi questa carta' }).click();
  await page.getByRole('button', { name: '+ Nuovo gioco' }).click();
  for (const suit of ['fiori', 'quadri', 'picche']) {
    await page.getByRole('radio', { name: suit }).click();
    await page.getByRole('button', { name: `K di ${suit}`, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Fatto' }).click();
  await expect(page.getByTestId('simple-meld')).toHaveCount(1);
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByTestId('simple-summary-A')).toContainText('1 giochi');

  // Punti in mano contati a mano, facoltativi: solo per "Noi".
  await page.getByLabel('Punti delle carte in mano (facoltativo)').first().fill('5');

  // Squadra "Loro": tolgo l'unica carta, nessun gioco.
  await page.getByLabel('Foto di Loro – Dalla galleria').setInputFiles(fixture('10-fiori.jpg'));
  await expect(page.getByTestId('recognition-time')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('simple-card').first().click();
  await page.getByRole('button', { name: 'Rimuovi questa carta' }).click();
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByTestId('simple-summary-B')).toContainText('0 giochi');

  await expect(page.getByRole('button', { name: 'Conferma smazzata' })).toBeDisabled();
  await page.getByText('Nessuno', { exact: true }).click();
  await page.getByRole('button', { name: 'Conferma smazzata' }).click();

  // Noi: tris di K (30) − 5 punti in mano = 25.
  await expect(page.getByTestId('total-A')).toHaveText('25', { timeout: 10_000 });
  await expect(page.getByTestId('total-B')).toHaveText('0');
});
