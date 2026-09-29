import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/5-quadri.jpg', import.meta.url));

test('after the first visit the app, the model and recognition work offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  // Il service worker si attiva dopo aver messo tutto in cache; dalla visita
  // successiva controlla la pagina.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'BurraCount' })).toBeVisible();
  // Gli header COOP/COEP arrivano anche dalla cache: WASM multi-thread resta disponibile.
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);

  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();
  await page.getByRole('link', { name: 'Nuova smazzata' }).click();
  await expect(page.getByTestId('model-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
  await page.getByLabel('Foto dei giochi – Dalla galleria').setInputFiles(fixture);
  await expect(page.getByTestId('detection').first()).toHaveAttribute('data-card', '5♦', {
    timeout: 30_000,
  });
});
