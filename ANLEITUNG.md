# Español de bolsillo — auf dem iPhone installieren

## Was hier drin ist

| Datei | Zweck |
|---|---|
| `index.html` | Die App selbst: Referenz, Suche, Abfragemodus |
| `sw.js` | Service Worker — macht die App offline nutzbar |
| `manifest.webmanifest` | Name, Farben, Vollbildmodus |
| `icon-180.png` | Icon für den iPhone-Homescreen |
| `icon-512.png` | Icon für Android und App-Umschalter |

Alle fünf Dateien gehören in **dasselbe Verzeichnis**, ohne Unterordner.

## Hochladen zu GitHub Pages

1. Konto auf **github.com** anlegen, falls noch nicht vorhanden
2. **New repository** → Name z. B. `espanol` → Sichtbarkeit **Public** → Create
3. **Add file → Upload files** → alle fünf Dateien hineinziehen → **Commit changes**
4. **Settings → Pages** → Branch `main`, Ordner `/ (root)` → **Save**
5. Ein bis zwei Minuten warten

Die Adresse lautet dann:
`https://DEINNAME.github.io/espanol/`

## Auf den Homescreen legen

Adresse in **Safari** öffnen (nicht Chrome — nur Safari kann das auf iOS).
Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen.

Die App startet danach im Vollbild ohne Browserleiste und funktioniert offline,
sobald sie einmal geladen wurde.

## Aktualisieren

Neue Datei mit gleichem Namen hochladen und überschreiben. Damit der Service Worker
die neue Fassung ausliefert, in `sw.js` die erste Zeile hochzählen:

    const CACHE = 'espanol-v3';

Ohne diese Änderung bleibt auf dem iPhone die alte Fassung im Zwischenspeicher.
