import {
  DEFAULT_VP_TABLE,
  parseVictoryPointTable,
  type EntryMode,
  type VictoryPointTable,
} from '@burracount/rules';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ChangeEvent } from 'react';
import { EntryModeChoice } from '../components/EntryModeChoice';
import { VpTableEditor } from '../components/VpTableEditor';
import { clearSetting, db, setSetting } from '../db';
import { t } from '../i18n';
import { download } from '../lib/download';
import { href } from '../lib/router';

export function Settings() {
  // undefined = caricamento, null = nessuna tabella salvata (vale la predefinita).
  const saved = useLiveQuery(
    async () => ((await db.settings.get('vpTable'))?.value as VictoryPointTable | null) ?? null,
    [],
  );
  const entryMode = useLiveQuery(
    async () => ((await db.settings.get('entryMode'))?.value as EntryMode | undefined) ?? 'full',
    [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const table = saved ?? DEFAULT_VP_TABLE;

  async function restoreDefault() {
    await clearSetting('vpTable');
    setVersion((v) => v + 1);
    setMessage(t('vp.restored'));
  }

  async function save(next: VictoryPointTable) {
    await setSetting('vpTable', next);
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseVictoryPointTable(JSON.parse(await file.text()));
      if (!parsed.ok) {
        setMessage(t('rules.vpTableError', { error: parsed.errors.join(' ') }));
        return;
      }
      await save(parsed.table);
      setVersion((v) => v + 1); // ricarica l'editor con la tabella importata
      setMessage(t('vp.saved'));
    } catch (err) {
      setMessage(t('rules.vpTableError', { error: (err as Error).message }));
    }
  }

  return (
    <div className="screen">
      <header className="bar">
        <a className="btn ghost" href={href({ name: 'home' })}>
          ← {t('back')}
        </a>
        <h1>{t('settings.title')}</h1>
      </header>

      {entryMode && (
        <section>
          <h2>{t('entry.title')}</h2>
          <p className="hint">{t('settings.entryIntro')}</p>
          <EntryModeChoice
            value={entryMode}
            onChange={(m) => void setSetting('entryMode', m)}
            name="default-entry-mode"
          />
        </section>
      )}

      <section>
        <h2>{t('rules.vpTable')}</h2>
        <p className="hint">{t('settings.vpIntro')}</p>
        {saved === null && <p className="hint">{t('vp.usingDefault')}</p>}
        {saved !== undefined && (
          <VpTableEditor key={version} table={table} onSave={(tb) => void save(tb)} />
        )}
        <div className="row">
          <label className="btn secondary file-btn">
            {t('rules.vpTableLoad')}
            <input type="file" accept="application/json,.json" onChange={onImport} />
          </label>
          <button
            type="button"
            className="btn secondary"
            onClick={() => download('tabella-vp.json', table)}
          >
            {t('vp.export')}
          </button>
          {saved && (
            <button type="button" className="btn secondary" onClick={() => void restoreDefault()}>
              {t('vp.restore')}
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="muted">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
