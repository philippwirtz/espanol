# Español de bolsillo — Hinweise für die Arbeit am Code

Statische PWA für GitHub Pages, kein Build-Schritt, keine Abhängigkeiten.

| Datei | Inhalt | Lesen? |
|---|---|---|
| `app.js` | gesamte Logik (~1000 Zeilen): Speicher, Suche, Abfrage/SRS, Statistik, Cloud-Sync | ja, gezielt per Grep nach Abschnitt (`/* ===== Name =====`) |
| `style.css` | alle Stile | selten, per Grep nach Selektor |
| `index.html` | nur Markup und Tab-Leiste | selten |
| `content.js` | **~250 KB reine Daten** (GRAM, VOC, VERBS, SENT_DECKS) | nur bei Inhaltsänderung, nie komplett lesen |
| `sw.js` | Service Worker | bei Änderungen an Dateiliste/Caching |

## Regeln
- Jede Auslieferung: in `sw.js` `CACHE` hochzählen (`espanol-vN`), `APP_VERSION` in `app.js` anpassen, Cache-Zahl in README/ANLEITUNG nachziehen.
- Neue Datei → in `FILES` in `sw.js` eintragen.
- Der Service Worker darf Fremd-Adressen (api.github.com) nie cachen: sonst friert der Lernpartner-Stand ein.
- Lernstand: `SRS` (`c` Karten, `hist` Karten/Tag, `ok` richtige/Tag, `rn`/`rok` Wiederholungen bzw. davon richtig je Tag (ohne neue Karten und freies Üben), `best` längste Serie, `gen` Generation, optional `w`/`wu` eigene FSRS-Parameter). Beim Abgleich wird pro Karte der neuere Stand, pro Tag der höhere Wert genommen (`mergeInto`). Neue Felder dort mit aufnehmen.
- Planung: FSRS-6 mit Standardparametern (`W_DEF`, abgeglichen mit py-fsrs 6.3), Zielretention `q.ret`. Karte `{b,due,l,r,u,s,d,fr}`: `s` Stabilität, `d` Schwierigkeit, `fr` = Tag, an dem s/d berechnet wurden. `b` (Stufe 0–8) wird nur aus `s` abgeleitet (`stageOfS`), bleibt aber gepflegt, damit ältere App-Versionen weiterlaufen. Fehlt `s` oder ist `fr≠r`, schätzt `memOf` den Zustand aus Stufe und Fehlerzahl. `nextIvl` (Knopf-Vorschau) und `grade` nutzen dieselben Funktionen; die Streuung in `ivlOf` hängt nur von Karte und Tag ab.
- Abfrageprotokoll `q.log` (`{k:[Kartenschlüssel], e:[[Tag,Nr,Bewertung 1–3,Tage seit letzter Abfrage|−1,Art,Richtung,ms]]}`): nur lokal und in der Sicherungsdatei, nie im Gist und nie in Wiederherstellungspunkten (zu groß). CSV-Export in den Einstellungen; daraus lassen sich mit py-fsrs eigene Parameter fitten und als `SRS.w` (+ `SRS.wu` = Zeitstempel) setzen.
- Profile haben Präfix `P:<id>:` für `q.*`-Schlüssel; Cloud-Datei je Person im selben Gist.

## Prüfen ohne iPhone
Lokal `python -m http.server`, Seite im Browser öffnen, `fetch` auf `api.github.com` im Test mit einem Mock überschreiben (Gist mit zwei Lernstand-Dateien). Der Vorschau-Browser kann keinen Service Worker registrieren; Caching-Verhalten lässt sich nur auf dem Gerät prüfen.
