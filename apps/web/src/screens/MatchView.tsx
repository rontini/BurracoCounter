import { scoreMatch, type Match } from '@burracount/rules';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { db, deleteMatch, saveMatch } from '../db';
import { t } from '../i18n';
import { href, navigate } from '../lib/router';

export function MatchView({ id }: { id: string }) {
  const match = useLiveQuery(() => db.matches.get(id), [id], null);
  if (match === null) return null; // caricamento
  if (!match) return <NotFound />;
  return <Scoreboard match={match} />;
}

function NotFound() {
  return (
    <div className="screen">
      <p>{t('match.notFound')}</p>
      <a className="btn secondary" href={href({ name: 'home' })}>
        ← {t('back')}
      </a>
    </div>
  );
}

function Scoreboard({ match }: { match: Match }) {
  const score = scoreMatch(match);
  const end = match.ruleSet.endCondition;
  const teamName = (id: string) => match.teams.find((x) => x.id === id)?.name ?? id;
  const winners = score.winnerIds.map(teamName);

  async function toggleFinished() {
    await saveMatch({ ...match, finishedAt: match.finishedAt ? null : new Date().toISOString() });
  }

  async function remove() {
    if (!window.confirm(t('match.deleteConfirm'))) return;
    await deleteMatch(match.id);
    navigate({ name: 'home' });
  }

  async function removeHand(handId: string, n: number) {
    if (!window.confirm(t('match.deleteHandConfirm', { n }))) return;
    await saveMatch({ ...match, hands: match.hands.filter((h) => h.id !== handId) });
  }

  return (
    <div className="screen">
      <header className="bar">
        <a className="btn ghost" href={href({ name: 'home' })}>
          ← {t('back')}
        </a>
        <h1>{match.name}</h1>
      </header>

      {score.finished && winners.length > 0 && (
        <p className="banner" role="status">
          🏆{' '}
          {winners.length === 1
            ? t('match.winner', { name: winners[0]! })
            : t('match.tie', { names: winners.join(', ') })}
        </p>
      )}

      <section className="totals" aria-label={t('match.total')}>
        {match.teams.map((team) => (
          <div key={team.id} className="total-card">
            <span className="team">{team.name}</span>
            {team.players.length > 1 && (
              <span className="muted small">{team.players.join(' e ')}</span>
            )}
            {score.victoryPoints ? (
              <>
                <span className="points" data-testid={`vp-${team.id}`}>
                  {score.victoryPoints[team.id]} {t('match.vp')}
                </span>
                <span className="muted small">{score.totals[team.id]} punti</span>
              </>
            ) : (
              <span className="points" data-testid={`total-${team.id}`}>
                {score.totals[team.id]}
              </span>
            )}
          </div>
        ))}
      </section>

      {!score.finished && (
        <a className="btn primary big" href={href({ name: 'hand', id: match.id, handId: null })}>
          {t('match.newHand')}
        </a>
      )}

      {end.type === 'victoryPoints' && score.rounds.length > 0 && (
        <section>
          <h2>{t('match.vp')}</h2>
          <table className="table">
            <thead>
              <tr>
                <th />
                {match.teams.map((team) => (
                  <th key={team.id}>{team.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {score.rounds.map((r, i) => {
                const values = match.teams.map((team) => r.totals[team.id] ?? 0);
                const diff = Math.abs((values[0] ?? 0) - (values[1] ?? 0));
                return (
                  <tr key={i}>
                    <th scope="row">
                      {t('match.round', { n: i + 1 })}
                      {!r.complete && <small> ({t('match.roundInProgress')})</small>}
                      {r.complete && !r.victoryPoints && values.length === 2 && (
                        <small> ({t('match.diff', { n: diff })})</small>
                      )}
                    </th>
                    {match.teams.map((team) => (
                      <td key={team.id}>
                        {r.totals[team.id]}
                        {r.victoryPoints && <strong> · {r.victoryPoints[team.id]} VP</strong>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2>{t('match.history')}</h2>
        {match.hands.length === 0 && <p className="muted">{t('match.noHands')}</p>}
        <ol className="history" reversed>
          {[...match.hands].reverse().map((hand) => {
            const n = match.hands.indexOf(hand) + 1;
            const scores = score.hands[n - 1]!;
            return (
              <li key={hand.id}>
                <details>
                  <summary>
                    <span>{t('match.hand', { n })}</span>
                    <span className="hand-totals">
                      {scores.map((s) => (
                        <span key={s.teamId}>
                          {teamName(s.teamId)} <strong>{s.total}</strong>
                        </span>
                      ))}
                    </span>
                  </summary>
                  <div className="hand-details">
                    {scores.map((s) => (
                      <div key={s.teamId}>
                        <h3>{teamName(s.teamId)}</h3>
                        <ScoreBreakdown score={s} />
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <a
                      className="btn secondary"
                      href={href({ name: 'hand', id: match.id, handId: hand.id })}
                    >
                      {t('match.edit')}
                    </a>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => removeHand(hand.id, n)}
                    >
                      {t('match.deleteHand')}
                    </button>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="row">
        <button type="button" className="btn secondary" onClick={toggleFinished}>
          {match.finishedAt ? t('match.reopen') : t('match.finish')}
        </button>
        <button type="button" className="btn danger" onClick={remove}>
          {t('match.delete')}
        </button>
      </section>
    </div>
  );
}
