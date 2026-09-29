/** L'app è già aperta come app installata? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Safari su iPhone/iPad: l'installazione è manuale da Condividi. */
export function isIosSafari(
  ua = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && !otherBrowser && /Safari/.test(ua);
}
