import { parseVictoryPointTable, type RuleSet } from '@burracount/rules';
import { useId, useState, type ChangeEvent } from 'react';
import { t, type MessageKey } from '../i18n';

function NumberField({
  label,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: MessageKey;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
}) {
  const id = useId();
  return (
    <div className="field inline">
      <label htmlFor={id}>{t(label)}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            if (allowEmpty) onChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: MessageKey;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{t(label)}</span>
    </label>
  );
}

export function RulesEditor({
  rules,
  onChange,
}: {
  rules: RuleSet;
  onChange: (r: RuleSet) => void;
}) {
  const [vpError, setVpError] = useState<string | null>(null);
  const cv = rules.cardValues;
  const setCard = (k: keyof typeof cv) => (v: number | null) =>
    onChange({ ...rules, cardValues: { ...cv, [k]: v ?? 0 } });
  const set =
    <K extends keyof RuleSet>(k: K) =>
    (v: RuleSet[K]) =>
      onChange({ ...rules, [k]: v });
  const end = rules.endCondition;

  async function loadTable(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || end.type !== 'victoryPoints') return;
    try {
      const parsed = parseVictoryPointTable(JSON.parse(await file.text()));
      if (!parsed.ok) {
        setVpError(t('rules.vpTableError', { error: parsed.errors.join(' ') }));
        return;
      }
      setVpError(null);
      onChange({ ...rules, endCondition: { ...end, table: parsed.table } });
    } catch (err) {
      setVpError(t('rules.vpTableError', { error: (err as Error).message }));
    }
  }

  return (
    <div className="rules-editor">
      <fieldset>
        <legend>{t('rules.cardValues')}</legend>
        <NumberField label="rules.low" value={cv.low} onChange={setCard('low')} />
        <NumberField label="rules.high" value={cv.high} onChange={setCard('high')} />
        <NumberField label="rules.ace" value={cv.ace} onChange={setCard('ace')} />
        <NumberField label="rules.pinella" value={cv.pinella} onChange={setCard('pinella')} />
        <NumberField label="rules.joker" value={cv.joker} onChange={setCard('joker')} />
      </fieldset>

      <fieldset>
        <legend>{t('rules.burrachi')}</legend>
        <NumberField
          label="rules.minCards"
          value={rules.burracoMinCards}
          onChange={(v) => set('burracoMinCards')(v ?? 7)}
        />
        <NumberField
          label="rules.pulito"
          value={rules.burracoPulito}
          onChange={(v) => set('burracoPulito')(v ?? 0)}
        />
        <Toggle
          label="rules.semipulitoEnabled"
          checked={rules.burracoSemipulito !== null}
          onChange={(on) => set('burracoSemipulito')(on ? 150 : null)}
        />
        {rules.burracoSemipulito !== null && (
          <NumberField
            label="rules.semipulito"
            value={rules.burracoSemipulito}
            onChange={(v) => set('burracoSemipulito')(v ?? 0)}
          />
        )}
        <NumberField
          label="rules.sporco"
          value={rules.burracoSporco}
          onChange={(v) => set('burracoSporco')(v ?? 0)}
        />
        <NumberField
          label="rules.closing"
          value={rules.closing}
          onChange={(v) => set('closing')(v ?? 0)}
        />
        <NumberField
          label="rules.pozzetto"
          value={rules.pozzettoNotTaken}
          onChange={(v) => set('pozzettoNotTaken')(v ?? 0)}
        />
        <Toggle
          label="rules.setOfTwos"
          checked={rules.allowSetOfTwos}
          onChange={set('allowSetOfTwos')}
        />
      </fieldset>

      <fieldset>
        <legend>{t('rules.end')}</legend>
        {end.type === 'target' ? (
          <NumberField
            label="rules.target"
            value={end.target}
            onChange={(v) => onChange({ ...rules, endCondition: { ...end, target: v ?? 2005 } })}
          />
        ) : (
          <>
            <NumberField
              label="rules.handsPerRound"
              value={end.handsPerRound}
              onChange={(v) =>
                onChange({
                  ...rules,
                  endCondition: { ...end, handsPerRound: Math.max(1, v ?? 4) },
                })
              }
            />
            <NumberField
              label="rules.rounds"
              value={end.rounds}
              allowEmpty
              onChange={(v) => onChange({ ...rules, endCondition: { ...end, rounds: v } })}
            />
            <p className="hint">
              {end.table ? `${t('rules.vpTable')}: ${end.table.name}` : t('rules.vpTableNone')}
            </p>
            <div className="row">
              <label className="btn secondary file-btn">
                {t('rules.vpTableLoad')}
                <input type="file" accept="application/json,.json" onChange={loadTable} />
              </label>
              {end.table && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => onChange({ ...rules, endCondition: { ...end, table: null } })}
                >
                  {t('rules.vpTableRemove')}
                </button>
              )}
            </div>
            {vpError && (
              <p className="error" role="alert">
                {vpError}
              </p>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
}
