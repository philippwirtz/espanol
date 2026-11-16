# Tippkarten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Teil der Vokabelkarten (Einzelwörter, Deutsch → Spanisch, ab Stufe 1) wird getippt statt aufgedeckt; die App prüft das Wort und schlägt die Bewertung vor.

**Architecture:** Neue reine Logikdatei `tipcore.js` (Prüfung, Eignung) nach dem Muster von `verbcore.js`. In `app.js` entscheidet `tipWanted` einmal je Karte (Merkmal `c.tip`, wird von Wiederholungen geerbt), `nextCard`/`reveal` zeigen statt „Tippen zum Aufdecken“ ein Eingabefeld. Bewertet wird weiter über die unveränderte `grade(g)`; die Tippprüfung wählt nur die vorgeschlagene Stufe vor.

**Tech Stack:** Vanilla JS, statische PWA, Tests als HTML-Seiten (`tests/harness.js`, Chrome headless). Kein Build.

**Spec:** `docs/superpowers/specs/2026-11-16-tippkarten-design.md`

## Global Constraints

- Arbeitsbranch `feature/tippkarten` (von `main`, Stand `2fa127e` oder neuer). Commit-Schritte nur ausführen, wenn der Nutzer das Committen erlaubt hat; sonst Änderungen stehen lassen und melden.
- Neue Datei → in `FILES` in `sw.js` eintragen und per `<script>` in `index.html` laden (nach `verbcore.js`).
- Farben nur als Variablen aus `style.css` (`--pri`, `--ok`, `--alert`, `--gold`, `--rule`, `--ink`, `--soft`, `--bg`); keine festen Pixelhöhen für Kopf/Tableiste.
- Planung, `q.log`, Sync unverändert: Tippkarten rufen dieselbe `grade(g)` (g: 0 Nochmal · 1 Knapp · 2 Saß).
- Einstellung `q.tip` ∈ `off` · `rare` (jede 4. passende Karte, Standard) · `often` (jede 2.), je Profil, in `BK_KEYS`.
- Akzentstrenge aus `vtSettings().strict` (Einstellung `q.vbacc`) wiederverwenden.
- Tippkarte nur: Schlüssel beginnt mit `w:`, `st(c.key).b>0`, Richtung Deutsch → Spanisch, Antwort ohne `/`, `,`, `…`, nicht im Beispielmodus `cloze` mit vorhandenem Satz.
- Auslieferung: `CACHE` in `sw.js` auf `espanol-v31`, `APP_VERSION` auf `'2026-11-16 · 29'`, Cache-Zahl in README/ANLEITUNG nachziehen.
- Testlauf: im Projektordner `python -m http.server 8765`, je Seite `chrome --headless=new --user-data-dir=<neuer Ordner> --virtual-time-budget=30000 --dump-dom http://localhost:8765/tests/<seite>.html`; erwartet `data-result="PASS …"`. `<neuer Ordner>` je Lauf wechseln.

## Review Focus

- Klick auf das Eingabefeld (Blase bis `#card`) darf die Karte nicht aufdecken.
- Leeres Absenden und „Weiß ich nicht“ → Vorschlag „Nochmal“, kein Skriptfehler.
- Nächste Tippkarte (auch Wiederholung, auch nach „Brauche ich nicht“) startet mit leerem, aktivem Feld.
- Eingaben mit ñ, Akzenten, `¿ ¡ ? !`, doppelten Leerzeichen und Großschreibung (iOS-Tastatur) werden richtig geprüft.
- Wiederholung einer Tippkarte bleibt Tippkarte in derselben Richtung, auch wenn der Fehler die Stufe ändert.

---

### Task 1: Prüflogik `tipcore.js`

**Files:**
- Create: `tipcore.js`, `tests/tipcore.html`
- Modify: `index.html` (Script-Zeile nach `verbcore.js`), `sw.js` (`FILES`)

**Interfaces:**
- Consumes: `vtNorm(s,strict)` aus `verbcore.js`.
- Produces: `tipEligible(es:string):boolean`, `tipCheck(input:string, answer:string, strict:boolean):'ok'|'near'|'wrong'`.

- [ ] **Step 1: Test schreiben** — `tests/tipcore.html` (Muster `tests/verbcore.html`: lädt `../content.js`, `../verbcore.js`, `../tipcore.js`, `harness.js`) mit diesen Prüfungen:
  - ok: `tipCheck('hola','hola',true)`, `tipCheck('  HOLA ','hola',true)`, `tipCheck('cómo está','¿Cómo está?',true)`, `tipCheck('¿Cómo   está?','cómo está',true)`
  - Akzent: `tipCheck('adios','adiós',true)==='near'`, `tipCheck('adios','adiós',false)==='ok'`
  - Artikel fehlt: `tipCheck('hijo','el hijo',true)==='near'`; `tipCheck('el hijo','el hijo',true)==='ok'`
  - Ein Buchstabe: `tipCheck('cosa','casa',true)==='near'`; `tipCheck('coso','casa',true)==='wrong'`
  - zu kurz für „near“: `tipCheck('sol','sal',true)==='wrong'`; ñ ist eigener Buchstabe: `tipCheck('ano','año',false)==='wrong'`, `tipCheck('año','año',false)==='ok'`
  - leer: `tipCheck('','casa',true)==='wrong'`, `tipCheck('   ','casa',true)==='wrong'`
  - `tipEligible`: `'hola'`, `'buenos días'`, `'el hijo'` → true; `'el hijo / la hija'`, `'ir, venir'`, `'etc …'` → false

- [ ] **Step 2: Test laufen lassen** — Erwartet: FAIL (`tipCheck` nicht definiert, Skriptfehler im Ergebnis).

- [ ] **Step 3: `tipcore.js` anlegen** mit `tipEligible` und `tipCheck` (Signaturen oben). Regeln von `tipCheck` in dieser Reihenfolge: Satzzeichen `¿ ¡ ? !` und Rand-Punkte aus Eingabe und Antwort entfernen, dann `vtNorm`; leer → `wrong`; gleich mit Akzenten → `ok`; gleich ohne Akzente → `strict?'near':'ok'`; Antwort beginnt mit Artikel (`el|la|los|las|un|una`) und Eingabe gleicht der Antwort ohne Artikel (ohne Akzente verglichen) → `near`; Levenshtein-Abstand genau 1 auf den akzentlosen Formen und Antwort ≥ 4 Zeichen → `near`; sonst `wrong`. Kopfkommentar im Stil von `verbcore.js` (Deutsch, kurz).

- [ ] **Step 4: Einbinden** — `<script src="tipcore.js"></script>` direkt nach `verbcore.js` in `index.html`; `'./tipcore.js'` in `FILES` in `sw.js`.

- [ ] **Step 5: Test laufen lassen** — Erwartet: `PASS n/n`. Zusätzlich `tests/sw.html` und `tests/verbcore.html` laufen lassen (unverändert PASS).

- [ ] **Step 6: Commit** (inkl. Design- und Plandokument)

```bash
git switch -c feature/tippkarten
git add tipcore.js tests/tipcore.html index.html sw.js docs/superpowers
git commit -m "Tippkarten: Prüflogik tipcore.js"
```

### Task 2: Einstellung `q.tip` und Auswahl `tipWanted`

**Files:**
- Modify: `app.js` (Abschnitt „Abfrage“: nach `exMode`/`EX_HINT`; `renderPick`; Handler neben `#segex`; `BK_KEYS`; Profilwechsel-Zeile mit `exMode=loadJ('q.exmode','word')`), `index.html` (Einstellungszeile unter `#exHint`)
- Create: `tests/tipstate.html` (Muster `tests/verbregress.html`: App im iframe, `ev(...)` auf `contentWindow`)

**Interfaces:**
- Consumes: `tipEligible` (Task 1), `hashStr`, `today`, `st`, `exPick`, `exMode`, `store`, `loadJ`.
- Produces: globale `tipMode` (`'off'|'rare'|'often'`), `loadTip():string`, `tipWanted(c,x,toEs:boolean):boolean`, `BK_KEYS` enthält `'q.tip'`.

- [ ] **Step 1: Test schreiben** — `tests/tipstate.html`. Aufbau: `SRS.c={}`, für 200 Wortkarten (`allCards().filter(c=>c.key.startsWith('w:')).slice(0,200)`) `SRS.c[key]={b:2,due:0,l:0}`. Prüfungen:
  - `tipMode='off'`: `tipWanted` für alle 200 false
  - `'rare'`: Anteil true zwischen 15 % und 35 %; `'often'`: zwischen 35 % und 65 %
  - zweimal aufgerufen gleiches Ergebnis (stabil am Tag)
  - false bei `b===0`, bei `toEs=false`, bei Satzkarte (`allCards().find(c=>c.key.startsWith('s:'))`), bei Wortkarte mit `/` in `c.it[1]`
  - `exMode='cloze'` und Karte mit `EX[c.key]` → false; `exMode='word'` → Auswahl wie zuvor
  - `loadTip()` liefert `'rare'` ohne gespeicherten Wert und bei ungültigem Wert (`store.set('q.tip','"x"')`); `BK_KEYS.includes('q.tip')`
  - nach Klick auf `#segtip button[data-t="off"]`: `localStorage.getItem(nsk('q.tip'))==='"off"'` und `tipMode==='off'`

- [ ] **Step 2: Test laufen lassen** — Erwartet: FAIL (`tipWanted` fehlt).

- [ ] **Step 3: `app.js`** — `const TIP_N={rare:4,often:2}`; `loadTip()`; `let tipMode=loadTip()`; `tipWanted` nach der Eignungsliste aus Global Constraints, Auswahl `hashStr(c.key+'|tip|'+today())%TIP_N[tipMode]===0` (wie `chooseDir` pro Karte und Tag fest). `TIP_HINT` mit Texten für `off`/`rare`/`often` (jede 4./jede 2. passende Karte; „Nur Einzelwörter ab der zweiten Abfrage, Richtung → ES.“; `renderPick` hängt „ Gilt nur für dieses Profil.“ an). `'q.tip'` in `BK_KEYS`; im Profilwechsel `tipMode=loadTip()`; `renderPick` setzt `aria-pressed` und Hint, Handler neben `#segex` speichert `q.tip`.

- [ ] **Step 4: `index.html`** — unter `#exHint` neue Zeile im selben Markup: Label „Tippen“, `<div class="seg" id="segtip">` mit Buttons `data-t="off"` „Aus“, `rare` „Selten“, `often` „Öfter“; darunter `<p class="shint" id="tipHint"></p>`.

- [ ] **Step 5: Test laufen lassen** — Erwartet `PASS`. `tests/verbregress.html` laufen lassen (unverändert PASS).

- [ ] **Step 6: Commit**

```bash
git add app.js index.html tests/tipstate.html
git commit -m "Tippkarten: Einstellung q.tip und Auswahl tipWanted"
```

### Task 3: Tippkarte in der Abfrage

**Files:**
- Modify: `index.html` (Karte), `style.css`, `app.js` (`nextCard`, `reveal`, neue `tipSubmit`)
- Create: `tests/tipui.html`

**Interfaces:**
- Consumes: `tipWanted`, `tipCheck` (Task 1/2), `vtSettings().strict`, `reveal`, `grade`.
- Produces: `c.tip:boolean` an der Queue-Karte (vom ersten Vorlegen an, von Wiederholungen über `{...c,redo}` geerbt), `R.tipSug:null|0|1|2` (vorgeschlagene Stufe, `null` solange nicht geprüft), `tipSubmit(giveUp:boolean):void`.

- [ ] **Step 1: Test schreiben** — `tests/tipui.html` (iframe-Muster wie `verbregress`). Vorbereitung: `SRS.c={}`, `tipMode='often'`, Karte `k` mit `tipWanted(k,{b:2},true)===true` suchen, `SRS.c[k.key]={b:2,due:0,l:0,s:5,d:5,r:today()-5,fr:today()-5}`, dann `startRound('T',()=>[k],'normal')` und `R.queue=[{...k,redo:0}]; R.total=1; nextCard()`. Prüfungen:
  - Tippkarte: `#qtip` sichtbar, `#qtap`, `#qans`, `#rowJudge` verborgen, `R.queue[0].tip===true`
  - Klick auf `#qtipin` (Event bis `#card`) → `#qans` bleibt verborgen
  - richtige Eingabe + Submit: `#qans` und `#rowJudge` sichtbar, `#qres` hat Klasse `ok`, `#got` hat Klasse `sug`, `#again`/`#hard` nicht; `R.tipSug===2`
  - Klick `#got` → `SRS.c[k.key].r===today()`, letzter `logLoad().e` hat Bewertung 3
  - falsche Eingabe: `#again` hat `sug`, Klick `#again` → `R.queue` enthält Wiederholung mit `tip===true` und `toEs===true`; angezeigt wird sie mit leerem, aktivem `#qtipin` (`value===''`, `disabled===false`), `#again` hat kein `sug` mehr
  - `#qtipno` („Weiß ich nicht“) und leeres Absenden → `R.tipSug===0`
  - Akzent fehlt (Wort mit Akzent wählen, strict an): `R.tipSug===1`, `#hard` hat `sug`
  - `tipMode='off'`, neue Karte: `#qtap` sichtbar, `#qtip` verborgen
  - Tippkarte anzeigen, `#qskip` klicken → keine Ausnahme; nächste Tippkarte hat leeres Feld
  - Eingabe `'  '+k.it[1].toUpperCase()+'  '` (Großschreibung, Randleerzeichen) → `R.tipSug===2`; ein Wort mit ñ korrekt eingegeben → `R.tipSug===2`

- [ ] **Step 2: Test laufen lassen** — Erwartet: FAIL (`#qtip` fehlt).

- [ ] **Step 3: `index.html` + `style.css`** — in `#card` nach `#qtap` ein `<form class="qtip" id="qtip" hidden autocomplete="off">` mit `<input id="qtipin" type="text" lang="es" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Spanische Übersetzung">` und zwei Buttons (`#qtipok` „Prüfen“ als `type=submit`, `#qtipno` „Weiß ich nicht“); danach `<div class="qres" id="qres" hidden></div>`. CSS: Feld wie `.vtrow input` (Zeile ~503), `.qres.ok/.near/.bad` mit `--ok`/`--gold`/`--alert`, `.judge button.sug` mit `box-shadow:0 0 0 2px var(--pri)`. `[hidden]`-Regeln wie bei `.qtap[hidden]`.

- [ ] **Step 4: `app.js`** — in `nextCard`: nach `toEs` `if(c.tip===undefined) c.tip=tipWanted(c,x,toEs)`; `R.tipSug=null`; `.sug` von den drei Knöpfen entfernen; bei `c.tip`: `#qtap` verborgen (die bestehende Zeile `$('qtap').hidden=false` bedingen), `#qtip` sichtbar, Feld leeren/aktivieren/fokussieren (`#qres` verbergen), sonst `#qtip`/`#qres` verbergen. `tipSubmit(giveUp)`: Ergebnis `tipCheck(input, c.it[1], vtSettings().strict)` (bei `giveUp` oder leerem Feld `'wrong'`), `R.tipSug={ok:2,near:1,wrong:0}[res]`, Feld sperren, `#qtip` verbergen, `#qres` mit Klasse und Text („Richtig“ / „Fast richtig“ / „Nicht gewusst“) zeigen, `reveal()` aufrufen, passenden Knopf (`again|hard|got`) mit `.sug` markieren. `reveal()` kehrt früh zurück, wenn `R.queue[0].tip && R.tipSug===null`. `#qtip` `onsubmit` (mit `preventDefault`) → `tipSubmit(false)`, `#qtipno` → `tipSubmit(true)`; Klicks im Formular `stopPropagation`. `grade()` bleibt unverändert.

- [ ] **Step 5: Tests laufen lassen** — `tipui`, `tipstate`, `tipcore`, `verbregress`, `verbstate`, `verbui`, `verbcore`, `sw`; alle `PASS`. Beim Vergleich `verbregress`: Vokabelabfrage ohne Tippkarten verhält sich wie vorher.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css app.js tests/tipui.html
git commit -m "Tippkarten: Eingabefeld, Prüfung und Bewertungsvorschlag in der Abfrage"
```

### Task 4: Auslieferung und Doku

**Files:**
- Modify: `sw.js` (`CACHE`), `app.js` (`APP_VERSION`), `README.md`, `ANLEITUNG.md`, `CLAUDE.md`

**Interfaces:** keine neuen.

- [ ] **Step 1: Versionen** — `CACHE='espanol-v31'`, `APP_VERSION='2026-11-16 · 29'`, Cache-Zahl in README und ANLEITUNG (per Grep nach `v30`) nachziehen; in ANLEITUNG die neue Einstellung „Tippen“ in zwei Sätzen beschreiben (wie bei „Beispielsätze“).

- [ ] **Step 2: `CLAUDE.md`** — Tabellenzeile für `tipcore.js`; Regelabsatz „Tippkarten“: `q.tip`, Auswahl über `c.tip` (einmal je Karte, von Wiederholungen geerbt), Eignung, Bewertung `ok→Saß · near→Knapp · wrong→Nochmal` als Vorschlag über `grade`, Karte/Planung/Protokoll unverändert; Testliste um `tipcore`, `tipstate`, `tipui` ergänzen.

- [ ] **Step 3: Alle Testseiten laufen lassen** — acht Seiten, alle `PASS`.

- [ ] **Step 4: Commit**

```bash
git add sw.js app.js README.md ANLEITUNG.md CLAUDE.md
git commit -m "Tippkarten: espanol-v31, Doku"
```
