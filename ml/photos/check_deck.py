"""Controlla che la cartella con le foto del mazzo sia completa (vedi ISTRUZIONI.md).

Uso: python check_deck.py <cartella>
Esce con codice 1 se mancano carte o ci sono doppioni.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["C", "D", "H", "S"]
EXPECTED = [f"{r}{s}" for s in SUITS for r in RANKS]
EXTRA = {"RETRO", "SCATOLA"}
IMAGE = {".jpg", ".jpeg", ".png", ".heic"}
JOKER = re.compile(r"^JK\d*$")


def check(folder: Path) -> int:
    names = [p.stem.upper() for p in sorted(folder.iterdir()) if p.suffix.lower() in IMAGE]
    counts = Counter(names)
    missing = [c for c in EXPECTED if c not in counts]
    duplicates = [n for n, k in counts.items() if k > 1]
    jokers = sorted(n for n in counts if JOKER.match(n))
    unknown = sorted(n for n in counts if n not in EXPECTED and n not in EXTRA and not JOKER.match(n))

    print(f"Foto trovate: {len(names)}")
    print(f"Carte: {52 - len(missing)}/52, jolly: {len(jokers)}")
    if missing:
        print("Mancano:", " ".join(missing))
    if not jokers:
        print("Manca almeno una foto del jolly (JK1.jpg).")
    if duplicates:
        print("Doppioni:", " ".join(sorted(duplicates)))
    if unknown:
        print("Nomi non riconosciuti:", " ".join(unknown))
    for extra in sorted(EXTRA - set(counts)):
        print(f"Facoltativo, ma utile: {extra}.jpg")
    ok = not missing and not duplicates and jokers
    print("OK: mazzo completo." if ok else "Da completare.")
    return 0 if ok else 1


if __name__ == "__main__":
    if len(sys.argv) != 2 or not Path(sys.argv[1]).is_dir():
        print(__doc__)
        sys.exit(2)
    sys.exit(check(Path(sys.argv[1])))
