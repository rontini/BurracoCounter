import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('interpolates variables', () => {
    expect(t('match.hand', { n: 3 })).toBe('Smazzata 3');
    expect(t('match.hand')).toBe('Smazzata {n}');
  });
});
