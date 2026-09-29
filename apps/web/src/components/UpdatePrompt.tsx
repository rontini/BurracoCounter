import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../i18n';

/** Avviso "Aggiorna" quando il service worker ha una nuova versione (CLAUDE.md §9). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span>{t('pwa.update')}</span>
      <button
        type="button"
        className="btn primary small"
        onClick={() => void updateServiceWorker(true)}
      >
        {t('pwa.updateNow')}
      </button>
      <button type="button" className="btn ghost small" onClick={() => setNeedRefresh(false)}>
        {t('pwa.later')}
      </button>
    </div>
  );
}
