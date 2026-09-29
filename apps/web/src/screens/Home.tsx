import { scoreMatch } from '@burracount/rules';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ChangeEvent } from 'react';
import { db, exportMatches, importMatches, parseMatchesExport, type StoredMatch } from '../db';
import { t } from '../i18n';
import { href } from '../lib/router';

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MatchItem({ match }: { match: StoredMatch }) {
  const score = scoreMatch(match);
  const points = score.victoryPoints ?? score.totals;
  return (
    <li>
      <a className="match-item" href={href({ name: 'match', id: match.id })}>
        <strong>{match.name}</strong>
        <span className="muted">
          {match.teams.map((team) => `${team.name} ${points[team.id] ?? 0}`).join(' · ')}
        </span>
        <span className="muted small">{t('home.hands', { n: match.hands.length })}</span>
      </a>
    </li>
  );
}

export function Home() {
  const matches = useLiveQuery(() => db.matches.orderBy('updatedAt').reverse().toArray(), []);
  const [message, setMessage] = useState<string | null>(null);

  const withState = (matches ?? []).map((m) => ({ m, finished: scoreMatch(m).finished }));
  const open = withState.filter((x) => !x.finished).map((x) => x.m);
  const done = withState.filter((x) => x.finished).map((x) => x.m);

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const n = await importMatches(parseMatchesExport(JSON.parse(await file.text())));
      setMessage(t('home.imported', { n }));
    } catch (err) {
      setMessage(t('home.importError', { error: (err as Error).message }));
    }
  }

  return (
    <div className="screen">
      <header className="hero">
        <h1>{t('appName')}</h1>
        <p className="muted">{t('tagline')}</p>
      </header>

      <a className="btn primary big" href={href({ name: 'new' })}>
        {t('home.newMatch')}
      </a>

      {matches && matches.length === 0 && <p className="muted center">{t('home.empty')}</p>}

      {open.length > 0 && (
        <section>
          <h2>{t('home.inProgress')}</h2>
          <ul className="list">
            {open.map((m) => (
              <MatchItem key={m.id} match={m} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2>{t('home.finished')}</h2>
          <ul className="list">
            {done.map((m) => (
              <MatchItem key={m.id} match={m} />
            ))}
          </ul>
        </section>
      )}

      <section className="row">
        {matches && matches.length > 0 && (
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(
                `burracount-${new Date().toISOString().slice(0, 10)}.json`,
                exportMatches(matches),
              )
            }
          >
            {t('home.export')}
          </button>
        )}
        <label className="btn secondary file-btn">
          {t('home.import')}
          <input type="file" accept="application/json,.json" onChange={onImport} />
        </label>
      </section>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </div>
  );
}
