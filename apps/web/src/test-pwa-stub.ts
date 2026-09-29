// Sostituisce `virtual:pwa-register/react` nei test unitari (il plugin PWA non gira in Vitest).
export function useRegisterSW() {
  const noop = () => undefined;
  return {
    needRefresh: [false, noop] as const,
    offlineReady: [false, noop] as const,
    updateServiceWorker: async () => undefined,
  };
}
