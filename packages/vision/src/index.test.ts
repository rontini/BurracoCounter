import { describe, expect, it } from 'vitest';
import { VISION_PACKAGE } from './index';

describe('vision package', () => {
  it('is wired into the workspace', () => {
    expect(VISION_PACKAGE).toBe('@burraco-scan/vision');
  });
});
