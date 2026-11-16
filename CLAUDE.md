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
| `tipcore.js` | Tippkarten, reine Logik: getipptes Wort prüfen (`tipCheck` → ok · near · wrong), Eignung (`tipEligible`) | bei Änderungen an den Tippkarten |
| `verbtrainer.js` | Verbtrainer, Planung (`vtPlan`, `vtGrade`) und Übungsbildschirm (Tab „Konjugieren“) | bei Änderungen am Trainer |
| `tests/` | Testseiten (`verbcore`, `verbstate`, `verbui`, `verbregress`, `tipcore`, `tipstate`, `tipui`, `sw`), siehe unten | beim Ändern von Trainer oder Tippkarten laufen lassen |
| `sw.js` | Service Worker | bei Änderungen an Dateiliste/Caching |
| `opt-worker.js` | Worker für den FSRS-Optimierer | selten |
| `fsrs/` | fsrs-browser 6.6 (WASM, angepasst, siehe `fsrs/LIESMICH.md`) | nie von Hand ändern |

## Regeln
- Jede Auslieferung: in `sw.js` `CACHE` hochzählen (`espanol-vN`), `APP_VERSION` in `app.js` anpassen, Cache-Zahl in README/ANLEITUNG nachziehen.
- Neue Datei → in `FILES` in `sw.js` eintragen.
- Gestaltung „Rueda“: Farben nur als Variablen aus `style.css` (`--pri` Añil, `--saf` Safran-Fläche, `--gold` Safran als Textfarbe, `--alert`, `--ok`; Text auf `--saf` immer `--on-saf`). Schrift Bricolage Grotesque variabel (`fonts/bricolage.woff2`, Lizenz `fonts/OFL.txt`): liegt im Cache-zuerst-Zweig des Service Workers, bei Änderung der Datei `CACHE` hochzählen. Höhen von Kopf und Tableiste misst `app.js` in `--hdr`/`--nav`; keine festen Pixelabstände dafür. Das Rad kommt aus `ruedaSvg(gefüllt,gesamt,{cls,label,classes})`.
- Der Service Worker darf Fremd-Adressen (api.github.com) nie cachen: sonst friert der Lernpartner-Stand ein. Seite, Skripte und Stile: erst Netz, nach `NET_WAIT` (4 s) die Kopie, falls es eine gibt; gespeichert werden nur gute Antworten (`res.ok`, bei `.js`/`.css` kein HTML). Test: `tests/sw.html`.
- Lernstand und Planung (`SRS`, FSRS-6, Abgleich, `q.log`, Problemkarten, Tagesplan, Optimierer): vor Änderungen `docs/lernlogik.md` lesen. Immer beachten: neue `SRS`-Felder in den Abgleich (`mergeInto`, `cardNewer`) aufnehmen; nach Regel- oder Parameteränderung `rescheduleFromLog()`; `q.log` nie in Gist oder Wiederherstellungspunkte; `q.*`-Schlüssel haben je Profil das Präfix `P:<id>:`.
- Beispielsätze, Tippkarten, Verbtrainer: vor Änderungen `docs/abfrage-und-trainer.md` lesen. Immer beachten: Beispielsätze und Tippkarten ändern nur Darstellung bzw. Bewertungsvorschlag, Karte, Planung und Protokoll bleiben gleich; `vb:`-Karten stehen nicht in `allCards()`, `q.log`, `day()`.

## Prüfen ohne iPhone
Lokal `python -m http.server`, Seite im Browser öffnen, `fetch` auf `api.github.com` im Test mit einem Mock überschreiben (Gist mit zwei Lernstand-Dateien). Der Vorschau-Browser kann keinen Service Worker registrieren; Caching-Verhalten lässt sich nur auf dem Gerät prüfen.

## Tests
Im Projektordner `python -m http.server 8765`, dann je Seite `chrome --headless=new --user-data-dir=<neuer Ordner> --virtual-time-budget=30000 --dump-dom http://localhost:8765/tests/<seite>.html`; im Ergebnis muss `data-result="PASS …"` stehen. `<neuer Ordner>` bei jedem Lauf wechseln, damit `localStorage` leer ist.
- `sw` (Service Worker mit Attrappen), `verbregress` (Vokabelabfrage unverändert, Neuladen)
- Verbtrainer: `verbcore` (reine Logik), `verbstate` (Lernstand, Planung, Abgleich; lädt die App im iframe), `verbui` (Bedienung)
- Tippkarten: `tipcore` (Prüflogik), `tipstate` (Auswahl `tipWanted`/`tipAnswer`), `tipui` (Bedienung, auch im Modus „Im Satz“)
