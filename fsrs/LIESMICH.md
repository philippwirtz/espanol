# fsrs/ — FSRS-Optimierer als WebAssembly

Quelle: npm-Paket [`fsrs-browser`](https://www.npmjs.com/package/fsrs-browser) **6.6.0** (fsrs-rs 6.6, derselbe Optimierer wie in Anki), Lizenz BSD-3 (`LICENSE`).

Zwei Änderungen gegenüber dem Paket, damit es auf GitHub Pages und in Safari ohne Cross-Origin-Isolation läuft
(das Paket ist für Threads gebaut und verlangt sonst `SharedArrayBuffer`, das Safari nur mit COOP/COEP-Headern erlaubt):

1. `fsrs_browser_bg.wasm`: importierter Speicher von *geteilt* auf *nicht geteilt* umgestellt — `python3 unshare.py <original.wasm> fsrs_browser_bg.wasm`
2. `fsrs_browser.js`: `new WebAssembly.Memory({… shared:true})` → `shared:false`

Die App ruft nie `initThreadPool` auf; der Optimierer läuft einthreadig (1000 Bewertungen ≈ 20 ms, 30 000 ≈ 0,1 s).

Aktualisieren: neue Paketversion holen (`npm pack fsrs-browser@x.y.z`), beide Schritte wiederholen, in `sw.js` den
Snippet-Pfad unter `FILES` anpassen, falls sich der Hash im Ordnernamen ändert, Ergebnis gegen py-fsrs / fsrs-rs-python prüfen.
