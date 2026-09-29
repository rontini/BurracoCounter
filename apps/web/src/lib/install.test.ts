import { describe, expect, it } from 'vitest';
import { isIosSafari } from './install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('isIosSafari', () => {
  it('detects Safari on iPhone and iPad', () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_UA, 5)).toBe(true);
  });

  it('ignores other browsers and platforms', () => {
    expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false);
    expect(isIosSafari(IPAD_DESKTOP_UA, 0)).toBe(false);
    expect(isIosSafari(ANDROID, 5)).toBe(false);
  });
});
