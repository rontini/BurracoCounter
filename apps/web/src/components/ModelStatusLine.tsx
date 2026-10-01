import { t } from '../i18n';
import type { ModelStatus } from '../lib/useModelStatus';

export function ModelStatusLine({ status }: { status: ModelStatus }) {
  return (
    <p className="muted small" role="status" data-testid="model-status" data-state={status}>
      {status === 'loading'
        ? t('photo.loading')
        : status === 'ready'
          ? t('photo.ready')
          : t('photo.unavailable')}
    </p>
  );
}
