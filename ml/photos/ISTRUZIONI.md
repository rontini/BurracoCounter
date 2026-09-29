# Foto del mazzo per M3 [UMANO]

Queste foto servono a creare il dataset sintetico (CLAUDE.md §7.3): da ogni carta si ritagliano gli angoli e si compongono decine di migliaia di tavoli finti, con ventagli, sovrapposizioni e luci diverse.

## Cosa serve

- **Un mazzo** del tipo che usate al tavolo: 52 carte + i jolly. Se nel burraco usate due mazzi uguali, basta fotografarne uno.
- **Un telefono** e un **foglio o tavolo di colore uniforme e opaco**, meglio grigio o scuro, comunque diverso dal bianco delle carte.
- **Luce naturale diffusa**, vicino a una finestra ma senza sole diretto. Niente flash.

## Come scattare ogni foto

1. **Una carta per foto**, di fronte, dritta, al centro, con un po' di bordo intorno. La carta deve occupare circa metà dell'inquadratura.
2. **Telefono parallelo al tavolo**, a 20–30 cm, senza zoom digitale.
3. **Nitida**: tocca la carta sullo schermo per mettere a fuoco. Nessun riflesso sugli indici negli angoli.
4. **Stessa luce e stesso sfondo** per tutto il mazzo.
5. **Un'ultima foto del retro** di una carta, e **una della scatola** del mazzo (per la marca).

## Nomi dei file

Rinomina ogni foto così (maiuscole indifferenti, estensione `.jpg`, `.jpeg`, `.png` o `.heic`):

| Carta                           | Nome                         |
| ------------------------------- | ---------------------------- |
| Asso di cuori                   | `AH.jpg`                     |
| 2 di fiori                      | `2C.jpg`                     |
| 10 di quadri                    | `10D.jpg`                    |
| Jack / Donna / Re di picche     | `JS.jpg`, `QS.jpg`, `KS.jpg` |
| Jolly (uno per disegno diverso) | `JK1.jpg`, `JK2.jpg`         |
| Retro                           | `RETRO.jpg`                  |
| Scatola                         | `SCATOLA.jpg`                |

Semi: **C** = fiori ♣, **D** = quadri ♦, **H** = cuori ♥, **S** = picche ♠.

Se è più comodo, puoi anche non rinominare nulla. Scatta però **sempre nello stesso ordine**:

- ♥ cuori da A a K, poi ♦ quadri, poi ♣ fiori, poi ♠ picche;
- poi i jolly, poi il retro, poi la scatola.

Rinomino io in base all'ordine.

## Controllo

Metti le foto in `ml/photos/deck/` e lancia:

```sh
python ml/photos/check_deck.py ml/photos/deck
```

Lo script elenca le carte mancanti, i doppioni e i nomi non riconosciuti.

## Dopo il mazzo: foto dei tavoli (più avanti)

Per il fine-tuning e il **golden set** servono **100–200 foto reali di fine smazzata**: giochi calati sul tavolo e carte in mano, fatte come le fareste giocando. Almeno 50 restano da parte per il test finale e non si usano mai per l'addestramento. Si possono raccogliere un po' per volta, partita dopo partita.
