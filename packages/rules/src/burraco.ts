import type { BurracoKind, Meld, RuleSet } from './types';

/**
 * Pulito: nessuna matta (una pinella nella sua posizione naturale non è matta).
 * Semipulito: almeno `burracoMinCards` carte naturali consecutive e la matta
 * a un'estremità della scala, o aggiunta a un tris; se disattivato conta come sporco.
 * Sporco: tutti gli altri burrachi con matta.
 */
export function classifyBurraco(
  meld: Meld,
  rules: Pick<RuleSet, 'burracoMinCards' | 'burracoSemipulito'>,
): BurracoKind | null {
  if (meld.cards.length < rules.burracoMinCards) return null;
  if (!meld.wild) return 'pulito';
  if (rules.burracoSemipulito === null) return 'sporco';

  const naturals = meld.cards.length - 1;
  const atEnd =
    meld.kind === 'set' || meld.wild.index === 0 || meld.wild.index === meld.cards.length - 1;
  return naturals >= rules.burracoMinCards && atEnd ? 'semipulito' : 'sporco';
}

export function burracoBonus(kind: BurracoKind | null, rules: RuleSet): number {
  switch (kind) {
    case 'pulito':
      return rules.burracoPulito;
    case 'semipulito':
      return rules.burracoSemipulito ?? rules.burracoSporco;
    case 'sporco':
      return rules.burracoSporco;
    default:
      return 0;
  }
}
