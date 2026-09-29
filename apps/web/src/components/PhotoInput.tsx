import { useId, type ChangeEvent } from 'react';
import { t } from '../i18n';

/**
 * Due ingressi: fotocamera (più affidabile della fotocamera live nelle PWA
 * su iOS) e galleria (CLAUDE.md §6).
 */
export function PhotoInput({ label, onPhoto }: { label: string; onPhoto: (file: File) => void }) {
  const id = useId();
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPhoto(file);
  };
  return (
    <div className="photo-input" role="group" aria-label={label}>
      <label className="btn secondary file-btn" htmlFor={`${id}-camera`}>
        📷 {t('photo.camera')}
      </label>
      <input
        id={`${id}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={`${label} – ${t('photo.camera')}`}
        onChange={handle}
      />
      <label className="btn secondary file-btn" htmlFor={`${id}-gallery`}>
        🖼 {t('photo.gallery')}
      </label>
      <input
        id={`${id}-gallery`}
        type="file"
        accept="image/*"
        aria-label={`${label} – ${t('photo.gallery')}`}
        onChange={handle}
      />
    </div>
  );
}
