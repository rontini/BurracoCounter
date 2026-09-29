import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { isIosSafari, isStandalone } from '../lib/install';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'burracount.installDismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Android/Chrome: pulsante che usa `beforeinstallprompt`.
 * iPhone/Safari: istruzioni per "Aggiungi alla schermata Home" (CLAUDE.md §9).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const standalone = isStandalone();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Archiviazione non disponibile: l'avviso tornerà alla prossima apertura.
    }
  }

  if (standalone || dismissed) return null;

  if (deferred) {
    return (
      <div className="install">
        <p>{t('pwa.installText')}</p>
        <div className="row">
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
          >
            {t('pwa.install')}
          </button>
          <button type="button" className="btn ghost" onClick={dismiss}>
            {t('pwa.later')}
          </button>
        </div>
      </div>
    );
  }

  if (isIosSafari()) {
    return (
      <div className="install">
        <p>{t('pwa.iosText')}</p>
        <ol>
          <li>{t('pwa.iosStep1')}</li>
          <li>{t('pwa.iosStep2')}</li>
          <li>{t('pwa.iosStep3')}</li>
        </ol>
        <button type="button" className="btn ghost" onClick={dismiss}>
          {t('pwa.gotIt')}
        </button>
      </div>
    );
  }
  return null;
}
