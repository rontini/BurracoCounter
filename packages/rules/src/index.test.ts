import { describe, expect, it } from 'vitest';
import { RULES_PACKAGE } from './index';

describe('rules package', () => {
  it('is wired into the workspace', () => {
    expect(RULES_PACKAGE).toBe('@burracount/rules');
  });
});
