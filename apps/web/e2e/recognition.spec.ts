import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detections, openHand } from './helpers';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

interface Reference {
  label: string;
  score: number;
}
const reference = JSON.parse(readFileSync(fixture('reference.json'), 'utf8')) as Record<
  string,
  Reference[]
>;

const toShort = (label: string) =>
  label.replace(/([CDHS])$/, (s) => ({ C: '♣', D: '♦', H: '♥', S: '♠' })[s]!);

for (const name of ['5-quadri.jpg', '10-fiori.jpg']) {
  test(`browser detections match the Python reference (${name})`, async ({ page }) => {
    await openHand(page);
    await page.getByLabel('Foto dei giochi – Dalla galleria').setInputFiles(fixture(name));
    await expect(page.getByTestId('recognition-time')).toBeVisible({ timeout: 30_000 });

    const got = await detections(page);
    const expected = reference[name]!;
    expect(got).toHaveLength(expected.length);
    const sortByConf = <T extends { confidence?: number; score?: number }>(xs: T[]) =>
      [...xs].sort((a, b) => (b.confidence ?? b.score!) - (a.confidence ?? a.score!));
    const g = sortByConf(got);
    sortByConf(expected).forEach((ref, i) => {
      expect(g[i]!.card).toBe(toShort(ref.label));
      // Decoder JPEG e kernel diversi: piccole differenze di punteggio.
      expect(Math.abs(g[i]!.confidence - ref.score)).toBeLessThan(0.05);
    });
  });
}
