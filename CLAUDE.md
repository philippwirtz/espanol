# Español de bolsillo — Hinweise für die Arbeit am Code

Statische PWA für GitHub Pages, kein Build-Schritt, keine Abhängigkeiten.

| Datei | Inhalt | Lesen? |
|---|---|---|
| `app.js` | gesamte Logik (~1500 Zeilen): Speicher, Suche, Abfrage/SRS, Statistik, Cloud-Sync | ja, gezielt per Grep nach Abschnitt (`/* ===== Name =====`) |
| `style.css` | alle Stile | selten, per Grep nach Selektor |
| `index.html` | nur Markup und Tab-Leiste | selten |
| `content.js` | **~250 KB reine Daten** (GRAM, VOC, VERBS, SENT_DECKS) | nur bei Inhaltsänderung, nie komplett lesen |
| `examples.js` | ~140 KB Daten: `EX` = 2 Beispielsätze je Vokabelkarte (Schlüssel wie `c.key`, Zielwort in `[ ]` in ES und DE) | nur bei Inhaltsänderung, per Grep nach Schlüssel |
| `verbcore.js` | Verbtrainer, reine Logik: Formen aus `VERBS` lesen (`vtCards`), Antwort prüfen (`vtCheck`), Bewertungsstufe (`vtGradeOf`) | bei Änderungen am Trainer |
| `verbtrainer.js` | Verbtrainer, Planung (`vtPlan`, `vtGrade`) und Übungsbildschirm (Tab „Konjugieren“) | bei Änderungen am Trainer |
| `tests/` | Testseiten (`verbcore`, `verbstate`, `verbui`, `verbregress`, `sw`), siehe unten | beim Ändern des Trainers laufen lassen |
| `sw.js` | Service Worker | bei Änderungen an Dateiliste/Caching |
| `opt-worker.js` | Worker für den FSRS-Optimierer | selten |
| `fsrs/` | fsrs-browser 6.6 (WASM, angepasst, siehe `fsrs/LIESMICH.md`) | nie von Hand ändern |

## Regeln
- Jede Auslieferung: in `sw.js` `CACHE` hochzählen (`espanol-vN`), `APP_VERSION` in `app.js` anpassen, Cache-Zahl in README/ANLEITUNG nachziehen.
- Neue Datei → in `FILES` in `sw.js` eintragen.
- Gestaltung „Rueda“: Farben nur als Variablen aus `style.css` (`--pri` Añil, `--saf` Safran-Fläche, `--gold` Safran als Textfarbe, `--alert`, `--ok`; Text auf `--saf` immer `--on-saf`). Schrift Bricolage Grotesque variabel (`fonts/bricolage.woff2`, Lizenz `fonts/OFL.txt`): liegt im Cache-zuerst-Zweig des Service Workers, bei Änderung der Datei `CACHE` hochzählen. Höhen von Kopf und Tableiste misst `app.js` in `--hdr`/`--nav`; keine festen Pixelabstände dafür. Das Rad kommt aus `ruedaSvg(gefüllt,gesamt,{cls,label,classes})`.
- Der Service Worker darf Fremd-Adressen (api.github.com) nie cachen: sonst friert der Lernpartner-Stand ein. Seite, Skripte und Stile: erst Netz, nach `NET_WAIT` (4 s) die Kopie, falls es eine gibt; gespeichert werden nur gute Antworten (`res.ok`, bei `.js`/`.css` kein HTML). Test: `tests/sw.html`.
- Lernstand: `SRS` (`c` Karten, `hist` Karten/Tag, `ok` richtige/Tag, `rn`/`rok` Wiederholungen bzw. davon richtig je Tag (ohne neue Karten und freies Üben), `best` längste Serie, `gen` Generation, optional `w`/`wu` eigene FSRS-Parameter, `wauto` (false = Automatik aus), `wi` Angaben zur letzten Übernahme). Beim Abgleich gewinnt pro Karte die spätere echte Abfrage (`r`), bei gleichem Tag der spätere Zeitstempel (`u`); pro Tag gilt der höhere Wert (`mergeInto`, `cardNewer`). Grund: `spreadBacklog` setzt `u` neu, ein offline gebliebenes Gerät durfte sonst eine Abfrage vom anderen Gerät überschreiben. Preis: Ein Ausblenden („Brauche ich nicht“) auf einem Gerät mit älterem `r` verliert gegen eine spätere Abfrage anderswo, die Karte kommt dann zurück. Neue Felder dort mit aufnehmen.
- Planung: FSRS-6 mit Standardparametern (`W_DEF`, abgeglichen mit py-fsrs 6.3), Zielretention `q.ret`. Karte `{b,due,l,r,u,s,d,fr,x}`: `x`=1 „Brauche ich nicht“ (fällt über `cardsOf`/`allCards` aus allen Listen, Zurückholen in den Einstellungen), `s` Stabilität, `d` Schwierigkeit, `fr` = Tag, an dem s/d berechnet wurden. `b` (Stufe 0–8) wird nur aus `s` abgeleitet (`stageOfS`), bleibt aber gepflegt, damit ältere App-Versionen weiterlaufen. Fehlt `s` oder ist `fr≠r`, schätzt `memOf` den Zustand: `s` = Leitner-Intervall der Stufe, `d` so zurückgerechnet, dass die nächste pünktliche richtige Abfrage den Leitner-Schritt (≈ ×2) nachbildet, plus Fehler. (Bis 2026-10-20 stand dort pauschal d = 2,1 → Abstände ×4; die einmalige Korrektur über `q.fix1` ist entfernt; ein Gerät, das seitdem nie geöffnet wurde, behielte die alten Werte.) `nextIvl` (Knopf-Vorschau) und `grade` nutzen dieselben Funktionen; `reviewState(x,G,t,key)` ist der gemeinsame Schritt von `grade` (Vokabeln) und `vtGrade` (Verben); die Streuung in `ivlOf` hängt nur von Karte und Tag ab.
- Abfrageprotokoll `q.log` (`{k:[Kartenschlüssel], e:[[Tag,Nr,Bewertung 1–3,Tage seit letzter Abfrage|−1,Art,Richtung,ms]]}`): nur lokal und in der Sicherungsdatei, nie im Gist und nie in Wiederherstellungspunkten (zu groß). CSV-Export in den Einstellungen; daraus lassen sich mit py-fsrs eigene Parameter fitten und als `SRS.w` (+ `SRS.wu` = Zeitstempel) setzen. Nach jeder Regel- oder Parameteränderung `rescheduleFromLog()` laufen lassen (spielt alle protokollierten Bewertungen neu durch, nur Karten mit letztem Stand von diesem Gerät).
- Problemkarte (`isLeech`): `l` ≥ `LEECH` (4 Fehler im ersten Versuch) **und** Stufe < `LEECH_OUT` (5 = 30 Tage Stabilität). `l` selbst sinkt nie; das Label verschwindet über die Stufe.
- Abfragerichtung `auto`: neu → Deutsch, ab Stufe 1 → Spanisch (die Planung soll auf der schwereren Richtung beruhen).
- Beispielsätze: `q.exmode` je Profil (`word` · `show` · `cloze`). Nur Darstellung — Karte, Planung, Protokoll bleiben gleich. `exPick` wechselt den Satz nach Zahl der früheren Lerntage der Karte (am selben Tag stabil). Neue Vokabeln brauchen zwei Einträge in `EX`, sonst wird die Karte wie bisher als Wort abgefragt.
- Profile haben Präfix `P:<id>:` für `q.*`-Schlüssel; Cloud-Datei je Person im selben Gist.

- Verbtrainer: Karte `vb:<verb>:<form>` (Form `pres ind imp fut kond subj impv ger part`) in `SRS.c`, Aufbau wie Vokabelkarte; Planung über dieselben Funktionen (`fsrsNext`, `ivlOf`). Karte = Verb × Form, alle Personen werden getippt; Bewertung nach Fehlern im ersten Versuch (0 → Saß, bis ⌊n/3⌋ → Knapp, sonst Nochmal). Die Karten stehen **nicht** in `allCards()`, `q.log`, `SRS.ok/rn/rok/pace`, `day()`; die Serie (`SRS.hist`) zählt mit. Neue Karten pro Tag in `SRS.vnw` `{d,n}` (beim Abgleich: späterer Tag bzw. größeres `n`). Einstellungen je Profil `q.vbforms` (aktive Formen), `q.vbsize`, `q.vbnew`, `q.vbacc` (Akzente streng); `vtSettings()` liest sie bei jedem Aufruf frisch. `begunN` zählt `vb:`-Karten nicht. `verbtrainer.js` liest immer die globale `SRS` (wird bei Sync/Wiederherstellung neu zugewiesen).

## Prüfen ohne iPhone
Lokal `python -m http.server`, Seite im Browser öffnen, `fetch` auf `api.github.com` im Test mit einem Mock überschreiben (Gist mit zwei Lernstand-Dateien). Der Vorschau-Browser kann keinen Service Worker registrieren; Caching-Verhalten lässt sich nur auf dem Gerät prüfen.

## Eigene Parameter (Optimierer in der App)
- `optimize()` in app.js: vollständige Kartenverläufe aus `q.log` (erste Abfrage = neu, Erfolge im freien Üben weggelassen) → `computeParameters` von fsrs-browser im Worker (Rückfall: Hauptthread).
- Gütetest: Training nur mit Tagen vor dem 80-%-Schnitt, Log-Loss an den späteren Wiederholungen mit `optLoss` (nutzt `fsrsStep`, also exakt die Planungsformeln) gegen die aktuellen Parameter; übernommen wird nur, wenn nicht schlechter (+0,002). Dann Fit mit allem, Wiederherstellungspunkt, `SRS.w/wu/wi`, `rescheduleFromLog()`, Sync.
- Auslöser (`optDue`): ab 1000 Bewertungen, dann bei Verdopplung oder nach 30 Tagen (+200). Stand je Gerät in `q.opt` `{day,n,ok,ll0,ll1,test,ts,err}`; nach Fehler frühestens am nächsten Tag. Läuft 4 s nach Start/Rückkehr, nie während einer Runde.
- Abgleich: `wu` entscheidet, auch „zurück auf Standard" (`w` fehlt) wird übertragen.
- Die App-Formeln stimmen mit fsrs-rs überein (am 2026-10-27 Zustand für Zustand geprüft, Abweichung < 1e-5).

## Tests (Verbtrainer)
Im Projektordner `python -m http.server 8765`, dann je Seite `chrome --headless=new --user-data-dir=<neuer Ordner> --virtual-time-budget=30000 --dump-dom http://localhost:8765/tests/<seite>.html`; im Ergebnis muss `data-result="PASS …"` stehen. `sw` (Service Worker mit Attrappen), `verbcore` (reine Logik), `verbstate` (Lernstand, Planung, Abgleich; lädt die App im iframe), `verbui` (Bedienung). `verbregress` (Vokabelabfrage unverändert, Neuladen). `<neuer Ordner>` bei jedem Lauf wechseln, damit `localStorage` leer ist.
