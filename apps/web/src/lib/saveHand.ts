import type { HandResult, Match } from '@burracount/rules';
import { saveMatch } from '../db';
import { newId } from './id';

/** Aggiunge la smazzata alla partita, o sostituisce quella con `handId`. */
export async function saveHand(match: Match, result: HandResult, handId?: string): Promise<void> {
  const existing = handId ? match.hands.find((h) => h.id === handId) : undefined;
  const hand = {
    id: existing?.id ?? newId(),
    playedAt: existing?.playedAt ?? new Date().toISOString(),
    result,
  };
  const hands = existing
    ? match.hands.map((h) => (h.id === existing.id ? hand : h))
    : [...match.hands, hand];
  await saveMatch({ ...match, hands });
}
