import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface State {
  error: Error | null;
}

/** Mostra l'errore invece di una pagina bianca, così si può segnalare. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return <ErrorScreen message={`${this.state.error.name}: ${this.state.error.message}`} />;
  }
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="screen" role="alert">
      <h1>{t('error.title')}</h1>
      <p>{t('error.text')}</p>
      <pre className="error-detail">{message}</pre>
      <p className="muted small">{navigator.userAgent}</p>
      <button type="button" className="btn primary big" onClick={() => window.location.reload()}>
        {t('error.reload')}
      </button>
    </div>
  );
}
