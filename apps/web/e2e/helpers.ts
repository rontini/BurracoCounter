import { expect, type Page } from '@playwright/test';

export async function openHand(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByRole('button', { name: 'Inizia la partita' }).click();
  await page.getByRole('link', { name: 'Nuova smazzata' }).click();
  // Il modello si prepara mentre si apre la smazzata e si scattano le foto.
  await expect(page.getByTestId('model-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
}

export async function detections(page: Page) {
  const items = page.getByTestId('detection');
  const n = await items.count();
  const out: { card: string; confidence: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      card: (await items.nth(i).getAttribute('data-card'))!,
      confidence: Number(await items.nth(i).getAttribute('data-confidence')),
    });
  }
  return out;
}
