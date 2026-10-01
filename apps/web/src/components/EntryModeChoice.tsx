import type { EntryMode } from '@burracount/rules';
import { t } from '../i18n';

const MODES: EntryMode[] = ['simple', 'full'];

export function EntryModeChoice({
  value,
  onChange,
  name,
}: {
  value: EntryMode;
  onChange: (m: EntryMode) => void;
  name: string;
}) {
  return (
    <>
      <div className="segmented">
        {MODES.map((m) => (
          <label key={m} className={value === m ? 'selected' : ''}>
            <input type="radio" name={name} checked={value === m} onChange={() => onChange(m)} />
            {t(`entry.${m}`)}
          </label>
        ))}
      </div>
      <p className="hint">{t(value === 'simple' ? 'entry.simpleHelp' : 'entry.fullHelp')}</p>
    </>
  );
}
