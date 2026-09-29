import type { VictoryPointTable } from '@burracount/rules';
import { useState } from 'react';
import { t } from '../i18n';
import {
  addRow,
  draftFromTable,
  removeRow,
  tableFromDraft,
  type VpTableDraft,
} from '../lib/vpDraft';

interface Props {
  table: VictoryPointTable | null;
  onSave: (table: VictoryPointTable) => void;
}

export function VpTableEditor({ table, onSave }: Props) {
  const [draft, setDraft] = useState<VpTableDraft>(() => draftFromTable(table));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function change(fn: (d: VpTableDraft) => VpTableDraft) {
    setDraft(fn);
    setSaved(false);
  }

  function setCell(i: number, field: 'maxDiff' | 'winner' | 'loser', value: string) {
    change((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)) }));
  }

  function save() {
    const parsed = tableFromDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors([]);
    setSaved(true);
    onSave(parsed.table);
  }

  const last = draft.rows.length - 1;
  return (
    <div className="vp-editor">
      <div className="field">
        <label htmlFor="vp-name">{t('vp.name')}</label>
        <input
          id="vp-name"
          value={draft.name}
          onChange={(e) => change((d) => ({ ...d, name: e.target.value }))}
        />
      </div>
      <p className="hint">{t('vp.help')}</p>
      <table className="table vp-table">
        <thead>
          <tr>
            <th>{t('vp.diff')}</th>
            <th>{t('vp.winner')}</th>
            <th>{t('vp.loser')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {draft.rows.map((r, i) => (
            <tr key={i}>
              <td>
                {i === last ? (
                  <span className="muted">{t('vp.over')}</span>
                ) : (
                  <input
                    aria-label={t('vp.rowDiff', { n: i + 1 })}
                    inputMode="numeric"
                    value={r.maxDiff}
                    onChange={(e) => setCell(i, 'maxDiff', e.target.value)}
                  />
                )}
              </td>
              <td>
                <input
                  aria-label={t('vp.rowWinner', { n: i + 1 })}
                  inputMode="decimal"
                  value={r.winner}
                  onChange={(e) => setCell(i, 'winner', e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={t('vp.rowLoser', { n: i + 1 })}
                  inputMode="decimal"
                  value={r.loser}
                  onChange={(e) => setCell(i, 'loser', e.target.value)}
                />
              </td>
              <td>
                {draft.rows.length > 1 && (
                  <button
                    type="button"
                    className="btn ghost small"
                    aria-label={t('vp.removeRow', { n: i + 1 })}
                    onClick={() => change((d) => removeRow(d, i))}
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => change(addRow)}>
          + {t('vp.addRow')}
        </button>
        <button type="button" className="btn primary" onClick={save}>
          {t('vp.save')}
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="error" role="alert">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {saved && (
        <p role="status" className="muted">
          {t('vp.saved')}
        </p>
      )}
    </div>
  );
}
