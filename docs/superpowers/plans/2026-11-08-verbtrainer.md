# Verbtrainer (Konjugieren) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein fünfter Tab „Konjugieren" mit einem Trainer, in dem Verbformen getippt, automatisch geprüft und mit FSRS wie die Vokabeln geplant werden.

**Architecture:** Reine Logik (Formen aus `VERBS` lesen, Antwort prüfen, Bewertungsstufe) in `verbcore.js` ohne Abhängigkeit zu `app.js`, damit sie einzeln testbar ist. Planung, Lernstand und Oberfläche in `verbtrainer.js`, geladen nach `app.js`; sie nutzt dessen globale FSRS-Funktionen und liest `SRS` immer frisch. Karten liegen als `vb:<verb>:<form>` in `SRS.c`.

**Tech Stack:** Statische PWA, klassisches JavaScript ohne Build und ohne Abhängigkeiten. Tests als HTML-Seiten, die mit Headless-Chrome gegen `python -m http.server` laufen.

**Spec:** `docs/superpowers/specs/2026-11-08-verbtrainer-design.md`

## Global Constraints

- Kein Build-Schritt, keine Abhängigkeiten, deutsche Oberfläche, Stil und Kommentardichte wie in `app.js` (Abschnittsköpfe `/* ===== Name ===== */`).
- Neue Dateien in `FILES` in `sw.js`; `CACHE` hochzählen (`espanol-v21` → `espanol-v22`); `APP_VERSION` in `app.js` anpassen (aktuell `'2026-10-29 · 19'`); Cache-Zahl in `README.md` und `ANLEITUNG.md` nachziehen.
- Der Service Worker darf Fremd-Adressen nie cachen (nicht berührt).
- `content.js` und `examples.js` werden nicht verändert; `fsrs/` nie von Hand.
- Verbtrainer schreibt **nicht** in `q.log`, `SRS.ok`, `SRS.rn`, `SRS.rok`, `SRS.pace`, `day().*`.
- `verbtrainer.js` liest immer die globale Variable `SRS` (sie wird bei Sync, Wiederherstellung und Profilwechsel neu zugewiesen) und speichert keine Referenz darauf.
- Standardwerte: aktive Formen `["pres","ind","imp"]`, Runde 5 Karten, 2 neue Karten pro Tag, Akzente streng an.
- Es wird nicht committet oder gepusht, solange Philipp es nicht ausdrücklich verlangt. Statt Commit-Schritten endet jede Aufgabe mit einem Prüfschritt.
- Testlauf (gilt für alle Aufgaben): im Projektordner `python -m http.server 8765` im Hintergrund starten, dann
  `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --user-data-dir="$env:TEMP\vt-prof-<n>" --virtual-time-budget=10000 --dump-dom http://localhost:8765/tests/<seite>.html`
  (`<n>` bei jedem Lauf ein neuer Wert, damit `localStorage` leer ist). Die Testseiten schreiben ihr Ergebnis nach `document.body.dataset.result`; im ausgegebenen HTML muss `data-result="PASS …"` stehen.

## Review Focus

Eingaben und Zustände, die der Entwurf zulässt, die aber niemand ausdrücklich beschreibt. Jede Zeile hat einen Test in der genannten Aufgabe.

1. Alle Felder leer oder nur Leerzeichen → Bewertung *Nochmal*, kein Fehler im Skript (Aufgabe 1 und 3).
2. Imperativ mit „¡Tenga!", Großbuchstaben und doppelten Leerzeichen → richtig (Aufgabe 1).
3. Alle neun Formen ausgeschaltet → Startbildschirm zeigt einen Hinweis, kein Absturz, kein leere Runde (Aufgabe 3).
4. Tageslimit neuer Karten erreicht und nichts fällig → „Heute fertig", Start gesperrt; am nächsten Tag (`SRS.vnw.d` von gestern) gibt es wieder neue Karten (Aufgabe 2 und 3).
5. `SRS` wird mitten in einer Runde durch eine Kopie ersetzt (Sync) → die Bewertung landet im neuen Objekt, nicht im alten (Aufgabe 2).

---

### Task 1: Reine Logik (`verbcore.js`) und Testrahmen

**Files:**
- Create: `verbcore.js`, `tests/harness.js`, `tests/verbcore.html`

**Interfaces:**
- Produces (globale Funktionen und Konstanten in `verbcore.js`, lesen nur `VERBS` aus `content.js`):
  - `const VT_FORMS: {id:string,label:string}[]` in dieser Reihenfolge: `pres` Präsens, `ind` Indefinido, `imp` Imperfecto, `fut` Futur, `kond` Konditional, `subj` Subjuntivo, `impv` Imperativ, `ger` Gerundio, `part` Partizip.
  - `const VT_PRON: string[]` = `['yo','tú','él/ella/Ud.','nosotros','vosotros','ellos/ellas/Uds.']`.
  - `type VtItem = {label:string, answers:string[], irregular:boolean}`; `type VtCard = {key:string, verb:string, sub:string, group:string, form:string, items:VtItem[]}`.
  - `vtCards(verbs = VERBS): VtCard[]`, sortiert nach Index der Form in `VT_FORMS`, dann nach Reihenfolge in `verbs`.
  - `vtNorm(s: string, strict: boolean): string`.
  - `vtCheck(input: string, answers: string[], strict: boolean, impv?: boolean): 'ok'|'accent'|'wrong'`.
  - `vtGradeOf(errors: number, n: number): 1|2|3`.
- `tests/harness.js` stellt `t(name, cond)` und `done()` bereit; `done()` schreibt `PASS <ok>/<alle>` oder `FAIL: <Namen>` nach `document.body.dataset.result`.

- [ ] **Step 1: Testrahmen anlegen.** `tests/harness.js` (≈10 Zeilen: Zähler, Liste der Fehlernamen, `t`, `done`). `tests/verbcore.html` lädt `../content.js`, `../verbcore.js`, `harness.js` und einen Inline-Block mit den Tests aus Schritt 2, der mit `done()` endet.

- [ ] **Step 2: Failing tests schreiben** (in `tests/verbcore.html`), alle mit `t(...)`:
  - `vtCards().length === 410`.
  - Zahl der Karten je Form: `pres`,`ind`,`imp`,`fut`,`kond`,`subj`,`ger`,`part` je 46; `impv` 42.
  - Reihenfolge: `vtCards()[0].key === 'vb:ser:pres'`; erste Karte der Form `ind` ist `vb:ser:ind`; `vtCards()` ist nach Form-Index aufsteigend.
  - `vb:tener:ind`: 6 Items, `items[0]` = `{label:'yo', answers:['tuve'], irregular:true}`, `items[3].answers[0] === 'tuvimos'`.
  - `vb:hablar:pres`: `items[0].irregular === false`.
  - `vb:gustar:pres` hat 2 Items mit Labels `él/ella/Ud.` und `ellos/ellas/Uds.` und Antworten `gusta`, `gustan`; ebenso `costar`, `doler`; `vb:gustar:impv` existiert nicht.
  - `vb:haber:pres`: Item *él/ella/Ud.* hat Antworten `['ha','hay']`; `vb:haber:impv` existiert nicht.
  - `vb:tener:impv`: Items mit Labels `usted`, `ustedes`, `tú` und Antworten `tenga`, `tengan`, `ten` (ohne „¡" und „!").
  - `vb:tener:ger` → ein Item `teniendo`; `vb:tener:part` → `tenido`.
  - Keine Antwort enthält `<`, `&`, `¡`, `!` oder führende/endende Leerzeichen (über alle Karten).
  - `vtCheck('tuve',['tuve'],true) === 'ok'`; `vtCheck('  Tuve ',['tuve'],true) === 'ok'`; `vtCheck('tomo',['tomó'],true) === 'accent'`; `vtCheck('tomo',['tomó'],false) === 'ok'`; `vtCheck('toma',['tomó'],true) === 'wrong'`; `vtCheck('hay',['ha','hay'],true) === 'ok'`; `vtCheck('',['tuve'],true) === 'wrong'`; `vtCheck('   ',['tuve'],true) === 'wrong'`; `vtCheck('¡Tenga!',['tenga'],true,true) === 'ok'`; `vtCheck('  ¡ TENGA ! ',['tenga'],true,true) === 'ok'`; `vtCheck('niño',['nino'],false) === 'wrong'` (ñ bleibt eigener Buchstabe).
  - `vtGradeOf`: `(0,6)===3`, `(1,6)===2`, `(2,6)===2`, `(3,6)===1`, `(6,6)===1`, `(0,3)===3`, `(1,3)===2`, `(2,3)===1`, `(0,2)===3`, `(1,2)===1`, `(0,1)===3`, `(1,1)===1`.

- [ ] **Step 3: Run, erwartet FAIL** (`vtCards is not defined` bzw. `FAIL:`-Ergebnis) mit dem Testlauf aus den Global Constraints, Seite `verbcore`.

- [ ] **Step 4: Implementieren in `verbcore.js`.**
  - `vtCards`: pro Verb die Tabellen per Regex aus `h` lesen (Kopfzeile bestimmt die Formspalte: `Präsens|Indefinido|Imperfecto` bzw. `Futur|Konditional|Subjuntivo`); Zeile = `<td class="de">Pronomen</td>` + drei `<td>`. Zelltext: Tags entfernen, `trim`, an `' / '` in Alternativen teilen. `irregular` = Zelle enthält `<b>`. Pronomen-Zeilen nach Position auf `VT_PRON` abbilden (Spaltenbeschriftung der Tabelle `nos.`/`vos.`/`ellos` nicht verwenden). Für `gustar`, `costar`, `doler` (Konstante `VT_THIRD_ONLY`) nur Positionen 2 und 5.
  - `ger`/`part`: aus den Zeilen `Gerundium`/`Partizip` (je eine Zelle, ein Item mit Label `Gerundio` bzw. `Partizip`).
  - `impv`: Zeile `Imperativ`; Zelltext nach Tag-Entfernung an `' · '` teilen, je Teil `¡form! label`; Items in der Reihenfolge `usted`, `ustedes`, `tú`.
  - `vtNorm(s, strict)`: `trim`, Kleinschreibung, Mehrfach-Leerzeichen zu einem, `normalize('NFC')`; nicht strikt zusätzlich `á é í ó ú ü` → `a e i o u u` (über NFD, nur diese Zeichen; `ñ` bleibt).
  - `vtCheck`: bei `impv` zuerst führendes `¡` und endendes `!` samt umgebender Leerzeichen entfernen. Treffer, wenn `vtNorm(input,true)` zu einer Antwort passt → `'ok'`; sonst wenn `vtNorm(input,false)` passt → `strict ? 'accent' : 'ok'` (nicht strikt: zuerst Vergleich ohne Akzente, `'ok'` bei Treffer); sonst `'wrong'`. Leere Eingabe ist immer `'wrong'`.
  - `vtGradeOf`: `errors===0 → 3`; `errors<=Math.floor(n/3) → 2` (nur wenn `errors>=1`); sonst `1`.

- [ ] **Step 5: Run, erwartet `PASS 50/50` o. ä.** (Anzahl egal, aber ohne `FAIL`). Zahl der Tests in der Ausgabe mit der Zahl der `t(`-Aufrufe vergleichen.

- [ ] **Step 6: Zwischenstand prüfen.** `git status` zeigt `verbcore.js` und `tests/` als neu; nichts committen.

---

### Task 2: Lernstand und Planung (`verbtrainer.js`, ohne Oberfläche) und Eingriffe in `app.js`

**Files:**
- Create: `verbtrainer.js`, `tests/verbstate.html`
- Modify: `app.js` (`mergeInto` bei Zeile 1229, `begunN` bei Zeile 565, `BK_KEYS` bei Zeile 1399)
- Modify: `index.html` (Skripte bei Zeile 235–237 ergänzen: `verbcore.js`, `verbtrainer.js` nach `app.js`)

**Interfaces:**
- Consumes (aus Aufgabe 1): `vtCards`, `vtGradeOf`, `VT_FORMS`. Aus `app.js` (globale Bindings, klassische Skripte): `SRS`, `saveQ`, `store`, `loadJ`, `today`, `st`, `riskOf`, `fsrsNext`, `ivlOf`, `stageOfS`, `snapshot`, `SYNC`.
- Produces (`verbtrainer.js`):
  - `vtSettings(): {forms:string[], size:number, newPerDay:number, strict:boolean}`; liest bei jedem Aufruf `q.vbforms`, `q.vbsize`, `q.vbnew`, `q.vbacc` über `loadJ` (Standardwerte aus den Global Constraints). Gegenstück `vtSave(key: 'vbforms'|'vbsize'|'vbnew'|'vbacc', value): void` mit `store.set('q.'+key, JSON.stringify(value))`.
  - `vtPool(): VtCard[]`: alle Karten aktiver Formen (`vtCards()` einmal gecacht in einer Modulvariablen, gefiltert bei jedem Aufruf).
  - `vtNewLeft(): number` = `max(0, newPerDay − n)` mit `n` aus `SRS.vnw` (`{d,n}`), nur wenn `SRS.vnw.d === today()`, sonst 0 verbraucht.
  - `vtPlan(): {due:VtCard[], fresh:VtCard[], newLeft:number}`: `due` = Karten aus `vtPool()` mit `st(key).b>0 && st(key).due<=today()`, absteigend nach `riskOf({key})`; `fresh` = Karten mit `st(key).b===0`, in Pool-Reihenfolge.
  - `vtBuildRound(): VtCard[]` = erste `size` Elemente von `[...due, ...fresh.slice(0,newLeft)]`.
  - `vtGrade(card: VtCard, wrong: number[], redo: boolean): {G:1|2|3, days:number}`; `wrong` = Indizes falscher Items, `days` = Abstand bis zur nächsten Abfrage (0 bei G=1).
  - `vtPreview(card: VtCard, G: 1|2|3): number` = Tage bis zur nächsten Abfrage ohne zu speichern (für „Nächster Termin").

**Regeln für `vtGrade`** (spiegelt `grade()` in `app.js:1051`):
`G = vtGradeOf(wrong.length, card.items.length)`. Vor dem ersten Lernen des Tages `snapshot('Tagesbeginn')` nach demselben `SRS.snapDay`-Muster wie in `grade()`. `x = {...st(card.key)}`; `m = fsrsNext(x, G, t)`; `x.s=+m.s.toFixed(3); x.d=+m.d.toFixed(3); x.b=stageOfS(x.s); x.r=x.fr=t;`. Bei `G===1`: `x.due=t`, und nur bei `!redo` `x.l=(x.l||0)+1`; sonst `x.due=t+ivlOf(x.s,card.key,t)`. `x.u=Date.now()`; `SRS.c[card.key]=x; saveQ()`. Nur bei `!redo` zusätzlich: `SRS.hist[t]` +1, `SRS.best` nachführen (`streak()`), war `x.b` vorher 0 → `SRS.vnw` (`{d:t,n}`) hochzählen bzw. neu anlegen, `SYNC.pending=true` + `store.set('q.sync',JSON.stringify(SYNC))` wenn `SYNC&&SYNC.gist&&!SYNC.pending`.

**Eingriffe in `app.js`:**
- `mergeInto`: `SRS.vnw` übernehmen, wenn `rem.vnw` einen späteren Tag oder am selben Tag ein größeres `n` hat.
- `begunN`: Schlüssel mit Präfix `vb:` überspringen.
- `BK_KEYS`: `'q.vbforms','q.vbsize','q.vbnew','q.vbacc'` anhängen.
- Keine Profil-Ladezeile ändern: `verbtrainer.js` hält keinen Einstellungszustand, `vtSettings()` liest immer frisch.

- [ ] **Step 1: Testseite `tests/verbstate.html` anlegen.** Sie lädt `harness.js`, bettet `../index.html` in ein `<iframe id="app">` ein und führt nach `load` plus kurzer Wartezeit (200 ms) die Tests aus; Zugriff auf Bindings über `const w = frame.contentWindow; w.eval('…')`. Hilfsfunktion `ev(code)` = `w.eval(code)`. Vor jedem Test wird der Lernstand mit `ev('SRS.c={};SRS.hist={};delete SRS.vnw;delete SRS.snapDay;localStorage.clear()')` zurückgesetzt, wo nötig.

- [ ] **Step 2: Failing tests** (alle mit `t(...)`):
  - Defaults: `ev('vtSettings()')` ist `{forms:['pres','ind','imp'],size:5,newPerDay:2,strict:true}`.
  - Leerer Stand: `vtPlan().due.length===0`, `vtPlan().fresh.length===138`, `vtPlan().newLeft===2`, `vtBuildRound().map(c=>c.key)` ist `['vb:ser:pres','vb:estar:pres']`.
  - Erste Bewertung `vtGrade(card, [], false)` für `vb:ser:pres`: Ergebnis `G===3`; danach `SRS.c['vb:ser:pres'].b>0`, `.s>0`, `.due>today()`; `SRS.hist[today()]===1`; `SRS.vnw` ist `{d:today(),n:1}`; `SRS.day.n===0`; `localStorage` enthält keinen Schlüssel `q.log`; `loadJ('q.snaps',[]).length>=1`.
  - Alle sechs falsch (`wrong=[0,1,2,3,4,5]`) bei `vb:estar:pres`: `G===1`, `due===today()`, `l===1`; zweiter Aufruf mit `redo=true` und `wrong=[]`: `hist[today()]` bleibt unverändert, `vnw.n` bleibt unverändert, `l` bleibt `1`.
  - Limit: nach zwei neuen Karten ist `vtNewLeft()===0` und `vtBuildRound()` enthält keine neue Karte; setzt man `SRS.vnw.d=today()-1`, ist `vtNewLeft()===2`.
  - Fällig: Setzt man `SRS.c['vb:ser:pres'].due=today()`, steht die Karte in `vtPlan().due`; setzt man `vtSave('vbforms',['ind'])`, fehlt sie (obwohl fällig), und `vtSave('vbforms',['pres','ind','imp'])` bringt sie zurück.
  - Alle Formen aus: `vtSave('vbforms',[])` → `vtPlan().due.length===0`, `fresh.length===0`, `vtBuildRound().length===0`.
  - Review Focus 5: `ev('SRS=JSON.parse(JSON.stringify(SRS))')`, danach `vtGrade` auf einer weiteren Karte → der Eintrag steht in `ev('SRS.c')` (also im neuen Objekt).
  - `vtPreview(card,3) > 0`, `vtPreview(card,1) === 0`; `vtPreview` ändert `SRS.c` nicht (JSON vorher/nachher gleich).
  - `mergeInto`: `T={c:{},vnw:{d:5,n:1}}`, `mergeInto(T,{c:{},vnw:{d:5,n:2}})` → `T.vnw.n===2`; `mergeInto(T,{c:{},vnw:{d:4,n:9}})` ändert nichts; `{d:6,n:1}` ersetzt.
  - `begunN({'vb:a:b':{b:1},'x':{b:1}})===1`.
  - Karten mit `vb:`-Schlüssel erscheinen nicht in `allCards()` (`ev('allCards().some(c=>c.key.startsWith("vb:"))')` ist `false`).

- [ ] **Step 3: Run, erwartet FAIL** (`vtPlan is not defined`) mit dem Testlauf, Seite `verbstate`.

- [ ] **Step 4: Implementieren** nach den Interfaces und Regeln oben. Neue Skripte in `index.html` einbinden (`verbcore.js` vor `verbtrainer.js`, beide nach `app.js`). Kommentare im Stil von `app.js`.

- [ ] **Step 5: Run, erwartet `PASS`.** Zusätzlich im Lauf von `verbcore` prüfen, dass Aufgabe 1 weiter grün ist.

- [ ] **Step 6: Vokabeln unberührt prüfen.** `tests/verbstate.html` enthält einen Test, der vor und nach `vtGrade` die Werte `SRS.ok`, `SRS.rn`, `SRS.rok`, `SRS.pace`, `SRS.day` (JSON) vergleicht: gleich. Erwartet `PASS`.

---

### Task 3: Tab und Übungsbildschirm

**Files:**
- Modify: `index.html` (Tab-Knopf `data-tab="vt"` nach dem Knopf „Abfrage" bei Zeile 232; Container `<section id="vtrain" style="display:none"></section>` nach `#quiz`)
- Modify: `app.js` (Abschnitt „Tabs", Zeilen 135–153)
- Modify: `style.css`
- Modify: `verbtrainer.js` (Oberfläche ergänzen)
- Test: `tests/verbui.html`

**Interfaces:**
- Consumes: alles aus Aufgabe 1 und 2; `$` und `fmtIvl` aus `app.js`.
- Produces: `vtEnter(): void` (rendert den Startbildschirm; wird vom Tab-Handler gerufen), `vtRefresh(): void` (rendert neu, falls der Tab sichtbar ist; wird nach Sync-Übernahme gerufen).

**Bildschirme und stabile Selektoren** (die Tests greifen darauf zu):
- Start (`#vthome`): Zeile mit Fälligem und Neuem (`#vtcounts`), Knopf `#vtstart` (gesperrt, wenn `vtBuildRound().length===0`; dann Hinweis `#vthint` „Heute fertig" bzw. „Keine Form eingeschaltet"), neun Schalter `input[data-form]` mit Beschriftung aus `VT_FORMS`, Zahlenfelder `#vtsize`, `#vtnew`, Schalter `#vtacc` „Akzente müssen stimmen". Änderungen speichern sofort über `vtSave` und rendern die Zahlen neu.
- Übung (`#vtplay`): Kopf mit `.vtverb` (Verb), `.vtsub` (Bedeutung), `.vtform` (Formname), Fortschritt `.vtcount` („2 / 5"); je Item eine Zeile `.vtrow` mit Label und `<input>` (`autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"`); Sonderzeichenleiste `#vtkeys` mit Knöpfen `á é í ó ú ñ ü`, die per `mousedown`-`preventDefault` den Fokus behalten und das Zeichen in das fokussierte Feld einfügen; Knöpfe `#vtcheck` („Prüfen") und `#vtgiveup` („Weiß ich nicht"). Enter im Feld springt zum nächsten Feld, im letzten löst es `#vtcheck` aus.
- Ergebnis (im selben Bildschirm): Zeilen erhalten Klasse `ok` oder `bad`; bei `bad` steht `.vtsol` mit der richtigen Form (Alternativen mit „ / "), bei Antwort-`'accent'` zusätzlich `.vtacc` „nur der Akzent stimmt nicht"; Items mit `irregular` zeigen die Lösung fett. Darunter `.vtnext` mit „Nächster Termin: …" (`fmtIvl(vtPreview(card,G))`, bei G=1 „heute noch einmal") und Knopf `#vtnext` („Weiter").
- Rundenablauf: Warteschlange aus `vtBuildRound()`. Nach der Bewertung wird bei `G===1` und `redo<REDO_MAX` (5, Konstante aus `app.js`) die Karte mit `redo+1` ans Ende gelegt, und zwar mit nur den falschen Items (Index-Zuordnung zur Bewertung bleibt über die Originalkarte erhalten: `vtGrade` bekommt für Wiederholungen die Indizes bezogen auf die gefragte Teilmenge, die Karte ist dafür ein Objekt mit gefilterten `items`). Am Ende zeigt ein Abschlussbildschirm Zahl der Karten, richtige beim ersten Versuch und einen Knopf „Zurück".
- Tab-Handler in `app.js`: `ref.style.display` und `quizEl.style.display` für `tab==='vt'` ausblenden, `#vtrain` für `tab==='vt'` einblenden, `.searchrow` ausblenden; `if(tab==='vt') vtEnter();`. Nach Sync-Übernahme (an den zwei Stellen in `syncNow`, wo `renderPick()` gerufen wird) zusätzlich `if(typeof vtRefresh==='function') vtRefresh();`.

- [ ] **Step 1: Testseite `tests/verbui.html`** wie `verbstate.html` (iframe mit der App). Hilfsfunktionen: `$q(sel)` für `w.document.querySelector`, `type(i, text)` setzt `input.value` und löst `input`-Event aus, `click(sel)`.

- [ ] **Step 2: Failing tests:**
  - Nach `click('nav button[data-tab="vt"]')`: `#vtrain` sichtbar, `#quiz` und `#ref` nicht, `.searchrow` nicht; `#vtcounts` nennt „2" neue Karten; `#vtstart` ist nicht gesperrt.
  - Es gibt neun `input[data-form]`; genau `pres`, `ind`, `imp` sind angehakt. Abhaken aller neun → `#vtstart` gesperrt, `#vthint` enthält „Keine Form"; `localStorage` Schlüssel `q.vbforms` ist `[]` (Review Focus 3).
  - Start mit Standardformen: `.vtverb` zeigt `ser`, `.vtform` zeigt `Präsens`, sechs `.vtrow input`.
  - Alle Felder leer, `#vtcheck`: Zeilen alle `.bad`, kein Skriptfehler (Fehler über `w.onerror` mitgezählt), Termin-Text „heute noch einmal" (Review Focus 1); `#vtnext` führt zu einer Wiederholung derselben Karte mit nur sechs Zeilen für `ser`… (alle waren falsch).
  - Richtige Antworten für `ser` Präsens (`soy eres es somos sois son`), `#vtcheck`: alle `.ok`; `SRS.c['vb:ser:pres'].due > today()`; Text enthält „Nächster Termin".
  - Akzent: bei `vb:estar:pres` bewusst `esta` statt `está` in der 2. Zeile bei striktem Schalter → Zeile `.bad` mit `.vtacc`; mit ausgeschaltetem `#vtacc` → Zeile `.ok`.
  - Sonderzeichenleiste: Fokus im ersten Feld, Klick auf Knopf `ó` fügt `ó` ein (Wert des Feldes endet auf `ó`).
  - Tageslimit: nach der Runde mit den zwei neuen Karten ist der Startbildschirm „Heute fertig" und `#vtstart` gesperrt (Review Focus 4).
  - Vokabelabfrage unverändert: Tab „Abfrage" öffnet sich und `#pick` ist sichtbar; `SRS.day.n===0`.

- [ ] **Step 3: Run, erwartet FAIL** (`#vtrain` fehlt) mit Testlauf, Seite `verbui`.

- [ ] **Step 4: Implementieren** die Elemente, den Tab-Handler und die Stile. Stil: bestehende CSS-Variablen (`--teal`, `--card`, `--rule`, `--soft`) und Klassen wiederverwenden; Eingabefelder mindestens 16 px Schrift (kein iOS-Zoom); Zeilen auf 375 px Breite einspaltig. Die Beschriftung „Konjugieren" muss bei 11 px in einem Fünftel der Breite einer 375-px-Leiste passen.

- [ ] **Step 5: Run, erwartet `PASS`.** Danach Sichtprüfung: Screenshot-Lauf `chrome --headless=new --window-size=390,844 --screenshot=<pfad>` für Startbildschirm, Übung und Ergebnis; Bilder ansehen (Lesbarkeit, Tab-Leiste, Sonderzeichenleiste, nichts läuft über den Rand).

- [ ] **Step 6: Tests aus Aufgabe 1 und 2 erneut laufen lassen**, alle `PASS`.

---

### Task 4: Auslieferung, Doku und Gesamtprüfung

**Files:**
- Modify: `sw.js`, `app.js` (`APP_VERSION`), `README.md`, `ANLEITUNG.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: Ergebnis der Aufgaben 1–3.
- Produces: auslieferbarer Stand.

- [ ] **Step 1: `sw.js`.** `verbcore.js` und `verbtrainer.js` in `FILES` eintragen (Zeile 2); `CACHE` auf `'espanol-v22'`.

- [ ] **Step 2: `APP_VERSION`** in `app.js:1360` auf `'2026-11-08 · 20'`; Cache-Zahl in `README.md` und `ANLEITUNG.md` auf 22 ändern (per Grep nach `espanol-v21` bzw. `v21` die Stellen finden).

- [ ] **Step 3: Doku.** `ANLEITUNG.md`: kurzer Abschnitt „Konjugieren" (was der Tab macht, Formen ein-/ausschalten, Akzente, Bewertungsregel, Tageslimit). `CLAUDE.md`: Dateitabelle um `verbcore.js` und `verbtrainer.js` ergänzen und ein Absatz zu Verbkarten: Schlüssel `vb:<verb>:<form>`, Bewertungsregel, `SRS.vnw`, Einstellungsschlüssel `q.vbforms/vbsize/vbnew/vbacc`, nicht in `q.log` und `SRS.ok/rn/rok`, Tests unter `tests/`.

- [ ] **Step 4: Gesamtlauf der drei Testseiten** (`verbcore`, `verbstate`, `verbui`), alle `PASS`.

- [ ] **Step 5: Regression der Vokabelabfrage im Browser** nach `CLAUDE.md` (`python -m http.server`, Seite im Browser): Runde in der Vokabelabfrage durchspielen; Neuladen; zweites Profil anlegen und wechseln (Verbkarten des ersten Profils erscheinen dort nicht); Abgleich mit Mock-Gist (`fetch` auf `api.github.com` überschreiben): Verbkarten und `SRS.vnw` kommen auf dem zweiten „Gerät" an. Ergebnis jeweils festhalten.

- [ ] **Step 6: Übergabe.** Philipp mitteilen, was nur auf dem iPhone geprüft werden kann: Offline-Start mit den neuen Dateien (neuer Cache `espanol-v22`), Tastatur ohne Autokorrektur, Sonderzeichenleiste, Beschriftung „Konjugieren" in der Tab-Leiste. Nichts committen oder pushen.

---

## Selbstprüfung gegen den Entwurf

- Abdeckung: Datenleser und Sonderfälle (Aufgabe 1) · Karten, Bewertung, Planung, Tageslimit, Statistik, Snapshot, Sync-Felder (Aufgabe 2) · Bildschirm, Prüfung, Einstellungen, Tab (Aufgabe 3) · Dateien, Doku, Prüfung (Aufgabe 4).
- Abweichung vom Entwurf: Die reine Logik liegt in einer eigenen Datei `verbcore.js`, damit sie ohne `app.js` testbar ist. Außerdem entfällt die „Profil-Ladezeile", weil `vtSettings()` die Einstellungen bei jedem Aufruf frisch liest.
