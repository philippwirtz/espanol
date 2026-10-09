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
- Lernstand: `SRS` (`c` Karten, `hist` Karten/Tag, `ok` richtige/Tag, `best` längste Serie, `gen` Generation). Beim Abgleich wird pro Karte der neuere Stand, pro Tag der höhere Wert genommen (`mergeInto`). Neue Felder dort mit aufnehmen.
- Profile haben Präfix `P:<id>:` für `q.*`-Schlüssel; Cloud-Datei je Person im selben Gist.

## Prüfen ohne iPhone
Lokal `python -m http.server`, Seite im Browser öffnen, `fetch` auf `api.github.com` im Test mit einem Mock überschreiben (Gist mit zwei Lernstand-Dateien). Der Vorschau-Browser kann keinen Service Worker registrieren; Caching-Verhalten lässt sich nur auf dem Gerät prüfen.
