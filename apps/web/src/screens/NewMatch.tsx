import {
  createMatch,
  DEFAULT_RULESET,
  defaultTeams,
  TARGET_2005_RULESET,
  type GameMode,
  type RuleSet,
  type Team,
} from '@burracount/rules';
import { useId, useState, type FormEvent } from 'react';
import { RulesEditor } from '../components/RulesEditor';
import { requestPersistentStorage, saveMatch } from '../db';
import { t } from '../i18n';
import { newId } from '../lib/id';
import { href, navigate } from '../lib/router';

const MODES: GameMode[] = ['2v2', '1v1', '1v1v1'];

function defaultName(): string {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function NewMatch() {
  const nameId = useId();
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<GameMode>('2v2');
  const [teams, setTeams] = useState<Team[]>(() => defaultTeams('2v2'));
  const [rules, setRules] = useState<RuleSet>(DEFAULT_RULESET);
  const preset = rules.endCondition.type === 'target' ? 'target' : 'vp';

  function changeMode(m: GameMode) {
    setMode(m);
    setTeams(defaultTeams(m));
  }

  function changePreset(p: 'vp' | 'target') {
    const base = p === 'vp' ? DEFAULT_RULESET : TARGET_2005_RULESET;
    setRules({ ...rules, endCondition: base.endCondition });
  }

  function updateTeam(i: number, patch: Partial<Team>) {
    setTeams(teams.map((team, j) => (j === i ? { ...team, ...patch } : team)));
  }

  async function start(e: FormEvent) {
    e.preventDefault();
    // In 1v1 e a tre la squadra prende il nome del giocatore.
    const finalTeams = teams.map((team) =>
      team.players.length === 1 ? { ...team, name: team.players[0]! } : team,
    );
    const match = createMatch({
      id: newId(),
      name: name.trim() || defaultName(),
      mode,
      teams: finalTeams,
      ruleSet: rules,
      now: new Date().toISOString(),
    });
    await saveMatch(match);
    void requestPersistentStorage();
    navigate({ name: 'match', id: match.id });
  }

  return (
    <form className="screen" onSubmit={start}>
      <header className="bar">
        <a className="btn ghost" href={href({ name: 'home' })}>
          ← {t('back')}
        </a>
        <h1>{t('new.title')}</h1>
      </header>

      <div className="field">
        <label htmlFor={nameId}>{t('new.name')}</label>
        <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <fieldset>
        <legend>{t('new.mode')}</legend>
        <div className="segmented">
          {MODES.map((m) => (
            <label key={m} className={mode === m ? 'selected' : ''}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => changeMode(m)} />
              {t(`new.mode.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('new.teams')}</legend>
        {teams.map((team, i) => (
          <div key={team.id} className="team-editor">
            {team.players.length > 1 && (
              <input
                aria-label={t('new.teamName', { n: i + 1 })}
                className="team-name"
                value={team.name}
                onChange={(e) => updateTeam(i, { name: e.target.value })}
              />
            )}
            {team.players.map((p, j) => (
              <input
                key={j}
                aria-label={`${team.name} – ${t('new.player', { n: j + 1 })}`}
                value={p}
                onChange={(e) =>
                  updateTeam(i, {
                    players: team.players.map((q, k) => (k === j ? e.target.value : q)),
                  })
                }
              />
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('new.rules')}</legend>
        <div className="segmented">
          {(['vp', 'target'] as const).map((p) => (
            <label key={p} className={preset === p ? 'selected' : ''}>
              <input
                type="radio"
                name="preset"
                checked={preset === p}
                onChange={() => changePreset(p)}
              />
              {t(`new.preset.${p}`)}
            </label>
          ))}
        </div>
        <details>
          <summary>{t('new.customize')}</summary>
          <RulesEditor rules={rules} onChange={setRules} />
        </details>
      </fieldset>

      <button type="submit" className="btn primary big">
        {t('new.start')}
      </button>
    </form>
  );
}
