# Tippkarten in der Vokabelabfrage — Design

Stand: 2026-11-16 · Größe: kleine Änderung (nur Darstellung und Bewertung in `nextCard`/`grade`, keine neue Karten- oder Planungslogik)

## Anlass
Die Vokabelabfrage ist heute reines Aufdecken mit Selbstbewertung („Nochmal / Knapp / Saß“). Das Wiedererkennen der Lösung beim Aufdecken fühlt sich schnell wie „gewusst“ an, ohne dass das Wort hätte gebildet werden können, und die FSRS-Planung hängt an dieser Selbstauskunft. Duolingo wirkt hier besser, weil die Antwort geliefert und geprüft wird. Der Nutzer wünscht sich: Einzelwörter eintippen, nicht bei jeder Abfrage, sondern gelegentlich.

## Ziele
- Ein Teil der Karten wird aktiv abgerufen (getippt) und von der App geprüft, nicht selbst bewertet.
- Die Bewertung aus dem Tippen speist dieselbe Planung wie bisher (`grade` → `reviewState`).
- Bedienung auf dem Handy bleibt flott; Tippfehler bestrafen nicht unfair.

## Nicht-Ziele
- Kein Tippen bei Satzkarten (`kind:'s'`), keine ganzen Sätze.
- Keine Tippkarten bei Richtung Spanisch → Deutsch (Deutsch tippen übt das Falsche).
- Keine neuen Übungsarten (Hören, Zuordnen, Wortbank) — mögliche spätere Schritte.
- Kein neues Protokollformat, keine neue Planung.

## Anti-Ziele (wäre ein Fehlschlag)
- Ein Tippfehler oder fehlender Akzent wirft eine gut gelernte Karte zurück.
- Neue, noch unbekannte Karten werden zur Tippkarte (Stufe 0 bleibt „verstehen“).- Der Lernstand verhält sich bei Tippkarten anders als bei Aufdeckkarten (Sync, Protokoll, Statistik).

## Ansätze (verglichen)
- **A (gewählt): eingestreute Tippkarten mit automatischer Bewertung.** Jede N-te Karte, Prüfung durch die App.
- B: Tippen als Schalter für alle Karten — auf dem Handy zu mühsam, keine Auswahl im Einzelfall.
- C: Tippen als Aufwärmen, Selbstbewertung bleibt — behebt das Problem der Selbsteinschätzung nicht.

## Entwurf
**Welche Karten:** `kind==='w'`, Stufe ≥ 1 (`x.b>0`), Richtung Deutsch → Spanisch (`toEs`). Ausgenommen: Antworten mit `/`, `,` oder `…` (24 von rund 1300 Einträgen).

**Wiederholungen (Entscheidung des Nutzers):** Wird eine Tippkarte mit „Nochmal“ bewertet, kommt ihre Wiederholung am Rundenende wieder als Tippkarte. Umgesetzt über ein Merkmal `c.tip`, das beim ersten Vorlegen der Karte einmal festgelegt wird und über `{...c,redo:…}` an die Wiederholung weitergereicht wird. So bleibt die Entscheidung auch dann stabil, wenn sich Stufe oder Richtung durch den Fehler ändern. Eine Aufdeckkarte bleibt in der Wiederholung Aufdeckkarte. Das Risiko (nach einem Fehlversuch sofort noch einmal tippen) ist akzeptiert.

**Wann:** pro Karte und Tag fest per `hashStr(c.key+'|tip|'+today())`, damit sich die Auswahl nach Neuladen nicht ändert (wie `chooseDir`). Einstellung `q.tip` je Profil: `aus` · `selten` (≈ jede 4. passende Karte, Standard) · `öfter` (≈ jede 2.).

**Prüfung:** `vtCheck` aus `verbcore.js`, Akzent-Strenge aus `q.vbacc` mitbenutzen. Ergebnis → Bewertung:
- richtig → Saß (3)
- nur Akzent falsch (bei strengem Schalter) oder genau ein Buchstabe daneben (Levenshtein 1, Wort ≥ 4 Buchstaben) oder Artikel fehlt → Knapp (2)
- sonst → Nochmal (1), die Lösung wird gezeigt

**Ablauf:** Die Karte zeigt statt „Tippen zum Aufdecken“ ein Textfeld mit „Prüfen“ und „Weiß ich nicht“. Nach dem Prüfen: Lösung sichtbar, Ergebnis (richtig / knapp / falsch) farbig, `grade()` läuft mit der abgeleiteten Stufe. Der Nutzer kann die Wertung mit einem Tipp eine Stufe hinunter- oder (bei falschem Tippfehler) hinaufkorrigieren, dann weiter. `logReview` bekommt keine neue Art; die Bedienung ist sonst identisch. Tempo (`SRS.pace`) zählt weiter die Zeit bis zur Bewertung.

**Sprachausgabe/Lautsprecher:** wie bisher; Spanisch erst nach dem Prüfen hörbar.

## Randbedingungen
- Eingabefeld auf iOS: `autocapitalize=off`, `autocorrect=off`, `spellcheck=false`, `lang=es`.
- Gleiche Normalisierung wie im Verbtrainer (`vtNorm`), nichts doppelt schreiben.
- `CACHE` in `sw.js` hochzählen, `APP_VERSION` anpassen, README/ANLEITUNG nachziehen (Projektregel).
- Neue Teststufe in `tests/verbregress.html` bzw. neue Seite: Prüfregel (richtig/knapp/falsch), Auswahl stabil pro Tag, Wiederholung einer Tippkarte bleibt Tippkarte, Aufdeckkarte bleibt Aufdeckkarte.

## Offen für den Bauenden
- Genaue Optik des Feldes im Rueda-Stil.
- Ob „Weiß ich nicht“ als eigener Knopf oder leerer Absenden-Versuch zählt.
- Schwelle für „Knapp“ bei kurzen Wörtern.
