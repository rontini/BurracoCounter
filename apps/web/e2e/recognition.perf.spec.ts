import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { detections, openHand } from './helpers';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Progetto "perf": gira da solo dopo gli altri test, per misurare i tempi senza contesa di CPU.
test('a large photo is tiled and recognized in under 5 seconds, then corrected', async ({
  page,
}) => {
  await openHand(page);
  await page
    .getByLabel('Foto dei giochi – Dalla galleria')
    .setInputFiles(fixture('tavolo-grande.jpg'));
  const timing = page.getByTestId('recognition-time');
  await expect(timing).toBeVisible({ timeout: 30_000 });
  // "N carte riconosciute in X.Y s (backend)"
  const seconds = Number(/in ([\d.]+) s/.exec((await timing.textContent())!)![1]);
  console.log(`riconoscimento: ${await timing.textContent()}`);
  expect(seconds).toBeLessThan(5);

  const found = await detections(page);
  expect(found.some((d) => d.card === '5♦')).toBe(true);

  // Correzione con un tocco: la prima carta diventa l'asso di picche.
  await page.getByTestId('detection').first().click();
  await page.getByRole('radio', { name: 'picche' }).click();
  await page.getByRole('button', { name: 'A di picche', exact: true }).click();
  await expect(page.getByTestId('detection').first()).toHaveAttribute('data-card', 'A♠');

  await page.getByRole('button', { name: 'Aggiungi come gioco' }).click();
  await expect(page.getByText('Gioco 1')).toBeVisible();
});
