import { scoreHand, type Card, type Match, type Meld } from '@burracount/rules';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { CardChip } from '../components/CardChip';
import { CardPicker } from '../components/CardPicker';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { db, saveMatch } from '../db';
import { t } from '../i18n';
import { cardShort } from '../lib/cardLabel';
import {
  draftProblems,
  draftsFromResult,
  emptyDrafts,
  meldStatus,
  toHandResult,
  type MeldDraft,
  type TeamDraft,
} from '../lib/handDraft';
import { newId } from '../lib/id';
import { href, navigate } from '../lib/router';

export function HandEntry({ id, handId }: { id: string; handId: string | null }) {
  const match = useLiveQuery(() => db.matches.get(id), [id], null);
  if (match === null) return null;
  if (!match) {
    return (
      <div className="screen">
        <p>{t('match.notFound')}</p>
      </div>
    );
  }
  return <HandForm key={handId ?? 'new'} match={match} handId={handId} />;
}

type Target = { type: 'meld'; index: number } | { type: 'hand'; player: number };

function describe(meld: Meld): string {
  const kind = meld.kind === 'run' ? t('hand.run') : t('hand.set');
  const cards = meld.cards.map(cardShort).join(' ');
  const note = meld.wild
    ? t('hand.wildAs', { rank: meld.wild.represents })
    : meld.cards.some((c) => c.rank === '2')
      ? t('hand.natural')
      : '';
  return `${kind}: ${cards}${note ? ` (${note})` : ''}`;
}

function HandForm({ match, handId }: { match: Match; handId: string | null }) {
  const existing = handId ? match.hands.find((h) => h.id === handId) : undefined;
  const handNumber = existing ? match.hands.indexOf(existing) + 1 : match.hands.length + 1;
  const allowTwos = match.ruleSet.allowSetOfTwos;

  const [drafts, setDrafts] = useState<TeamDraft[]>(() =>
    existing ? draftsFromResult(match, existing.result) : emptyDrafts(match),
  );
  const [tab, setTab] = useState<number | 'summary'>(0);
  const [target, setTarget] = useState<Target | null>(null);

  const teamIndex = tab === 'summary' ? 0 : tab;
  const draft = drafts[teamIndex]!;
  const team = match.teams[teamIndex]!;

  function update(fn: (d: TeamDraft) => TeamDraft, index = teamIndex) {
    setDrafts((all) => all.map((d, i) => (i === index ? fn(d) : d)));
  }

  function updateMeld(i: number, fn: (m: MeldDraft) => MeldDraft) {
    update((d) => ({ ...d, melds: d.melds.map((m, j) => (j === i ? fn(m) : m)) }));
  }

  function addCard(card: Card) {
    if (!target) return;
    if (target.type === 'meld') {
      updateMeld(target.index, (m) => ({ cards: [...m.cards, card], choice: null }));
    } else {
      update((d) => ({
        ...d,
        hands: d.hands.map((h, p) => (p === target.player ? [...h, card] : h)),
      }));
    }
  }

  function setClosed(closed: boolean) {
    update((d) => ({ ...d, closed, pozzettoTaken: closed ? true : d.pozzettoTaken }));
  }

  function switchTab(next: number | 'summary') {
    setTab(next);
    setTarget(null);
  }

  const result = toHandResult(drafts, allowTwos);
  const problems = draftProblems(drafts, allowTwos);

  async function save() {
    if (!result) return;
    const hand = {
      id: existing?.id ?? newId(),
      playedAt: existing?.playedAt ?? new Date().toISOString(),
      result,
    };
    const hands = existing
      ? match.hands.map((h) => (h.id === existing.id ? hand : h))
      : [...match.hands, hand];
    await saveMatch({ ...match, hands });
    navigate({ name: 'match', id: match.id });
  }

  const isTarget = (x: Target) =>
    target !== null &&
    target.type === x.type &&
    (x.type === 'meld'
      ? target.type === 'meld' && target.index === x.index
      : target.type === 'hand' && target.player === x.player);

  const toggleTarget = (x: Target) => setTarget(isTarget(x) ? null : x);

  return (
    <div className="screen">
      <header className="bar">
        <a className="btn ghost" href={href({ name: 'match', id: match.id })}>
          ← {t('back')}
        </a>
        <h1>{t('hand.title', { n: handNumber })}</h1>
      </header>

      <nav className="tabs" role="tablist">
        {match.teams.map((tm, i) => {
          const bad = problems.some((p) => p.kind === 'meld' && p.teamId === tm.id);
          return (
            <button
              key={tm.id}
              type="button"
              role="tab"
              aria-selected={tab === i}
              className={bad ? 'has-problem' : ''}
              onClick={() => switchTab(i)}
            >
              {tm.name}
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'summary'}
          onClick={() => switchTab('summary')}
        >
          {t('hand.summary')}
        </button>
      </nav>

      {tab === 'summary' ? (
        <section>
          {problems.some((p) => p.kind === 'meld') && (
            <p className="error" role="alert">
              {t('hand.problems')}
            </p>
          )}
          {problems.some((p) => p.kind === 'multipleClosed') && (
            <p className="error" role="alert">
              {t('hand.multipleClosed')}
            </p>
          )}
          {result &&
            scoreHand(result, match.ruleSet).map((s) => (
              <div key={s.teamId} className="summary-team">
                <h2>{match.teams.find((x) => x.id === s.teamId)?.name}</h2>
                <ScoreBreakdown score={s} />
              </div>
            ))}
          <button type="button" className="btn primary big" disabled={!result} onClick={save}>
            {t('hand.saveHand')}
          </button>
        </section>
      ) : (
        <section aria-label={team.name}>
          <h2>{t('hand.melds')}</h2>
          {draft.melds.map((m, i) => {
            const status = meldStatus(m, allowTwos);
            const meld = status.state === 'ok' ? status.meld : null;
            const bad = status.state === 'invalid' || status.state === 'ambiguous';
            return (
              <div key={i} className={`meld${bad ? ' problem' : ''}`}>
                <div className="meld-head">
                  <strong>
                    {t('hand.meld', { n: i + 1 })}
                    {meld && ` · ${meld.kind === 'run' ? t('hand.run') : t('hand.set')}`}
                  </strong>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      update((d) => ({ ...d, melds: d.melds.filter((_, j) => j !== i) }));
                      setTarget(null);
                    }}
                  >
                    {t('hand.removeMeld')}
                  </button>
                </div>
                <div className="chips">
                  {(meld?.cards ?? m.cards).map((c, j) => (
                    <CardChip
                      key={j}
                      card={c}
                      wild={meld?.wild?.index === j}
                      onRemove={() => {
                        // Rimuove la stessa carta dall'elenco inserito.
                        const k = m.cards.findIndex((x) => x.rank === c.rank && x.suit === c.suit);
                        updateMeld(i, (d) => ({
                          cards: d.cards.filter((_, idx) => idx !== k),
                          choice: null,
                        }));
                      }}
                    />
                  ))}
                  {m.cards.length === 0 && <span className="muted">{t('hand.noCards')}</span>}
                </div>
                {status.state === 'invalid' && (
                  <p className="error">{status.errors.map((e) => e.message).join(' ')}</p>
                )}
                {(status.state === 'ambiguous' ||
                  (status.state === 'ok' && status.interpretations.length > 1)) && (
                  <fieldset className="ambiguity">
                    <legend>{t('hand.ambiguous')}</legend>
                    {status.interpretations.map((interp, k) => (
                      <label key={k} className="toggle">
                        <input
                          type="radio"
                          name={`meld-${teamIndex}-${i}`}
                          checked={m.choice === k}
                          onChange={() => updateMeld(i, (d) => ({ ...d, choice: k }))}
                        />
                        <span>{describe(interp)}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <button
                  type="button"
                  className="btn secondary"
                  aria-expanded={isTarget({ type: 'meld', index: i })}
                  onClick={() => toggleTarget({ type: 'meld', index: i })}
                >
                  {isTarget({ type: 'meld', index: i }) ? t('hand.done') : t('hand.addCards')}
                </button>
                {isTarget({ type: 'meld', index: i }) && <CardPicker onPick={addCard} />}
              </div>
            );
          })}
          <button
            type="button"
            className="btn secondary big"
            onClick={() => {
              update((d) => ({ ...d, melds: [...d.melds, { cards: [], choice: null }] }));
              setTarget({ type: 'meld', index: draft.melds.length });
            }}
          >
            + {t('hand.addMeld')}
          </button>

          {team.players.map((player, p) => (
            <div key={p} className="player-hand">
              <h2>{t('hand.inHand', { name: player })}</h2>
              <div className="chips">
                {draft.hands[p]!.map((c, j) => (
                  <CardChip
                    key={j}
                    card={c}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        hands: d.hands.map((h, q) => (q === p ? h.filter((_, k) => k !== j) : h)),
                      }))
                    }
                  />
                ))}
                {draft.hands[p]!.length === 0 && <span className="muted">{t('hand.noCards')}</span>}
              </div>
              <button
                type="button"
                className="btn secondary"
                aria-expanded={isTarget({ type: 'hand', player: p })}
                aria-label={`${t('hand.addCards')} – ${player}`}
                onClick={() => toggleTarget({ type: 'hand', player: p })}
              >
                {isTarget({ type: 'hand', player: p }) ? t('hand.done') : t('hand.addCards')}
              </button>
              {isTarget({ type: 'hand', player: p }) && <CardPicker onPick={addCard} />}
            </div>
          ))}

          <div className="switches">
            <label className="toggle big">
              <input
                type="checkbox"
                checked={draft.closed}
                onChange={(e) => setClosed(e.target.checked)}
              />
              <span>{t('hand.closed')}</span>
            </label>
            <label className="toggle big">
              <input
                type="checkbox"
                checked={draft.pozzettoTaken}
                onChange={(e) => update((d) => ({ ...d, pozzettoTaken: e.target.checked }))}
              />
              <span>{t('hand.pozzetto')}</span>
            </label>
          </div>

          <button
            type="button"
            className="btn primary big"
            onClick={() =>
              switchTab(teamIndex + 1 < match.teams.length ? teamIndex + 1 : 'summary')
            }
          >
            {teamIndex + 1 < match.teams.length
              ? `${match.teams[teamIndex + 1]!.name} →`
              : `${t('hand.summary')} →`}
          </button>
        </section>
      )}
    </div>
  );
}
