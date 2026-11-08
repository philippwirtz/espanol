# Verbtrainer (Konjugieren) — Entwurf

Stand: 2026-11-08 · Status: Entwurf, noch nicht freigegeben

## Ziel

Neben der Vokabelabfrage gibt es einen Trainer, in dem man Verbformen **selbst tippt** und die App sie prüft. Die Karten werden wie die Vokabeln mit FSRS über mehrere Tage geplant, liegen im selben Lernstand und werden mit synchronisiert. Wer die Vokabelabfrage kennt, soll sich sofort zurechtfinden.

## Entscheidungen (mit Philipp abgestimmt)

| Frage | Entscheidung |
|---|---|
| Planung | Geplant wie die Vokabeln (FSRS, eigener Kartentyp), nicht nur freies Üben |
| Antwortform | Tippen, App prüft automatisch |
| Karte | Verb × Form mit allen Personen dieser Form |
| Einbau | Eigener Trainer, gemeinsamer Lernstand (`SRS.c`), eigener Tab |
| Formen | Alle neun einzeln ein- und ausschaltbar |
| Akzente | Müssen stimmen, über einen Schalter abschaltbar |
| Serie | Zählt mit; Trefferquote und Protokoll nur für Vokabeln |

## Umfang

**Neun Formen** je Verb: Präsens (`pres`), Indefinido (`ind`), Imperfecto (`imp`), Futur (`fut`), Konditional (`kond`), Subjuntivo (`subj`), Imperativ (`impv`), Gerundio (`ger`), Partizip (`part`).

**Karten:** 46 Verben × 6 Zeiten = 276, dazu Imperativ bei 42 Verben, Gerundio und Partizip bei je 46 → **410 Karten**.

**Nicht Teil dieser Änderung:** Vorlesen der Formen, „Brauche ich nicht" je Karte, Verben außerhalb von `VERBS`, weitere Zeiten (zusammengesetzte Zeiten, Plusquamperfecto o. Ä.).

## Daten

Quelle ist `VERBS` in `content.js`. Es wird nichts dupliziert. `verbtrainer.js` liest beim Start das HTML jedes Eintrags:

- Eintrag: `{g, t, sub, h}` — `g` Gruppe (Unregelmäßig, Stammwechsler, Regelmäßig), `t` Infinitiv, `sub` deutsche Bedeutung, `h` HTML.
- Erste Tabelle: Spaltenköpfe Präsens, Indefinido, Imperfecto; sechs Zeilen (yo, tú, él/Ud., nos., vos., ellos). Zweite Tabelle: Futur, Konditional, Subjuntivo, gleiche Zeilen.
- Zeilen `Imperativ`, `Gerundium`, `Partizip` mit je einer Zelle. Der Imperativ steht bei allen 42 Verben im selben Format: `¡tenga! <span class="gloss">usted</span> · ¡tengan! <span class="gloss">ustedes</span> · ¡ten! <span class="gloss">tú</span>` (geprüft: keine Abweichungen, keine Alternativformen, kein `<b>`). Nach dem Entfernen der Tags ergeben sich drei Antworten in der Reihenfolge usted, ustedes, tú.
- Eine Form in `<b>…</b>` weicht vom regelmäßigen Muster ab (nur für die Anzeige).

Sonderfälle, die der Leser behandelt:

- `gustar`, `costar`, `doler`: nur 3. Person (Zeilen *él/Ud.* und *ellos*), kein Imperativ.
- `haber`: kein Imperativ; bei *él/Ud.* steht „ha / hay", beide Antworten zählen.
- Die Anzeigeschreibweise der Zeilen (`nos.`, `vos.`, `ellos`) wird für die Eingabefelder durch die ausgeschriebenen Pronomen ersetzt.

Der Leser liefert für jede Karte: Schlüssel, Verb, Bedeutung, Form, Liste `{label, antworten[], irregulär}`.

## Karten und Planung

**Schlüssel:** `vb:<infinitiv>:<form>`, z. B. `vb:tener:ind`. Der Schlüssel liegt in `SRS.c` und hat dieselben Felder wie eine Vokabelkarte (`b`, `due`, `l`, `r`, `u`, `s`, `d`, `fr`).

**Bewertung einer Karte** nach Fehlern im ersten Versuch (f Fehler bei n Antworten): f = 0 → *Saß* (3); 1 ≤ f ≤ ⌊n/3⌋ → *Knapp* (2); sonst *Nochmal* (1). Bei n = 6 sind 1–2 Fehler *Knapp*; bei n = 3 ist 1 Fehler *Knapp*; bei n = 1 und n = 2 ist jeder Fehler *Nochmal*. Leere Felder zählen als Fehler.

**Planung:** wie `grade()` in `app.js`: `fsrsNext` → `s`, `d`, `b = stageOfS(s)`, `r = fr = heute`, bei G ≥ 2 `due = heute + ivlOf(s, key, heute)`, bei G = 1 `due = heute` und `l` + 1. `u = Date.now()` nur bei echter Änderung.

**Nochmal-Karten** kommen ans Rundenende (bis `REDO_MAX`, wie bei Vokabeln). Bei der Wiederholung werden nur die zuvor falschen Formen gefragt.

**Tagesplan (eigenes Limit):**
- Fällige Karten sortiert nach `riskOf`, dann neue Karten.
- Neue Karten pro Tag: Standard 2 (`q.vbnew`), gezählt in `SRS.vnw = {d, n}`.
- Runde: Standard 5 Karten (`q.vbsize`).
- Das Zeitbudget (`plan`, `budgetCards`, `day().n`) der Vokabeln wird weder gelesen noch verändert.
- Neue Karten in der Reihenfolge der eingeschalteten Formen (Tabellenreihenfolge), innerhalb einer Form in `VERBS`-Reihenfolge (zuerst Unregelmäßige, dann Stammwechsler, dann Regelmäßige).
- Ausgeschaltete Formen sind aus Plan und Runde ausgeblendet; ihr Lernstand bleibt unverändert.

**Statistik:**
- Pro erste Antwort einer Karte: `SRS.hist[heute]` + 1 → Serie und Tageszähler zählen mit. `SRS.best` wird nachgeführt. Wie in `grade()` wird vor dem ersten Lernen eines Tages `snapshot('Tagesbeginn')` genommen (`SRS.snapDay`), damit auch ein reiner Verbtag einen Wiederherstellungspunkt hat.
- Nicht verändert: `day().n/ok/nw/rn/rok`, `SRS.ok`, `SRS.rn`, `SRS.rok`, `SRS.pace`, `q.log`. Der FSRS-Optimierer und die Zielretention bleiben damit auf Vokabeln eingestellt.
- Der Sync-Marker (`SYNC.pending`) wird wie in `grade()` gesetzt.
- Die Kartenzahl im Wiederherstellungspunkt und im Backup-Hinweis zählt Verbkarten mit (`Object.keys(SRS.c).length`); das ist gewollt.
- `begunN` (Zahl „begonnen", die Lernpartner sehen) überspringt Schlüssel mit Präfix `vb:`, damit die Verbkarten diese Zahl nicht aufblähen.

## Übungsbildschirm

- Kopf: Verb (groß), Bedeutung, Form (z. B. *Indefinido*), Fortschritt in der Runde.
- Eine Zeile je Antwort: Pronomen-Label (yo, tú, él/ella/Ud., nosotros, vosotros, ellos/ellas/Uds.; beim Imperativ usted, ustedes, tú) und Eingabefeld mit `autocorrect="off" autocapitalize="off" spellcheck="false"`. Bei zwei Antworten (`gustar` usw.) erscheinen nur diese Zeilen.
- Enter springt ins nächste Feld; nach dem letzten prüft die App. Dazu ein Knopf „Prüfen" und ein Knopf „Weiß ich nicht" (deckt auf, alle Formen falsch).
- Über der Tastatur eine Leiste mit **á é í ó ú ñ ü**, die in das fokussierte Feld einfügt.
- Ergebnis: Zeile grün oder rot; bei Fehler steht die richtige Form darunter. Abweichende Formen (`<b>`) erscheinen fett. Ist nur der Akzent falsch, steht „nur der Akzent fehlt/stimmt nicht".
- Danach der nächste Termin (`fmtIvl`) und „Weiter".

## Prüfung der Eingabe

- `trim`, Kleinschreibung, mehrfache Leerzeichen zu einem, Unicode-NFC.
- Beim Imperativ werden führendes „¡" und endendes „!" entfernt.
- Alternativen einer Antwort sind eine Liste (`ha`, `hay`); jede genügt.
- Schalter **Akzente müssen stimmen** (`q.vbacc`, Standard an): an → Vergleich mit Akzenten, bei Abweichung nur im Akzent der Hinweis „nur der Akzent …". Aus → Akzente (á é í ó ú) und Trema (ü) werden beim Vergleich ignoriert; ñ bleibt ein eigener Buchstabe.
- Ein falscher Akzent bei eingeschaltetem Schalter ist ein Fehler.

## Oberfläche und Einstellungen

- Fünfter Tab **Konjugieren** in `index.html` und im Abschnitt „Tabs" von `app.js`.
- Der Tab zeigt: Anzahl Fälliges und Neues (nur eingeschaltete Formen), Start-Knopf, Schalter für die neun Formen, Rundengröße, neue Karten pro Tag, „Akzente müssen stimmen".
- Einstellungsschlüssel je Profil: `q.vbforms` (Liste der aktiven Formen, Standard `["pres","ind","imp"]`), `q.vbsize`, `q.vbnew`, `q.vbacc`.
- Diese Schlüssel kommen in `BK_KEYS` (Sicherung) und in die Zeile, die beim Profilwechsel die Einstellungen lädt.

## Dateien und Eingriffe

| Datei | Änderung |
|---|---|
| `verbtrainer.js` (neu) | Leser, Karten, Planung, Bildschirm, Prüfung; nutzt `SRS`, `saveQ`, `store`, `fsrsNext`, `ivlOf`, `memOf`, `riskOf`, `st`, `today`, `fmtIvl`, `streak`, `loadJ`, `snapshot` aus `app.js` |
| `app.js` | Tab-Umschaltung, `BK_KEYS`, Profil-Ladezeile, `mergeInto` (`SRS.vnw`: pro Tag das Maximum), `begunN` (ohne `vb:`), Hook, damit der Trainer nach Sync/Profilwechsel neu rendert, `APP_VERSION` |
| `index.html` | Tab-Knopf, Container, `<script src="verbtrainer.js">` nach `app.js` |
| `style.css` | Zeilen, Eingabefelder, Sonderzeichenleiste, Ergebnisfarben. Die Tab-Leiste ist `display:flex` mit `flex:1` je Knopf, der fünfte Tab passt ohne Änderung; Beschriftung „Konjugieren" bei 11 px prüfen |

**Gemeinsame Variablen.** Die Skripte in `index.html` sind klassisch (kein `type="module"`), Reihenfolge `content.js`, `examples.js`, `app.js`; die obersten `const`/`let` von `app.js` sind für ein danach geladenes Skript sichtbar. `SRS` wird bei Profilwechsel, Wiederherstellung und Übernahme vom anderen Gerät neu zugewiesen (`SRS=rem`, `SRS=srs`, `SRS=JSON.parse(…)`). `verbtrainer.js` liest deshalb **immer die globale Variable `SRS`** und hält nie eine eigene Referenz darauf.
| `sw.js` | `verbtrainer.js` in `FILES`, `CACHE` hochzählen |
| `README.md`, `ANLEITUNG.md` | Cache-Zahl, kurzer Abschnitt zum Trainer |
| `CLAUDE.md` | Absatz zu Verbkarten (`vb:`-Schlüssel, `SRS.vnw`, `q.vb*`, was nicht in `q.log` steht) |

## Risiken

- **Ältere App-Versionen** (anderes Gerät) kennen `vb:`-Schlüssel nicht. Geprüft im Code: `mergeInto` läuft über `rem.c` und fügt Karten hinzu oder ersetzt sie nur bei neuerem `u`, es löscht nichts; `payload()` lädt den ganzen `SRS` hoch, also bleiben unbekannte Schlüssel und Felder (`SRS.vnw`) erhalten. Das einzige `delete SRS.c[…]` (Rückgängig bei „Brauche ich nicht") betrifft Vokabeln. Die Vokabelplanung läuft nur über `allCards()` und bleibt unberührt.
- **Zurücksetzen auf einem Gerät** (`gen` größer): der Weg `SRS=rem` ersetzt den ganzen Stand, auch die Verbkarten. Das ist das bestehende Verhalten für alle Karten und gilt für Verben genauso.
- **`rescheduleFromLog()`** fasst Verbkarten nicht an, weil sie nicht im Protokoll stehen.
- **Service Worker:** neue Datei muss in `FILES` stehen, sonst fehlt sie offline. Das Caching lässt sich nur auf dem Gerät prüfen.
- **HTML-Leser:** Ändert jemand das Format der Verbtabellen, bricht der Leser. Der Konsistenztest (unten) fängt das.

## Prüfung

1. **Konsistenztest** (einmalig, Wegwerf-Skript): alle 46 Verben ergeben die erwartete Zahl Formen; 410 Karten; Sonderfälle `gustar`, `costar`, `doler`, `haber` stimmen; 42 Imperative haben je drei Antworten.
2. **Antwortregeln** als reine Funktionen mit Beispielfällen: Akzent fehlt (*tomo* statt *tomó*) mit Schalter an und aus, „ha"/„hay", „¡tenga!", leere Felder, Bewertungsstufen für n = 1, 2, 3, 6.
3. **Im Browser** nach `CLAUDE.md` (`python -m http.server`): Runde spielen; Neuladen (Stand bleibt); zwei Profile; Formen aus- und einschalten; Abgleich mit dem Mock-Gist (Verbkarten kommen auf dem zweiten Gerät an, `SRS.vnw` wird als Maximum je Tag übernommen); Vokabelabfrage unverändert (Plan, Budget, Trefferquote).
4. **Auf dem iPhone** (nur Philipp): Offline-Start mit neuer Datei, Sonderzeichenleiste, Tastatur ohne Autokorrektur.
