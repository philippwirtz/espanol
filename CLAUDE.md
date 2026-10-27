# Español de bolsillo — Hinweise für die Arbeit am Code

Statische PWA für GitHub Pages, kein Build-Schritt, keine Abhängigkeiten.

| Datei | Inhalt | Lesen? |
|---|---|---|
| `app.js` | gesamte Logik (~1000 Zeilen): Speicher, Suche, Abfrage/SRS, Statistik, Cloud-Sync | ja, gezielt per Grep nach Abschnitt (`/* ===== Name =====`) |
| `style.css` | alle Stile | selten, per Grep nach Selektor |
| `index.html` | nur Markup und Tab-Leiste | selten |
| `content.js` | **~250 KB reine Daten** (GRAM, VOC, VERBS, SENT_DECKS) | nur bei Inhaltsänderung, nie komplett lesen |
| `sw.js` | Service Worker | bei Änderungen an Dateiliste/Caching |
| `opt-worker.js` | Worker für den FSRS-Optimierer | selten |
| `fsrs/` | fsrs-browser 6.6 (WASM, angepasst, siehe `fsrs/LIESMICH.md`) | nie von Hand ändern |

## Regeln
- Jede Auslieferung: in `sw.js` `CACHE` hochzählen (`espanol-vN`), `APP_VERSION` in `app.js` anpassen, Cache-Zahl in README/ANLEITUNG nachziehen.
- Neue Datei → in `FILES` in `sw.js` eintragen.
- Der Service Worker darf Fremd-Adressen (api.github.com) nie cachen: sonst friert der Lernpartner-Stand ein.
- Lernstand: `SRS` (`c` Karten, `hist` Karten/Tag, `ok` richtige/Tag, `rn`/`rok` Wiederholungen bzw. davon richtig je Tag (ohne neue Karten und freies Üben), `best` längste Serie, `gen` Generation, optional `w`/`wu` eigene FSRS-Parameter, `wauto` (false = Automatik aus), `wi` Angaben zur letzten Übernahme). Beim Abgleich wird pro Karte der neuere Stand, pro Tag der höhere Wert genommen (`mergeInto`). Neue Felder dort mit aufnehmen.
- Planung: FSRS-6 mit Standardparametern (`W_DEF`, abgeglichen mit py-fsrs 6.3), Zielretention `q.ret`. Karte `{b,due,l,r,u,s,d,fr,x}`: `x`=1 „Brauche ich nicht“ (fällt über `cardsOf`/`allCards` aus allen Listen, Zurückholen in den Einstellungen), `s` Stabilität, `d` Schwierigkeit, `fr` = Tag, an dem s/d berechnet wurden. `b` (Stufe 0–8) wird nur aus `s` abgeleitet (`stageOfS`), bleibt aber gepflegt, damit ältere App-Versionen weiterlaufen. Fehlt `s` oder ist `fr≠r`, schätzt `memOf` den Zustand: `s` = Leitner-Intervall der Stufe, `d` so zurückgerechnet, dass die nächste pünktliche richtige Abfrage den Leitner-Schritt (≈ ×2) nachbildet, plus Fehler. (Bis 2026-10-20 stand dort pauschal d = 2,1 → Abstände ×4; einmalig über `q.fix1` korrigiert.) `nextIvl` (Knopf-Vorschau) und `grade` nutzen dieselben Funktionen; die Streuung in `ivlOf` hängt nur von Karte und Tag ab.
- Abfrageprotokoll `q.log` (`{k:[Kartenschlüssel], e:[[Tag,Nr,Bewertung 1–3,Tage seit letzter Abfrage|−1,Art,Richtung,ms]]}`): nur lokal und in der Sicherungsdatei, nie im Gist und nie in Wiederherstellungspunkten (zu groß). CSV-Export in den Einstellungen; daraus lassen sich mit py-fsrs eigene Parameter fitten und als `SRS.w` (+ `SRS.wu` = Zeitstempel) setzen. Nach jeder Regel- oder Parameteränderung `rescheduleFromLog()` laufen lassen (spielt alle protokollierten Bewertungen neu durch, nur Karten mit letztem Stand von diesem Gerät).
- Abfragerichtung `auto`: neu → Deutsch, ab Stufe 1 → Spanisch (die Planung soll auf der schwereren Richtung beruhen).
- Profile haben Präfix `P:<id>:` für `q.*`-Schlüssel; Cloud-Datei je Person im selben Gist.

## Prüfen ohne iPhone
Lokal `python -m http.server`, Seite im Browser öffnen, `fetch` auf `api.github.com` im Test mit einem Mock überschreiben (Gist mit zwei Lernstand-Dateien). Der Vorschau-Browser kann keinen Service Worker registrieren; Caching-Verhalten lässt sich nur auf dem Gerät prüfen.

## Eigene Parameter (Optimierer in der App)
- `optimize()` in app.js: vollständige Kartenverläufe aus `q.log` (erste Abfrage = neu, Erfolge im freien Üben weggelassen) → `computeParameters` von fsrs-browser im Worker (Rückfall: Hauptthread).
- Gütetest: Training nur mit Tagen vor dem 80-%-Schnitt, Log-Loss an den späteren Wiederholungen mit `optLoss` (nutzt `fsrsStep`, also exakt die Planungsformeln) gegen die aktuellen Parameter; übernommen wird nur, wenn nicht schlechter (+0,002). Dann Fit mit allem, Wiederherstellungspunkt, `SRS.w/wu/wi`, `rescheduleFromLog()`, Sync.
- Auslöser (`optDue`): ab 1000 Bewertungen, dann bei Verdopplung oder nach 30 Tagen (+200). Stand je Gerät in `q.opt` `{day,n,ok,ll0,ll1,test,ts,err}`; nach Fehler frühestens am nächsten Tag. Läuft 4 s nach Start/Rückkehr, nie während einer Runde.
- Abgleich: `wu` entscheidet, auch „zurück auf Standard" (`w` fehlt) wird übertragen.
- Die App-Formeln stimmen mit fsrs-rs überein (am 2026-10-27 Zustand für Zustand geprüft, Abweichung < 1e-5).
