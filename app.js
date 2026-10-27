/* ===================== Speicher mit Rückfallebene ===================== */
const mem={};
const raw={
  get(k){try{return localStorage.getItem(k)}catch(e){return mem[k]??null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}},
  del(k){try{localStorage.removeItem(k)}catch(e){delete mem[k]}},
  keys(){try{return Object.keys(localStorage)}catch(e){return Object.keys(mem)}}
};
/* Lernende: Jedes Profil hat eigenen Lernstand. Profil 1 nutzt die bisherigen Schlüssel
   (keine Migration nötig), weitere Profile einen Präfix. Globale Schlüssel beginnen nicht mit „q.". */
let PROFILES=null; try{PROFILES=JSON.parse(raw.get('app.profiles')||'null')}catch(e){}
if(!Array.isArray(PROFILES)||!PROFILES.length) PROFILES=[{id:'p1',name:'Ich'}];
let CUR=raw.get('app.current')||PROFILES[0].id;
if(!PROFILES.some(x=>x.id===CUR)) CUR=PROFILES[0].id;
const pfx=id=>id==='p1'?'':'P:'+id+':';
const nsk=k=>/^q\./.test(k)?pfx(CUR)+k:k;
const store={ get:k=>raw.get(nsk(k)), set:(k,v)=>raw.set(nsk(k),v) };

/* ===================== Thema ===================== */
const html=document.documentElement;
const saved=store.get('theme');
if(saved) html.dataset.theme=saved;
document.getElementById('theme').onclick=()=>{
  const cur=html.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  const next=cur==='dark'?'light':'dark';
  html.dataset.theme=next; store.set('theme',next);
  document.querySelector('meta[name=theme-color]').content=next==='dark'?'#0F1C16':'#F1F3EE';
};

/* ===================== Aufbau ===================== */
const ref=document.getElementById('ref');
let counter=0;
function build(list,cls,numbered){
  let group=null;
  list.forEach(s=>{
    if(s.g!==group){
      group=s.g;
      const h=document.createElement('div');
      h.className='parthead'; h.textContent=group; h.dataset.head=cls;
      ref.appendChild(h);
    }
    const d=document.createElement('details');
    d.className=cls;
    const badge = numbered
      ? '<span class="num">'+String(++counter).padStart(2,'0')+'</span>'+s.t
      : '<span class="num inf">'+s.t+'</span><span class="vsub">'+s.sub+'</span>';
    d.innerHTML='<summary>'+badge+'</summary><div class="body">'+s.h+'</div>';
    ref.appendChild(d);
  });
}
build(GRAM,'gram',true);
build(VOC,'voc',true);
build(VERBS,'verb',false);

/* ===================== Aussprache ===================== */
const TTS=('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
let esVoice=null, esVoices=[], utt=null, ttsUnlocked=false, ttsLast=null, ttsCancelAt=0, ttsTimer=null;
function pickVoice(){
  if(!TTS) return;
  esVoices=speechSynthesis.getVoices().filter(x=>/^es/i.test(x.lang));
  const pref=['es-CR','es-MX','es-419','es-US','es-CO','es-ES'];
  esVoice=pref.map(l=>esVoices.find(x=>x.lang.replace('_','-')===l)).find(Boolean)||esVoices[0]||null;
}
if(TTS){
  pickVoice();
  if(speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged',pickVoice);
  else speechSynthesis.onvoiceschanged=pickVoice;
  setTimeout(pickVoice,1000); setTimeout(pickVoice,3000);     // iOS meldet Stimmen oft verspätet und ohne Ereignis
  document.body.classList.add('tts');
}
/* iOS gibt die Sprachausgabe erst nach einer Berührung frei: einmal lautlos „sprechen" */
function unlockTTS(){
  if(!TTS||ttsUnlocked) return; ttsUnlocked=true;
  try{ const u=new SpeechSynthesisUtterance(' '); u.volume=0; u.lang='es-MX'; speechSynthesis.speak(u); }catch(e){}
}
document.addEventListener('touchend',unlockTTS,{passive:true});
document.addEventListener('click',unlockTTS);
function speak(text,el){
  if(!TTS||!text) return;
  if(!esVoice) pickVoice();
  const t=text.replace(/\s*[\/·]\s*/g,', ').replace(/\s+/g,' ').trim();   // „a / b" → „a, b": kurze Sprechpause
  const go=()=>{
    const u=new SpeechSynthesisUtterance(t);
    utt=u;                                                   // Referenz halten: Safari verwirft sonst mitten im Satz
    u.lang=esVoice?esVoice.lang:'es-MX'; if(esVoice) u.voice=esVoice;
    u.rate=.9; u.volume=1; u.pitch=1;
    let started=false;
    const done=()=>{ if(el) el.classList.remove('speaking'); if(utt===u) utt=null; };
    u.onstart=()=>{ started=true; ttsLast={ok:true,msg:esVoice?esVoice.name+' ('+esVoice.lang+')':'Standardstimme (es-MX)'}; };
    u.onend=done;
    u.onerror=e=>{ ttsLast={ok:false,msg:'Fehler: '+(e&&e.error||'unbekannt')}; done(); };
    if(el) el.classList.add('speaking');
    speechSynthesis.speak(u);
    setTimeout(()=>{ if(!started && utt===u){ ttsLast={ok:false,msg:'iOS hat die Wiedergabe nicht gestartet'}; done(); } },3000);
  };
  if(speechSynthesis.paused) speechSynthesis.resume();
  // Safari verschluckt speak() kurz nach cancel(): nur abbrechen, wenn nötig, und mindestens 80 ms Abstand halten.
  // Ein noch wartender Aufruf wird ersetzt — der zuletzt angetippte Text gewinnt.
  clearTimeout(ttsTimer);
  if(speechSynthesis.speaking||speechSynthesis.pending){ speechSynthesis.cancel(); ttsCancelAt=Date.now(); }
  const gap=80-(Date.now()-ttsCancelAt);
  if(gap>0) ttsTimer=setTimeout(go,gap); else go();
}
function ttsInfo(){
  const el=$('ttsStat'); if(!el) return;
  if(!TTS){ el.textContent='vom Browser nicht unterstützt'; el.className='warn'; return; }
  pickVoice();
  if(ttsLast){ el.textContent=(ttsLast.ok?'läuft · ':'')+ttsLast.msg; el.className=ttsLast.ok?'ok':'warn'; return; }
  el.textContent=esVoices.length ? esVoices.length+' span. Stimme'+(esVoices.length>1?'n':'')+' · '+esVoice.name : 'Stimmenliste noch leer';
  el.className=esVoices.length?'':'warn';
}
// Antippen im Nachschlageteil
ref.querySelectorAll('.vt td.mono, table td.mono').forEach(td=>{
  const t=td.textContent.trim(); if(t.length>1 && !/^-/.test(t) && !/[+=→]/.test(t)) td.classList.add('say');
});
ref.addEventListener('click',e=>{
  if(!TTS) return;
  const el=e.target.closest('.es, .words b, td.mono.say');
  if(!el || e.target.closest('summary')) return;
  speak(el.textContent,el);
});

/* ===================== Sprungmarken ===================== */
const jumpEl=document.getElementById('jump');
function renderJump(){
  const heads=[...document.querySelectorAll('.parthead')].filter(h=>h.dataset.head===tab);
  jumpEl.innerHTML='';
  heads.forEach(h=>{const b=document.createElement('button');b.textContent=h.textContent;
    b.onclick=()=>{const top=h.getBoundingClientRect().top+scrollY-document.querySelector('header').offsetHeight-6;scrollTo({top,behavior:'smooth'})};
    jumpEl.appendChild(b)});
  jumpEl.hidden = tab==='quiz' || !!qEl.value.trim() || heads.length<2;
  document.getElementById('ttshint').hidden = !TTS || tab==='quiz' || tab==='gram';
}

/* ===================== Tabs ===================== */
let tab='gram';
const quizEl=document.getElementById('quiz');
document.querySelectorAll('nav button').forEach(b=>{
  b.onclick=()=>{
    tab=b.dataset.tab;
    document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-selected',x===b));
    ref.style.display = tab==='quiz'?'none':'block';
    quizEl.style.display = tab==='quiz'?'block':'none';
    document.querySelector('.searchrow').style.display = tab==='quiz'?'none':'block';
    document.getElementById('q').placeholder = tab==='verb'
      ? 'Verb suchen — z. B. volver oder schlafen'
      : 'Suchen — deutsch oder spanisch';
    if(tab==='quiz') quizEnter();
    applyFilter(); renderJump();
    scrollTo({top:0});
  };
});

/* ===================== Suche ===================== */
const qEl=document.getElementById('q'), clearBtn=document.getElementById('clear');
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
let empty=null;

let lastTerm='';
function applyFilter(){
  if(tab==='quiz') return;
  const term=norm(qEl.value.trim());
  const cleared = lastTerm && !term; lastTerm=term;
  clearBtn.style.display=qEl.value?'block':'none';
  let hits=0;
  document.querySelectorAll('#ref details').forEach(d=>{
    const inTab = d.classList.contains(tab);
    if(!inTab){d.style.display='none';return}
    if(!term){d.style.display=''; if(cleared) d.open=false; hits++; return}   // Tabwechsel lässt Geöffnetes offen
    const match=norm(d.textContent).includes(term);
    d.style.display=match?'':'none';
    if(match){d.open=true;hits++}
  });
  document.querySelectorAll('.parthead').forEach(h=>{
    h.style.display=(h.dataset.head===tab && !term)?'':'none';
  });
  if(!empty){empty=document.createElement('div');empty.className='empty';ref.appendChild(empty)}
  empty.style.display=hits?'none':'block';
  empty.textContent='Nichts gefunden. Versuch ein kürzeres Stichwort.';
}
qEl.addEventListener('input',()=>{applyFilter();if(typeof renderJump==='function')renderJump()});
clearBtn.onclick=()=>{qEl.value='';applyFilter();renderJump();qEl.focus()};
applyFilter(); renderJump();

/* ===================== Abfrage ===================== */
/*  Planung nach FSRS-6 (Free Spaced Repetition Scheduler, wie in Anki).
    Jede Karte hat Stabilität s (Tage, bis die Abrufwahrscheinlichkeit auf 90 % fällt) und Schwierigkeit d (1–10).
    Der nächste Termin ergibt sich aus der Zielretention. Die Stufe b (0–8) wird nur noch aus s abgeleitet
    und steuert Anzeige und Abfragerichtung:
    Stufe 0 = neu · 1–2 Lernphase · 3–4 gefestigt · 5–8 sicher
    Stufe 0–1: Spanisch → Deutsch (wiedererkennen), ab Stufe 2: Deutsch → Spanisch (selbst abrufen)        */
const $=id=>document.getElementById(id);
const loadJ=(k,d)=>{try{const v=JSON.parse(store.get(k)||'null');return v??d}catch(e){return d}};
const INT=[0,1,3,7,14,30,60,120,240];  // Stufengrenzen in Tagen Stabilität (früher feste Intervalle)
const MAX=8, REDO_MAX=5, LEECH=4;     // Fehler: bis zu 5× ans Rundenende, bis die Karte einmal sitzt
const today=()=>{const n=Date.now();return Math.floor((n-new Date(n).getTimezoneOffset()*6e4)/864e5)};
const stageOf=b=>b===0?0:b<=2?1:b<=4?2:3;
const STAGE=['Neu','Lernphase','Gefestigt','Sicher'];

/* ---- FSRS-6, Standardparameter (py-fsrs 6.3) — eigene Parameter, falls vorhanden, in SRS.w ---- */
const W_DEF=[0.212,1.2931,2.3065,8.2956,6.4133,0.8334,3.0194,0.001,1.8722,0.1666,0.796,1.4835,0.0614,0.2629,1.6483,0.6014,1.8729,0.5425,0.0912,0.0658,0.1542];
const MAX_IVL=1095;
let RET=loadJ('q.ret',0.9);                                   // Zielretention: so sicher soll eine Karte beim Termin noch sitzen
const fw=()=>(SRS&&Array.isArray(SRS.w)&&SRS.w.length===21)?SRS.w:W_DEF;
const clampD=d=>Math.min(10,Math.max(1,d));
const D0=(w,G)=>w[4]-Math.exp(w[5]*(G-1))+1;                  // Anfangsschwierigkeit je Bewertung
function retr(t,s,w=fw()){ const dec=-w[20], f=Math.pow(.9,1/dec)-1; return Math.pow(1+f*Math.max(0,t)/s,dec); }
function nextD(w,d,G){ const d2=d+(10-d)*(-w[6]*(G-3))/9; return clampD(w[7]*D0(w,4)+(1-w[7])*d2); }
const stageOfS=s=>{ let b=1; for(let i=2;i<=MAX;i++) if(s>=INT[i]) b=i; return b; };
/* Gedächtniszustand einer begonnenen Karte. Ältere Daten (Leitner) oder Karten, die eine ältere App-Version
   zuletzt geplant hat (fr ≠ r), werden aus Stufe und Fehlerzahl geschätzt:
   Stabilität = Leitner-Intervall der Stufe; Schwierigkeit so, dass die nächste pünktliche richtige Abfrage
   den bisherigen Leitner-Schritt nachbildet (≈ ×2) — die Karte hat bisher nur dieses Tempo bewiesen.
   (Anki übernimmt SM-2-Karten nach demselben Prinzip.) Jeder frühere Fehler macht sie schwerer. */
function memOf(x){
  if(x.s!==undefined && x.fr===x.r) return {s:x.s,d:x.d};
  const w=fw(), b=Math.max(1,Math.min(MAX,x.b||1)), s=Math.max(.5,INT[b]);
  const grow=b<MAX?INT[b+1]/INT[b]:2, k=Math.exp(w[8])*Math.pow(s,-w[9])*(Math.exp(.1*w[10])-1);
  let d=clampD(11-(grow-1)/k);
  for(let i=0;i<(x.l||0);i++) d=nextD(w,d,1);
  return {s,d};
}
/* Neuer Gedächtniszustand nach Bewertung G (1 Nochmal · 2 Knapp · 3 Saß) am Tag t */
function fsrsNext(x,G,t){
  return x.b>0 ? fsrsStep(fw(),memOf(x),G,t-lastRev(x)) : fsrsStep(fw(),null,G,0);
}
/* Ein FSRS-Schritt mit beliebigen Parametern w — Planung und Gütetest der eigenen Parameter rechnen identisch.
   m = bisheriger Zustand {s,d} oder null (neue Karte), el = Tage seit der letzten Abfrage. */
function fsrsStep(w,m,G,el){
  if(!m) return {s:Math.max(.001,w[G-1]),d:clampD(D0(w,G))};
  let s;
  if(el<1){                                                    // am selben Tag erneut: Kurzzeitformel
    let inc=Math.exp(w[17]*(G-3+w[18]))*Math.pow(m.s,-w[19]); if(G>1) inc=Math.max(inc,1); s=m.s*inc;
  } else {
    const r=retr(el,m.s,w);
    s = G===1 ? Math.min(w[11]*Math.pow(m.d,-w[12])*(Math.pow(m.s+1,w[13])-1)*Math.exp((1-r)*w[14]), m.s/Math.exp(w[17]*w[18]))
              : m.s*(1+Math.exp(w[8])*(11-m.d)*Math.pow(m.s,-w[9])*(Math.exp((1-r)*w[10])-1)*(G===2?w[15]:1));
  }
  return {s:Math.max(.001,s),d:nextD(w,m.d,G)};
}
/* Intervall aus Stabilität und Zielretention, mit kleiner Streuung (wie Anki), damit gemeinsam gelernte
   Karten nicht alle am selben Tag fällig werden. Streuung pro Karte und Tag fest → Vorschau = Ergebnis. */
function ivlOf(s,key,t){
  const w=fw(), dec=-w[20], f=Math.pow(.9,1/dec)-1;
  let n=Math.min(MAX_IVL,Math.max(1,Math.round(s/f*(Math.pow(RET,1/dec)-1))));
  if(n<3) return n;
  const delta=1+.15*Math.max(Math.min(n,7)-2.5,0)+.1*Math.max(Math.min(n,20)-7,0)+.05*Math.max(n-20,0);
  const hi=Math.min(Math.round(n+delta),MAX_IVL), lo=Math.min(Math.max(2,Math.round(n-delta)),hi);
  return lo+Math.floor(hashStr(key+'|'+t+'|f')/4294967296*(hi-lo+1));
}

let roundSize=loadJ('q.size',10), newPerDay=loadJ('q.newcap',10);
let SRS=loadJ('q.srs',null);
if(!SRS){                                // Übernahme des alten Fortschritts
  const t=today(); SRS={c:{},day:{d:t,n:0,ok:0,nw:0}};
  loadJ('q.done',[]).forEach((k,i)=>SRS.c[k]={b:3,due:t+(i%4),l:0});
  loadJ('q.weak',[]).forEach(k=>SRS.c[k]={b:1,due:t,l:1});
}
if(!SRS.hist) SRS.hist={};
if(!SRS.ok) SRS.ok={};                   // richtige Antworten je Tag (erster Versuch, inkl. neuer Karten), gleiche Tage wie hist
if(!SRS.rn) SRS.rn={};                   // Wiederholungen je Tag (ohne neue Karten, ohne freies Üben)
if(!SRS.rok) SRS.rok={};                 // davon beim ersten Versuch gewusst → Trefferquote für die Zielretention
const saveQ=()=>store.set('q.srs',JSON.stringify(SRS));
/* ---- Abfrageprotokoll: jede Bewertung, Grundlage für eigene FSRS-Parameter.
   Bleibt auf dem Gerät (und in der Sicherungsdatei), nicht im Cloud-Abgleich — es wächst mit der Zeit.
   Eintrag: [Tag, Karten-Nr. in k, Bewertung 1–3, Tage seit letzter Abfrage (−1 = neu),
             Art 0 Plan · 1 Wiederholung in der Runde · 2 freies Üben · 3 Zusatzrunde, Richtung 1 = ins Spanische, ms] */
let LOG=null, LOGIX=null;
function logLoad(){
  if(!LOG){ LOG=loadJ('q.log',null); if(!LOG||!Array.isArray(LOG.k)||!Array.isArray(LOG.e)) LOG={k:[],e:[]};
    LOGIX=new Map(LOG.k.map((k,i)=>[k,i])); }
  return LOG;
}
function logSave(){
  const L=logLoad();
  for(let i=0;i<8;i++){
    try{ localStorage.setItem(nsk('q.log'),JSON.stringify(L)); return; }
    catch(e){ if(L.e.length<200) return; L.e.splice(0,Math.ceil(L.e.length*.1)); }   // Speicher voll: älteste 10 % opfern
  }
}
function logReview(key,t,G,el,mode,toEs,ms){
  const L=logLoad(); let ki=LOGIX.get(key);
  if(ki===undefined){ ki=L.k.length; L.k.push(key); LOGIX.set(key,ki); }
  L.e.push([t,ki,G,el,mode,toEs?1:0,Math.min(600000,Math.max(0,Math.round(ms)))]);
  logSave();
}
let deckKind=loadJ('q.kind','s'), autoSpeak=loadJ('q.auto',false), dirMode=loadJ('q.dir','auto');
const DIR_HINT={
  auto:'Neue Karten: erst Spanisch → Deutsch, ab der ersten Wiederholung ins Spanische. Ab Stufe 4 gelegentlich zurück.',
  es:'Immer Deutsch → Spanisch: selbst formulieren. Am anspruchsvollsten.',
  de:'Immer Spanisch → Deutsch: verstehen. Gut zum Einstieg in ein neues Kapitel.',
  mix:'Jede Karte zufällig in eine der beiden Richtungen.'};
function hashStr(t){ let h=2166136261; for(let i=0;i<t.length;i++){ h^=t.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function chooseDir(c,x){                   // true = Deutsch → Spanisch
  const r=hashStr(c.key+'|'+today());      // pro Karte und Tag fest, damit Wiederholungen stabil bleiben
  if(dirMode==='es') return true;
  if(dirMode==='de') return false;
  if(dirMode==='mix') return r%2===0;
  if(x.b===0) return false;                // neu: erst verstehen
  // ab der ersten Wiederholung selbst bilden: Die Planung soll auf der schwereren Richtung beruhen,
  // sonst trägt eine leicht verdiente Stabilität (wiedererkennen) lange Abstände fürs Bilden
  if(x.b<=3) return true;
  return r%4!==0;                          // ab Stufe 4: meist bilden, gelegentlich zurück
}
let level=loadJ('q.level','basis');
function streak(){
  let t=today(), n=0;
  if(!SRS.hist[t]) t--;                       // heute noch nicht geübt → Serie zählt bis gestern
  while(SRS.hist[t]){ n++; t--; }
  return n;
}
const day=()=>{ if(SRS.day.d!==today()) SRS.day={d:today(),n:0,ok:0,nw:0,rn:0,rok:0}; return SRS.day; };
const st=k=>SRS.c[k]||{b:0,due:0,l:0};
const isNew=c=>st(c.key).b===0;
const isDue=c=>{const x=st(c.key);return x.b>0&&x.due<=today()};
const isWeak=c=>{const x=st(c.key);return x.b>0&&((x.l>0&&x.b<=2)||x.l>=LEECH)};
const newLeft=()=>Math.max(0,newPerDay-day().nw);
/* ---- Tagesplan: Zeitbudget statt „alles Fällige" ----
   Budget = Minuten × 60 / gemessenes Tempo. Neue Karten nur, wenn die Wiederholungen in den Plan passen
   und die nächsten Tage nicht schon voll sind. Rückstand wird auf die Folgetage verteilt. */
let minutes=loadJ('q.minutes',10);
const PACE_DEF=10, NEW_LOAD=6;           // ~6 Abfragen zieht eine neue Karte im ersten Monat nach sich
const pace=()=>Math.min(30,Math.max(4,SRS.pace||PACE_DEF));
const budgetCards=()=>Math.max(10,Math.round(minutes*60/pace()));
const sustainNew=()=>Math.max(1,Math.round(budgetCards()/NEW_LOAD));
const lastRev=x=>x.r!==undefined?x.r:x.due-INT[Math.max(0,x.b)];  // Tag der letzten Abfrage (ältere Daten: geschätzt)
const riskOf=c=>{ const x=st(c.key); if(!(x.b>0)) return 0; return 1-retr(today()-lastRev(x),memOf(x).s); };   // geschätzte Vergessenswahrscheinlichkeit
function load7(){ const t=today(); let n=0; allCards().forEach(c=>{const x=st(c.key); if(x.b>0&&x.due>t&&x.due<=t+7) n++;}); return n; }
function plan(cards){
  const d=day(), B=budgetCards(), left=Math.max(0,B-d.n);
  const due=cards.filter(isDue).sort((a,b)=>riskOf(b)-riskOf(a));
  const fresh=cards.filter(isNew);
  const backlog=due.length>left, heavy=load7()/7>B*.8;
  const cap=Math.max(0,Math.min(newPerDay,sustainNew())-d.nw);
  const reviews=Math.min(due.length,left);
  const newOk=(backlog||heavy)?0:Math.max(0,Math.min(fresh.length,cap,left-reviews));
  return {B,left,due,fresh,reviews,newOk,backlog,heavy,cap};
}
/* Rückstand verteilen: einmal täglich, profilweit. Was heute nicht ins Budget passt, rückt auf die Folgetage —
   das Riskanteste bleibt heute. */
function spreadBacklog(){
  const t=today(); if(SRS.spreadDay===t) return 0;
  SRS.spreadDay=t;
  const B=budgetCards(), left=Math.max(0,B-day().n);
  const due=allCards().filter(isDue).sort((a,b)=>riskOf(b)-riskOf(a));
  const excess=due.slice(left); if(!excess.length){ saveQ(); return 0; }
  const perDay=Math.max(5,Math.round(B*.4)), now=Date.now();
  excess.forEach((c,i)=>{ const x={...st(c.key)}; x.due=t+1+Math.floor(i/perDay); x.u=now; SRS.c[c.key]=x; });
  saveQ(); if(typeof scheduleSync==='function') scheduleSync();
  return excess.length;
}

/* Neuberechnung aus dem Abfrageprotokoll: spielt für jede seit Protokollbeginn abgefragte Karte alle Bewertungen
   mit den aktuellen Regeln (und Parametern) erneut durch. Ausgangszustand: neu, oder — bei Karten aus der
   Leitner-Zeit — geschätzt aus dem Abstand zur vorherigen Abfrage. Karten, deren letzter Stand nicht von
   diesem Gerät stammt, bleiben unberührt. Gibt die Zahl geänderter Karten zurück. */
function rescheduleFromLog(){
  const L=logLoad(); if(!L.e.length) return 0;
  const by=new Map(); L.e.forEach(e=>{ const k=L.k[e[1]]; if(!by.has(k)) by.set(k,[]); by.get(k).push(e); });
  let n=0; const now=Date.now();
  by.forEach((E,key)=>{
    const cur=SRS.c[key], last=E[E.length-1];
    if(!cur || !(cur.b>0) || cur.r!==last[0] || cur.fr!==cur.r) return;
    const first=E[0], lapsesIn=E.filter(e=>e[2]===1&&e[4]!==1).length;
    let x;
    if(first[3]<0) x={b:0,due:0,l:0};
    else { let b=1; for(let i=2;i<=MAX;i++) if(INT[i]<=first[3]) b=i;
      x={b,due:first[0],l:Math.max(0,(cur.l||0)-lapsesIn),r:first[0]-first[3]}; }
    let due=cur.due, touched=false;
    E.forEach(([t,,G,,mode])=>{
      if(mode===2 && G>1) return;                          // freies Üben: Erfolg plant nichts
      const m=fsrsNext(x,G,t);
      x={...x,s:+m.s.toFixed(3),d:+m.d.toFixed(3),b:stageOfS(m.s),r:t,fr:t};
      if(G===1 && mode!==1) x.l=(x.l||0)+1;
      due = G===1 ? t : t+ivlOf(x.s,key,t); touched=true;
    });
    if(!touched) return;
    if(x.s!==cur.s || x.d!==cur.d || due!==cur.due){
      SRS.c[key]={...cur,s:x.s,d:x.d,b:x.b,due,r:x.r,fr:x.r,u:now}; n++; }
  });
  if(n){ SRS.spreadDay=null; saveQ(); }                     // was jetzt fällig wird, verteilt der Tagesplan
  return n;
}

/* ---- Eigene Parameter: FSRS-Optimierer im Hintergrund ----
   fsrs-browser (fsrs-rs als WebAssembly, derselbe Optimierer wie in Anki) rechnet aus dem Abfrageprotokoll
   eigene Parameter — in einem Worker, erst bei Bedarf geladen. Das WASM ist auf nicht-geteilten Speicher
   umgestellt (fsrs/LIESMICH.md), damit es ohne Cross-Origin-Isolation läuft (GitHub Pages setzt die Header nicht).
   Ablauf: Gütetest — Training nur mit den früheren Tagen, Vergleich mit den aktuellen Parametern an den letzten
   ~20 % der Wiederholungen. Nur wenn die neuen dort nicht schlechter vorhersagen: Training mit allem, übernehmen,
   alle Karten aus dem Protokoll neu planen.
   Auslöser: ab OPT_MIN Bewertungen, dann bei jeder Verdopplung oder nach OPT_DAYS Tagen (+200 Bewertungen).
   SRS.w Parameter · SRS.wu Zeitpunkt der Änderung (entscheidet beim Abgleich) · SRS.wauto false = Automatik aus ·
   SRS.wi Angaben zur letzten Übernahme (Anzeige). Auslöserstand je Gerät in q.opt {day,n,err,ok}. */
const OPT_MIN=1000, OPT_DAYS=30;
let optBusy=false;
const validW=w=>Array.isArray(w)&&w.length===21&&w.every(Number.isFinite);
function optSeqs(){                       // vollständige Kartenverläufe (erste Abfrage im Protokoll = neue Karte)
  const L=logLoad(), by=new Map();
  L.e.forEach(e=>{ if(e[4]===2 && e[2]>1) return;            // freies Üben: Erfolg zählt nicht (wie in der Planung)
    let a=by.get(e[1]); if(!a){ a=[]; by.set(e[1],a); } a.push(e); });
  const seqs=[];
  by.forEach((E,ci)=>{ if(E[0][3]>=0) return;                 // vor dem Protokoll begonnen: Vorgeschichte fehlt
    seqs.push({ci,days:E.map(e=>e[0]),g:E.map(e=>e[2])}); });
  return seqs;
}
function optItems(seqs,maxDay){           // Eingabe für computeParameters: jeder Verlauf bis zu einer Wiederholung über eine Tagesgrenze
  const r=[],t=[],l=[],c=[];
  seqs.forEach(q=>{ const dt=q.days.map((d,i)=>i?d-q.days[i-1]:0);
    for(let i=1;i<q.g.length;i++){ if(dt[i]<1 || q.days[i]>=maxDay) continue;
      for(let j=0;j<=i;j++){ r.push(q.g[j]); t.push(dt[j]); } l.push(i+1); c.push(q.ci); } });
  return {r,t,l,c};
}
function optLoss(w,seqs,fromDay){         // mittlerer Log-Loss der Vorhersagen über Tagesgrenzen ab fromDay (kleiner = besser)
  let sum=0,n=0;
  seqs.forEach(q=>{ let m=null;
    for(let i=0;i<q.g.length;i++){ const el=i?q.days[i]-q.days[i-1]:0, G=q.g[i];
      if(i && el>=1 && q.days[i]>=fromDay){ const p=Math.min(1-1e-4,Math.max(1e-4,retr(el,m.s,w))); sum-=Math.log(G>1?p:1-p); n++; }
      m=fsrsStep(w,m,G,el); } });
  return {ll:n?sum/n:NaN,n};
}
async function optFitHere(D){             // Rückfallebene ohne Worker
  const m=await import('./fsrs/fsrs_browser.js'); await m.default();
  return Array.from(new m.Fsrs().computeParameters(Uint32Array.from(D.r),Uint32Array.from(D.t),Uint32Array.from(D.l),
    null,true,BigInt64Array.from(D.c,BigInt)));
}
function optFit(D){
  return new Promise((res,rej)=>{
    let wk; try{ wk=new Worker('opt-worker.js',{type:'module'}); }catch(e){ optFitHere(D).then(res,rej); return; }
    let done=false; const end=()=>{ done=true; clearTimeout(to); wk.terminate(); };
    const to=setTimeout(()=>{ if(!done){ end(); rej(new Error('Zeitüberschreitung')); } },120000);
    wk.onmessage=e=>{ if(done) return; end(); e.data&&e.data.err?rej(new Error(e.data.err)):res(e.data.w); };
    wk.onerror=e=>{ if(done) return; end(); if(e&&e.preventDefault) e.preventDefault(); optFitHere(D).then(res,rej); };
    wk.postMessage(D);
  });
}
function optDue(){
  const N=logLoad().e.length, t=today(), o=loadJ('q.opt',{});
  if(SRS.wauto===false || N<OPT_MIN) return false;
  if(o.err && o.day===t) return false;                                     // Fehler: frühestens morgen erneut
  if(!o.n) return true;
  return N>=2*o.n || (t-o.day>=OPT_DAYS && N>=o.n+200);
}
/* Rechnet und übernimmt, wenn besser. Ergebnis: {ok, ll0, ll1, test, n, items, moved} oder Fehler */
async function optimize(src){
  if(optBusy) return null;
  optBusy=true; optRender();
  const t=today(), N=logLoad().e.length;
  try{
    const seqs=optSeqs(), cur=fw().slice();
    const ds=[]; seqs.forEach(q=>q.days.forEach((d,i)=>{ if(i && d-q.days[i-1]>=1) ds.push(d); })); ds.sort((a,b)=>a-b);
    if(ds.length<100) throw new Error('erst '+ds.length+' auswertbare Wiederholungen, nötig sind 100');
    const cut=ds[Math.floor(ds.length*.8)], nTest=ds.filter(d=>d>=cut).length;
    let ll0=null, ll1=null, test=0, ok=true;
    if(nTest>=40 && ds.length-nTest>=100){
      const wT=await optFit(optItems(seqs,cut));
      if(!validW(wT)) throw new Error('Optimierer lieferte ungültige Werte');
      const a=optLoss(cur,seqs,cut), b=optLoss(wT,seqs,cut);
      ll0=a.ll; ll1=b.ll; test=a.n; ok=b.ll<=a.ll+.002;
    }
    let w=null;
    if(ok){
      w=await optFit(optItems(seqs,Infinity));
      if(!validW(w)) throw new Error('Optimierer lieferte ungültige Werte');
      w=w.map(x=>+x.toFixed(4));
      if(ll0===null){ const a=optLoss(cur,seqs,-Infinity), b=optLoss(w,seqs,-Infinity); ll0=a.ll; ll1=b.ll; ok=b.ll<a.ll; }
    }
    const info={day:t,n:N,items:ds.length,test,ll0:+ll0.toFixed(4),ll1:+ll1.toFixed(4),src};
    store.set('q.opt',JSON.stringify({day:t,n:N,ok,ll0:info.ll0,ll1:info.ll1,test,ts:Date.now()}));
    if(ok){
      snapshot('vor Anpassung der Abstände');
      SRS.w=w; SRS.wu=Date.now(); SRS.wi=info; saveQ();
      info.moved=rescheduleFromLog(); saveQ(); scheduleSync();
    }
    return {...info,ok};
  }catch(e){
    store.set('q.opt',JSON.stringify({...loadJ('q.opt',{}),day:t,err:String(e&&e.message||e),ts:Date.now()}));
    throw e;
  }finally{ optBusy=false; optRender(); if(!$('pick').hidden) renderPick(); }
}
function optAuto(){ if(optDue()) optimize('auto').catch(()=>{}); }

/* --- Vokabelstapel aus den Wortschatzblöcken --- */
function wordsFrom(html,withPhr){
  const box=document.createElement('div'); box.innerHTML=html;
  const pairs=[];
  if(withPhr) box.querySelectorAll('ul.phr li').forEach(li=>{      // Aufbau: Beispielsätze mit abfragen
    const es=li.querySelector('.es'), de=li.querySelector('.gloss');
    if(es&&de) pairs.push([de.textContent.trim(),es.textContent.trim()]);
  });
  box.querySelectorAll('p.words').forEach(p=>{
    p.innerHTML.split(' · ').forEach(seg=>{
      const t=document.createElement('div'); t.innerHTML=seg;
      t.querySelectorAll('b').forEach(b=>{ if(/:\s*$/.test(b.textContent)) b.remove(); });
      const sp=t.querySelector('span'); if(!sp) return;
      const de=sp.textContent.trim(); sp.remove();
      t.querySelectorAll('br').forEach(x=>x.remove());
      const es=t.textContent.replace(/\s+/g,' ').trim();
      if(es && de && !/^\d+$/.test(es)) pairs.push([de,es]);
    });
  });
  box.querySelectorAll('table tr').forEach(tr=>{
    const td=[...tr.children];
    for(let i=0;i+1<td.length;i++){
      if(td[i].classList.contains('mono') && td[i+1].classList.contains('de')){
        const es=td[i].textContent.trim(), de=td[i+1].textContent.trim();
        if(es && de) pairs.push([de,es]); i++;
      }
    }
  });
  const seen=new Set();
  return pairs.filter(p=>!seen.has(p[1])&&seen.add(p[1]));
}
const nk=x=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,]/g,'').trim();
const SENT_KEYS=new Set(SENT_DECKS.flatMap(d=>d.items.map(it=>nk(it[1]))));
/* Lernstufen. Eine neue Stufe = neue Kapitel im Wortschatz, deren Gruppe mit dem Präfix beginnt,
   plus ein Eintrag hier. Reihenfolge = Reihenfolge, in der die Tagesrunde „Alle" Neues bringt. */
const LEVELS=[
  {id:'basis',  name:'Grundlagen', sub:'A1–A2 · Reise',     test:g=>!/^Aufbau/.test(g)},
  {id:'aufbau', name:'Aufbau',     sub:'A2–B1 · Kapitel', test:g=>/^Aufbau/.test(g)},
];
const levelOf=g=>(LEVELS.find(L=>L.test(g))||LEVELS[0]).id;
const levelRank=id=>LEVELS.findIndex(L=>L.id===id)+1;
if(!['alle',...LEVELS.map(l=>l.id)].includes(level)) level='basis';   // unbekannte gespeicherte Stufe
const WORD_DECKS=VOC.map((b,i)=>{const lv=levelOf(b.g), adv=lv!=='basis'; return {id:'w'+i,name:b.t,kind:'w',lv,lvl:levelRank(lv),
  items:wordsFrom(b.h,adv)
    .filter(([de,es])=>!SENT_KEYS.has(nk(es)))            // steht schon als Satzkarte
    .map(([de,es])=>[de.split(' — ')[0],es])}})            // Erklärung nach „—" gehört nicht in die Frage
  .filter(d=>d.items.length>=4);
SENT_DECKS.forEach(d=>{d.kind='s'; d.lv='basis'; d.lvl=1;});
const ALL=[...SENT_DECKS,...WORD_DECKS];
const cardsRaw=d=>d.items.map(it=>({it,key:d.kind+':'+it[1],deck:d.name,lvl:d.lvl||1,lv:d.lv||'basis'}));
/* „Brauche ich nicht": Karte mit x=1 im Lernstand. Sie fällt aus allen Kartenlisten heraus — keine Abfrage,
   keine Fälligkeit, zählt nirgends mit. Ihr Lernstand bleibt erhalten; Zurückholen in den Einstellungen. */
const isSkipped=key=>!!(SRS.c[key]&&SRS.c[key].x);
const cardsOf=d=>cardsRaw(d).filter(c=>!isSkipped(c.key));
// Gleiche Karte in mehreren Stapeln (z. B. „la cuenta") nur einmal zählen und abfragen
const allCards=()=>{const seen=new Set();return ALL.flatMap(cardsOf).filter(c=>!seen.has(c.key)&&seen.add(c.key))};
const skippedCards=()=>{const seen=new Set();return ALL.flatMap(cardsRaw).filter(c=>isSkipped(c.key)&&!seen.has(c.key)&&seen.add(c.key))};
const begunN=c=>Object.values(c||{}).filter(x=>x&&x.b>0&&!x.x).length;   // begonnene Karten ohne ausgeblendete

/* --- Rundenzusammenstellung --- */
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function buildRound(cards,mode){
  const P=plan(cards);
  if(mode==='extra')                                     // freiwillig über das Budget hinaus: riskanteste Wiederholungen
    return P.due.slice(0,roundSize);
  const fresh=shuffle(P.fresh.slice()).sort((a,b)=>a.lvl-b.lvl);   // Grundlagen vor Aufbau
  if(mode==='more') return fresh.slice(0,roundSize);
  // Tagesplan: Wiederholungen zuerst; Neues nur, wenn der Plan es zulässt — dann ein Drittel der Runde eingestreut
  let nNew=Math.min(P.newOk, P.reviews?Math.ceil(roundSize*.3):roundSize);
  const nDue=Math.min(P.reviews,roundSize-nNew);
  nNew=Math.min(P.newOk,roundSize-nDue);
  const A=P.due.slice(0,nDue), N=fresh.slice(0,nNew), out=[];
  while(A.length||N.length){ if(A.length)out.push(A.shift()); if(A.length)out.push(A.shift()); if(N.length)out.push(N.shift()); }
  return out;
}
function cramRound(cards){
  return cards.filter(c=>st(c.key).b>0)
    .sort((x,y)=>st(x.key).b-st(y.key).b||st(x.key).due-st(y.key).due).slice(0,roundSize);
}

/* --- Themenwahl --- */
function stageBar(cards){
  const n=[0,0,0,0]; cards.forEach(c=>n[stageOf(st(c.key).b)]++);
  const t=cards.length||1;
  return '<div class="sbar">'+n.map((v,i)=>v?'<i class="s'+i+'" style="width:'+(v/t*100)+'%"></i>':'').join('')+'</div>';
}
function deckRow(name,getCards,opts={}){
  const cards=getCards(), due=cards.filter(isDue).length, fresh=cards.filter(isNew).length;
  const learned=cards.length-fresh;
  const b=document.createElement('button');
  b.className='deck'+(opts.hi?' hi':'');
  if(!cards.length) b.disabled=true;
  const badge = due ? '<span class="duebadge">'+due+' fällig</span>' : '<span class="duebadge none">'+(fresh?'':'✓')+'</span>';
  b.innerHTML='<div class="drow"><span class="dname">'+name+'</span>'+badge+'</div>'+
    '<div class="dmeta">'+(opts.meta || (fresh+' neu · '+learned+' gelernt'))+'</div>'+stageBar(cards);
  b.onclick=()=>startRound(name,getCards,'normal');
  return b;
}
const scopeCards=()=>allCards().filter(c=>level==='alle'||c.lv===level);
const levelName=()=>level==='alle'?'Alle Stufen':LEVELS.find(l=>l.id===level).name;
function deckGroups(){                       // Stapelgruppen je gewählter Stufe
  const W=lv=>WORD_DECKS.filter(d=>d.lv===lv);
  if(level==='basis') return [{k:'s',name:'Sätze',decks:SENT_DECKS},{k:'w',name:'Wörter',decks:W('basis')}];
  if(level!=='alle')  return [{k:level,name:'Kapitel',decks:W(level)}];
  return [{k:'s',name:'Sätze',decks:SENT_DECKS},...LEVELS.map(L=>({k:L.id==='basis'?'w':L.id,name:L.name,decks:W(L.id)}))];
}
/* --- Lernende --- */
const curProfile=()=>PROFILES.find(x=>x.id===CUR);
const initial=n=>(n||'?').trim().charAt(0).toUpperCase();
const saveProfiles=()=>raw.set('app.profiles',JSON.stringify(PROFILES));
function streakOf(hist){ let t=today(), n=0; if(!hist[t]) t--; while(hist[t]){ n++; t--; } return n; }
function summaryOf(srs,name,src){
  const h=(srs&&srs.hist)||{};
  return {name,src,streak:streakOf(h),today:h[today()]||0,begun:begunN(srs&&srs.c)};
}
const lastDay=h=>Math.max(-1,...Object.keys(h||{}).map(Number));
const isDefaultName=n=>/^ich$/i.test((n||'').trim());
function peerEntries(){                                // alle anderen Lernenden mit Herkunft, für Anzeige und Diagnose
  const mine=(SYNC&&SYNC.gist)?myFile():null, out=[];
  PROFILES.filter(x=>x.id!==CUR).forEach(x=>{ let srs=null; try{srs=JSON.parse(raw.get(pfx(x.id)+'q.srs')||'null')}catch(e){}
    const f=fileOfProfile(x.id); if(f&&f===mine) return;
    out.push({name:x.name,file:f,src:'lokal',hist:(srs&&srs.hist)||{},begun:begunN(srs&&srs.c)}); });
  let remote=[]; try{remote=JSON.parse(raw.get('app.peers')||'[]')}catch(e){}
  remote.forEach(r=>{ if(!r.hist||!r.file||r.file===mine) return;
    out.push({name:r.name,file:r.file,src:'cloud',hist:r.hist,begun:r.begun||0}); });
  // pro Name nur der aktuellste Stand
  const me=curProfile().name.toLowerCase(), best=new Map();
  out.forEach(e=>{ const k=e.name.toLowerCase(); const o=best.get(k);
    if(!o || lastDay(e.hist)>lastDay(o.hist) || (lastDay(e.hist)===lastDay(o.hist)&&e.begun>o.begun)) best.set(k,e); });
  out.forEach(e=>{ const k=e.name.toLowerCase();
    e.same = k===me;
    // gleichnamig mit mir: nur zeigen, solange die Serie läuft (aktive Person) — verwaiste Kopien ausblenden
    e.shown = best.get(k)===e && (!e.same || streakOf(e.hist)>0);
    e.why = best.get(k)!==e ? 'ältere Kopie' : e.same ? (e.shown?'gleicher Name wie du':'gleicher Name, inaktiv') : 'angezeigt'; });
  return out;
}
function peerList(){
  return peerEntries().filter(e=>e.shown).map(e=>Object.assign(summaryOf({hist:e.hist,c:{}},e.name,''),{begun:e.begun}));
}
function renderWho(){
  const me=curProfile();
  $('whoAva').textContent=initial(me.name); $('whoName').textContent=me.name;
  $('whoSub').textContent=PROFILES.length>1?'Profil wechseln':'Profil hinzufügen';
  const flame=$('kFlame').innerHTML.replace(/kf(\d)/g,'pk$1');
  $('peers').innerHTML='';
  peerList().forEach(x=>{ const el=document.createElement('div'); el.className='peer';
    el.innerHTML='<span class="ava"></span><span class="pt"><span class="nm"></span><small>'+(x.today?'heute '+x.today+' Karten':'heute noch nichts')+'</small></span><span class="pf'+(x.today?' on':'')+'">'+flame+'</span><b>'+x.streak+'</b>';
    el.querySelector('.ava').textContent=initial(x.name); el.querySelector('.nm').textContent=x.name;
    el.title=x.name+': '+x.streak+' Tage in Folge, heute '+x.today+' Karten, '+x.begun+' begonnen';
    $('peers').appendChild(el); });
  const L=$('whoList'); L.innerHTML='';
  PROFILES.forEach(x=>{ let n=0; try{n=Object.keys(JSON.parse(raw.get(pfx(x.id)+'q.srs')||'{"c":{}}').c).length}catch(e){}
    const b=document.createElement('button'); b.className='prow'+(x.id===CUR?' cur':'');
    b.innerHTML='<span class="ava"></span><span></span><small>'+(x.id===CUR?'aktiv':n+' Karten')+'</small>';
    b.children[0].textContent=initial(x.name); b.children[1].textContent=x.name;
    b.onclick=()=>{ if(x.id!==CUR) switchProfile(x.id); }; L.appendChild(b); });
  $('whoDel').disabled=PROFILES.length<2;
}
function switchProfile(id){
  raw.set('app.current',id);
  if(TTS) speechSynthesis.cancel();
  location.reload();                                   // sauberer Neustart mit dem Lernstand des Profils
}
$('whoBtn').onclick=()=>{ $('whoPanel').hidden=!$('whoPanel').hidden; renderWho(); };
$('whoAdd').onclick=()=>{
  const name=(prompt('Name des neuen Profils:')||'').trim(); if(!name) return;
  if(PROFILES.some(x=>x.name.toLowerCase()===name.toLowerCase())){ alert('Dieses Profil gibt es schon.'); return; }
  const id='p'+Date.now().toString(36);
  PROFILES.push({id,name}); saveProfiles();
  if(SYNC&&SYNC.token) raw.set(pfx(id)+'q.sync',JSON.stringify({token:SYNC.token}));   // Cloud-Zugang vormerken
  raw.set(pfx(id)+'q.level',JSON.stringify(level));
  switchProfile(id);
};
$('whoRen').onclick=()=>{
  const me=curProfile(), name=(prompt('Neuer Name:',me.name)||'').trim(); if(!name||name===me.name) return;
  if(PROFILES.some(x=>x.id!==CUR&&x.name.toLowerCase()===name.toLowerCase())){ alert('Dieser Name ist vergeben.'); return; }
  me.name=name; saveProfiles(); renderWho(); scheduleSync();
};
$('whoDel').onclick=()=>{
  if(PROFILES.length<2) return;
  const me=curProfile();
  if(!confirm('Profil „'+me.name+'" mit seinem Lernstand auf diesem Gerät löschen? Eine Cloud-Kopie bleibt auf GitHub erhalten.')) return;
  raw.keys().filter(k=> me.id==='p1' ? /^q\./.test(k) : k.startsWith(pfx(me.id))).forEach(raw.del);
  PROFILES=PROFILES.filter(x=>x.id!==me.id); saveProfiles();
  switchProfile(PROFILES[0].id);
};

/* --- Lernstatistik --- */
const wdMon=d=>(d+3)%7;                                  // Tag 0 (1.1.1970) war ein Donnerstag; Montag = 0
const fmt1=x=>x.toFixed(1).replace('.',',');
function longestRun(h){ let best=0,run=0,prev=null; Object.keys(h).map(Number).filter(d=>h[d]).sort((a,b)=>a-b)
  .forEach(d=>{ run=(prev!==null&&d===prev+1)?run+1:1; prev=d; if(run>best) best=run; }); return best; }
function gaussSvg(vals,todayN){                           // Histogramm der Tageswerte + angepasste Normalverteilung
  const N=vals.length, mu=vals.reduce((a,b)=>a+b,0)/N, sd=Math.sqrt(vals.reduce((a,b)=>a+(b-mu)*(b-mu),0)/N);
  const mx=Math.max(...vals,todayN||0), w=[5,10,20,25,50,100].find(x=>Math.ceil((mx+1)/x)<=10)||100, nb=Math.ceil((mx+1)/w);
  const bins=Array(nb).fill(0); vals.forEach(v=>bins[Math.min(nb-1,Math.floor(v/w))]++);
  const pdf=x=>Math.exp(-((x-mu)**2)/(2*sd*sd))/(sd*Math.sqrt(2*Math.PI));
  const curve=sd>=.5, peak=curve?N*w*pdf(mu):0, ymax=Math.max(...bins,peak,1)*1.12;
  const X0=8,X1=312,Y0=96,Y1=8, sx=x=>X0+(X1-X0)*x/(nb*w), sy=y=>Y0-(Y0-Y1)*y/ymax;
  let g='';
  if(curve) g+='<rect class="gs" x="'+sx(Math.max(0,mu-sd))+'" y="'+Y1+'" width="'+(sx(Math.min(nb*w,mu+sd))-sx(Math.max(0,mu-sd)))+'" height="'+(Y0-Y1)+'"/>';
  bins.forEach((c,i)=>{ if(c) g+='<rect class="gb" x="'+(sx(i*w)+1)+'" y="'+sy(c)+'" width="'+(sx(w)-sx(0)-2)+'" height="'+(Y0-sy(c))+'" rx="2"/>'; });
  if(curve){ const pts=[]; for(let x=0;x<=nb*w;x+=w/12) pts.push(sx(x).toFixed(1)+','+sy(N*w*pdf(x)).toFixed(1));
    g+='<polyline class="gc" points="'+pts.join(' ')+'"/><line class="gm" x1="'+sx(mu)+'" x2="'+sx(mu)+'" y1="'+Y1+'" y2="'+Y0+'"/>'; }
  if(todayN) g+='<line class="gt" x1="'+sx(todayN)+'" x2="'+sx(todayN)+'" y1="'+Y1+'" y2="'+Y0+'"/><text x="'+Math.min(X1-26,sx(todayN)+3)+'" y="'+(Y1+8)+'">heute</text>';
  g+='<line x1="'+X0+'" x2="'+X1+'" y1="'+Y0+'" y2="'+Y0+'" stroke="var(--rule)"/>';
  for(let i=0;i<=nb;i+=Math.ceil(nb/5)) g+='<text x="'+sx(i*w)+'" y="'+(Y0+12)+'" text-anchor="middle">'+i*w+'</text>';
  return {svg:'<svg viewBox="0 0 320 112" role="img" aria-label="Verteilung der Karten pro Lerntag">'+g+'</svg>',mu,sd,N};
}
function renderStats(){
  const H=SRS.hist, OK=SRS.ok||{}, t=today(), B=$('statsBody'), days=Object.keys(H).map(Number).filter(d=>H[d]>0);
  if(!days.length){ B.innerHTML='<p class="st-note">Noch keine Daten. Nach der ersten Runde füllt sich die Statistik.</p>'; return; }
  const tot=days.reduce((a,d)=>a+H[d],0), bestDay=Math.max(...days.map(d=>H[d]));
  const best=Math.max(SRS.best||0,streak(),longestRun(H));
  const kp=(v,l,c)=>'<div><b'+(c?' style="color:var(--'+c+')"':'')+'>'+v+'</b><span>'+l+'</span></div>';
  let h='<div class="st-k">'+kp(streak(),'Serie aktuell','gold')+kp(best,'Längste Serie','gold')+kp(days.length,'Lerntage')
    +kp(tot,'Karten')+kp(Math.round(tot/days.length),'Ø pro Lerntag')+kp(bestDay,'Bester Tag')+'</div>'
    +'<p class="st-note">Karten und Lerntage zählen die letzten 365 Tage.</p>';
  // Lernkalender: 16 Wochen, Spalten = Wochen (Montag oben)
  const start=t-wdMon(t)-15*7, vmax=Math.max(1,...days.map(d=>H[d]));
  let cells=''; for(let i=0;i<16*7;i++){ const d=start+i, v=H[d]||0;
    cells+='<i class="'+(d>t?'f':v?'l'+Math.min(4,1+Math.floor(v/vmax*3.999)):'')+'" title="'+v+' Karten"></i>'; }
  h+='<h4>Lernkalender<small>16 Wochen · dunkler = mehr Karten</small></h4><div class="st-heat">'+cells+'</div>';
  // Wissensstand je Stufe
  h+='<h4>Wissensstand</h4>';
  const uniq=f=>{const seen=new Set();return allCards().filter(c=>f(c)&&!seen.has(c.key)&&seen.add(c.key))};
  LEVELS.forEach(L=>{ const cs=uniq(c=>c.lv===L.id), n=[0,0,0,0]; cs.forEach(c=>n[stageOf(st(c.key).b)]++);
    h+='<div class="st-lv"><div><span><b>'+L.name+'</b> · '+(cs.length-n[0])+' / '+cs.length+' begonnen</span><span>'
      +'Sicher '+n[3]+' · Gefestigt '+n[2]+' · Lernphase '+n[1]+'</span></div>'+stageBar(cs)+'</div>'; });
  // Trefferquote je Woche: nur Wiederholungen (ohne neue Karten, ohne freies Üben) — Vergleich mit der Zielretention
  const RN=SRS.rn||{}, ROK=SRS.rok||{};
  const W=[]; for(let k=7;k>=0;k--){ const mon=t-wdMon(t)-k*7; let n=0,ok=0;
    for(let d=mon;d<mon+7;d++){ if(RN[d]){ n+=RN[d]; ok+=Math.min(ROK[d]||0,RN[d]); } }
    W.push({mon,n,r:n>=5?ok/n:null}); }
  h+='<h4>Trefferquote<small>Wiederholungen beim ersten Versuch, pro Woche · Ziel '+Math.round(RET*100)+' %</small></h4>';
  if(W.some(x=>x.r!==null)) h+='<div class="st-bars">'+W.map((x,i)=>{ const dt=new Date(x.mon*864e5), lab=dt.getUTCDate()+'.'+(dt.getUTCMonth()+1)+'.';
    return '<div title="'+(x.r===null?'zu wenige Daten':Math.round(x.r*100)+' % von '+x.n+' Karten')+'"><em>'+(x.r===null?'–':Math.round(x.r*100))+'</em>'
      +'<i class="'+(x.r===null?'none':i===7?'now':'')+'" style="height:'+(x.r===null?3:Math.max(4,x.r*62))+'px"></i><span>'+lab+'</span></div>'; }).join('')+'</div>';
  else h+='<p class="st-note">Gezählt werden nur Wiederholungen (keine neuen Karten). Die Quote erscheint, sobald eine Woche genug davon hat.</p>';
  { const rec=W.filter(x=>x.r!==null).slice(-4), n=rec.reduce((a,x)=>a+x.n,0), r=n?rec.reduce((a,x)=>a+x.r*x.n,0)/n:null;
    if(r!==null && n>=40) h+='<p class="st-note">Letzte Wochen: <b>'+Math.round(r*100)+' %</b> bei Ziel '+Math.round(RET*100)+' % — '
      +(r>RET+.05?'deutlich darüber: Die Abstände könnten länger sein (eigene Parameter würden das korrigieren).'
       :r<RET-.08?'deutlich darunter: Die Abstände sind für dich eher zu lang (eigene Parameter würden das korrigieren).'
       :'passt zum Ziel.')+'</p>'; }
  { const L=logLoad(); if(L.e.length) h+='<p class="st-note">Abfrageprotokoll: <b>'+L.e.length+'</b> Bewertungen seit '
      +new Date(L.e[0][0]*864e5).toLocaleDateString('de-DE',{timeZone:'UTC'})+'. '+(validW(SRS.w)?'Die Abstände sind an dich angepasst (Einstellungen).':L.e.length<OPT_MIN?'Ab '+OPT_MIN+' rechnet die App eigene Abstände für dich aus.':'Eigene Abstände: siehe Einstellungen.')+'</p>'; }
  // Vorschau 14 Tage
  const A=allCards(), due0=A.filter(isDue).length, F=[]; for(let i=1;i<=14;i++) F.push(A.filter(c=>{const x=st(c.key);return x.b>0&&x.due===t+i}).length);
  const fm=Math.max(1,due0,...F);
  h+='<h4>Fällig in den nächsten 14 Tagen</h4><div class="st-bars">'+[due0,...F].map((v,i)=>
    '<div title="'+v+' Karten"><em>'+v+'</em><i class="'+(i===0?'now':v?'':'none')+'" style="height:'+(v?Math.max(4,v/fm*62):3)+'px"></i><span>'+(i===0?'heute':'+'+i)+'</span></div>').join('')+'</div>';
  // Normalverteilung der Karten pro Lerntag
  const past=days.filter(d=>d<t).map(d=>H[d]);
  h+='<h4>Typischer Lerntag<small>Karten pro Tag, Normalverteilung</small></h4>';
  if(past.length<6) h+='<p class="st-note">Ab 6 abgeschlossenen Lerntagen zeigt sich hier die Verteilung — bisher '+past.length+'.</p>';
  else { const todayN=H[t]||0, G=gaussSvg(past,todayN), lo=Math.max(0,Math.round(G.mu-G.sd)), hi=Math.round(G.mu+G.sd);
    const inside=past.filter(v=>Math.abs(v-G.mu)<=G.sd).length;
    let z=''; if(G.sd>=.5 && todayN){ const zz=(todayN-G.mu)/G.sd;
      z='Heute <b>'+todayN+'</b> Karten: <b>'+(zz>=0?'+':'−')+fmt1(Math.abs(zz))+' σ</b> — '+(zz>.5?'über deinem Schnitt. ':zz<-.5?'unter deinem Schnitt. ':'im Bereich deines Schnitts. '); }
    else if(!todayN) z='Heute noch nicht gelernt. ';
    h+='<div class="st-g">'+G.svg+'</div><p class="st-note">'+z+'Ø <b>'+Math.round(G.mu)+'</b> Karten, σ <b>'+fmt1(G.sd)+'</b>. '
      +'Bei einer Normalverteilung liegen gut zwei Drittel der Tage zwischen <b>'+lo+'</b> und <b>'+hi+'</b> (gelb hinterlegt) — bei dir waren es '+Math.round(inside/past.length*100)+' %. '
      +'Die gelbe Kurve gehört zu Ø und σ; lernst du sehr unterschiedlich viel, weicht sie von den Balken ab.</p>'; }
  B.innerHTML=h;
}
document.getElementById('stats').addEventListener('toggle',e=>{ if(e.target.open) renderStats(); });

function setLevel(id){ level=id; store.set('q.level',JSON.stringify(id)); renderPick(); scrollTo({top:0}); }
function renderPick(){
  const all=scopeCards(), due=all.filter(isDue).length, fresh=all.filter(isNew).length;
  const nNew=Math.min(fresh,newLeft()), sk=streak(), t=today();
  // Stufenkacheln
  const uniq=f=>{const seen=new Set();return allCards().filter(c=>f(c)&&!seen.has(c.key)&&seen.add(c.key))};
  const tiles=[...LEVELS.map(L=>({id:L.id,name:L.name,sub:L.sub,cards:uniq(c=>c.lv===L.id)})),
               {id:'alle',name:'Alle',sub:'gemischt',cards:allCards()}];
  $('levels').innerHTML='';
  tiles.forEach(T=>{const b=document.createElement('button');b.className='lvl';b.setAttribute('aria-pressed',T.id===level);
    const begun=T.cards.filter(c=>!isNew(c)).length, dn=T.cards.filter(isDue).length;
    b.innerHTML='<b>'+T.name+'</b><small>'+T.sub+'</small>'+stageBar(T.cards)+
      '<div class="lnum"><span>'+begun+'/'+T.cards.length+'</span>'+(dn?'<em>'+dn+' fällig</em>':'<span>&nbsp;</span>')+'</div>';
    b.onclick=()=>setLevel(T.id); $('levels').appendChild(b)});
  // Hinweis auf nächste Stufe
  const cur=LEVELS.findIndex(l=>l.id===level), nxt=LEVELS[cur+1];
  if(cur>=0 && nxt){
    const c=tiles[cur].cards, begun=c.filter(x=>!isNew(x)).length, nx=tiles[cur+1].cards;
    const ready=begun/c.length>=.8 && nx.every(isNew);
    $('lvhint').hidden=!ready;
    if(ready){ $('lvhintT').textContent=Math.round(begun/c.length*100)+' % der '+LEVELS[cur].name+' begonnen — bereit für '+nxt.name+'?';
      $('lvhintB').textContent='Zu '+nxt.name; $('lvhintB').onclick=()=>setLevel(nxt.id); }
  } else $('lvhint').hidden=true;
  // Kopfkarte (für die gewählte Stufe)
  $('kDue').textContent=due; $('kNew').textContent=plan(all).newOk;
  $('kStreak').textContent=sk; $('kStreakL').textContent=sk===1?'Tag in Folge':'Tage in Folge';
  $('kFlame').classList.toggle('on',!!SRS.hist[t]);
  const risk=sk>0 && !SRS.hist[t] && new Date().getHours()>=18;        // Abends, Serie läuft, heute noch nichts
  $('kFlame').classList.toggle('risk',risk); if(risk) $('kStreakL').textContent='Serie heute sichern';
  const P=plan(all), d0=day(), todo=P.reviews+P.newOk, target=d0.n+todo;
  const T=$('todayBtn'), tname='Tagesrunde · '+levelName();
  const minsLeft=Math.max(1,Math.round(todo*pace()/60));
  if(todo){ T.innerHTML='<b>'+tname+'</b><span>noch '+todo+' Karten · ≈ '+minsLeft+' Min</span>'; T.disabled=false;
    T.onclick=()=>startRound(tname,scopeCards,'normal'); }
  else if(P.due.length){ T.innerHTML='<b>Tagesziel erreicht ✓</b><span>Zusatzrunde: '+P.due.length+' weitere Wiederholungen (freiwillig)</span>'; T.disabled=false;
    T.onclick=()=>startRound('Zusatzrunde · '+levelName(),scopeCards,'extra'); }
  else { T.innerHTML='<b>Für heute erledigt ✓</b><span>'+levelName()+' — mehr Neues über die Stapel unten</span>'; T.disabled=true; }
  const gp=target?Math.min(100,Math.round(d0.n/target*100)):100;
  $('goalFill').style.width=gp+'%'; document.querySelector('.goal').classList.toggle('done',!todo);
  $('goalTxt').textContent=todo?d0.n+' / '+target+' Karten':'Tagesziel '+d0.n+' ✓';
  const full = !P.newOk && P.fresh.length && P.cap>0 && P.reviews && P.reviews>=P.left;
  const note = P.backlog ? 'Mehr fällig, als in '+minutes+' Min passt — Neues pausiert, der Rest wird auf die nächsten Tage verteilt.'
    : P.heavy ? 'Die nächsten Tage sind gut gefüllt — neue Karten pausieren kurz, damit es in deiner Lernzeit bleibt.'
    : full ? 'Heute füllen Wiederholungen deine '+minutes+' Min — Neues pausiert bis morgen.' : '';
  $('planNote').textContent=note; $('planNote').hidden=!note;
  $('ovleft').textContent=(all.length-fresh)+' / '+all.length;
  $('ovbar').outerHTML=stageBar(all).replace('class="sbar"','class="sbar" id="ovbar"');
  // Wochengrafik (Lernserie gilt stufenübergreifend)
  const days=[...Array(7)].map((_,i)=>t-6+i), mx=Math.max(1,...days.map(x=>SRS.hist[x]||0));
  const WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
  $('week').innerHTML=days.map(x=>{const v=SRS.hist[x]||0, dt=new Date(x*864e5);
    return '<div class="'+(x===t?'now':'')+'" title="'+v+' Karten"><i class="'+(v?'':'zero')+'" style="height:'+(v?Math.max(12,v/mx*100):10)+'%"></i><span>'+WD[dt.getUTCDay()]+'</span></div>'}).join('');
  // Vorschau
  const dueOn=(lo,hi)=>all.filter(c=>{const x=st(c.key);return x.b>0&&x.due>lo&&x.due<=hi}).length;
  $('fc1').textContent=dueOn(t,t+1); $('fc7').textContent=dueOn(t,t+7);
  // Wackelkandidaten (innerhalb der Stufe)
  const W=$('weakslot'); W.innerHTML='';
  const weakGet=()=>scopeCards().filter(isWeak), nw=weakGet().length;
  if(nw) W.appendChild(deckRow('Wackelkandidaten',weakGet,{hi:true,meta:nw+(nw===1?' Karte':' Karten')+' · Fehler in der Lernphase oder Problemkarte'}));
  // Stapelgruppen
  const G=deckGroups();
  if(!G.some(g=>g.k===deckKind)) deckKind=G[0].k;
  const dueIn=list=>{const seen=new Set();return list.flatMap(cardsOf).filter(c=>!seen.has(c.key)&&seen.add(c.key)&&isDue(c)).length};
  const K=$('kindseg'); K.innerHTML=''; K.hidden=G.length<2;
  G.forEach(g=>{const b=document.createElement('button');const n=dueIn(g.decks);
    b.innerHTML=g.name+(n?' <em>· '+n+'</em>':''); b.setAttribute('aria-pressed',g.k===deckKind); b.dataset.k=g.k;
    b.onclick=()=>{deckKind=g.k;store.set('q.kind',JSON.stringify(deckKind));renderPick()}; K.appendChild(b)});
  const L=$('decklist'); L.innerHTML='';
  G.find(g=>g.k===deckKind).decks.forEach(dk=>L.appendChild(deckRow(dk.name,()=>cardsOf(dk))));
  document.querySelectorAll('#seg button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.n===roundSize));
  document.querySelectorAll('#segnew button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.n===newPerDay));
  document.querySelectorAll('#segmin button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.n===minutes));
  $('planHint').textContent='≈ '+budgetCards()+' Karten in '+minutes+' Min (Ø '+Math.round(pace())+' s pro Karte, gemessen) · '
    +'davon bis zu '+Math.min(newPerDay,sustainNew())+' neue — mehr würde die Wiederholungen der nächsten Wochen über dein Budget treiben.';
  $('autoSpeak').checked=autoSpeak; $('autoRow').hidden=!TTS;
  document.querySelectorAll('#segdir button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.d===dirMode));
  $('dirHint').textContent=DIR_HINT[dirMode]||'';
  document.querySelectorAll('#segret button').forEach(b=>b.setAttribute('aria-pressed',Math.abs(+b.dataset.r-RET)<.001));
  $('retHint').textContent='So sicher soll eine Karte am Fälligkeitstag noch sitzen. '+(RET>=.95?'95 %: kaum Vergessen, aber deutlich mehr Wiederholungen.'
    :RET<=.85?'85 %: weniger Wiederholungen, dafür häufiger „Nochmal".':'90 %: der übliche Kompromiss.')
    +' Gilt ab der nächsten Abfrage jeder Karte.';
  optRender(); renderSkips();
  if(typeof bkStatus==='function') bkStatus();
  renderWho();
  if($('stats').open) renderStats();
}
document.querySelector('details.settings').addEventListener('toggle',e=>{ if(e.target.open){ askPersist(); renderSnaps(); syncStatus(); ttsInfo(); renderDiag(); optRender(); renderSkips(); } });

/* Einstellungen: ausgeblendete Karten */
function renderSkips(){
  const L=skippedCards(), ul=$('skipUl');
  $('skipN').textContent=L.length?L.length+' Karte'+(L.length===1?'':'n'):'keine';
  $('skipList').hidden=!L.length;
  ul.innerHTML='';
  L.sort((a,b)=>a.it[1].localeCompare(b.it[1],'es')).forEach(c=>{
    const li=document.createElement('li');
    li.innerHTML='<div><b></b><span></span></div><button class="act">Zurückholen</button>';
    li.querySelector('b').textContent=c.it[1]; li.querySelector('span').textContent=c.it[0]+' · '+c.deck;
    li.querySelector('button').onclick=()=>{
      const x={...SRS.c[c.key]}; delete x.x; x.u=Date.now(); SRS.c[c.key]=x;
      saveQ(); scheduleSync(); renderPick(); };
    ul.appendChild(li); });
}

/* Einstellungen: eigene Parameter */
// Funktionsdeklarationen (nicht const): renderPick ruft optRender schon beim Start auf, bevor diese Zeilen laufen
function fmtDay(d){ return new Date(d*864e5).toLocaleDateString('de-DE',{timeZone:'UTC',day:'numeric',month:'numeric',year:'2-digit'}); }
function fmtLL(x){ return x.toFixed(3).replace('.',','); }
function llText(a,b){ return fmtLL(a)+' → '+fmtLL(b)+', '+Math.abs(Math.round((1-b/a)*100))+' % '+(b<=a?'besser':'schlechter'); }
function optMsg(t,err){ const m=$('optMsg'); m.textContent=t; m.className='shint'+(err?' err':''); m.hidden=!t; }
function optRender(){
  if(!$('optStat')) return;
  const own=validW(SRS.w), o=loadJ('q.opt',{}), N=logLoad().e.length, wi=SRS.wi||{}, auto=SRS.wauto!==false;
  $('optStat').textContent=optBusy?'rechnet …':own?'eigenen Werten':'Standardwerten';
  $('optStat').className=optBusy?'':own?'ok':'';
  const s=[];
  if(own && wi.src==='hand') s.push('Von Hand eingetragen am '+fmtDay(wi.day)+'.');
  else if(own && wi.ll0!=null) s.push('Berechnet am '+fmtDay(wi.day)+' aus '+wi.n+' Bewertungen ('+wi.items+' Wiederholungen über Tagesgrenzen). '
    +'Vorhersagefehler'+(wi.test?' an den letzten Lerntagen':'')+' (Log-Loss): '+llText(wi.ll0,wi.ll1)+'.');
  else if(own) s.push('Eigene Werte (übernommen'+(wi.day!==undefined?' am '+fmtDay(wi.day):'')+').');
  else s.push(N<OPT_MIN ? 'Ab '+OPT_MIN+' Bewertungen rechnet die App aus deinem Abfrageprotokoll eigene Werte aus (jetzt '+N+').'
    : 'Dein Protokoll hat '+N+' Bewertungen — genug für eigene Werte.');
  const fresh=(o.ts||0)>(SRS.wu||0);
  if(o.err && fresh) s.push('Letzte Berechnung am '+fmtDay(o.day)+' nicht möglich: '+o.err+'.');
  else if(o.ok===false && o.ll0!=null && fresh) s.push('Letzte Berechnung am '+fmtDay(o.day)+': keine Verbesserung ('+llText(o.ll0,o.ll1)+'), Werte behalten.');
  if(!auto) s.push('Automatik aus.');
  else if(o.n && N>=OPT_MIN) s.push('Nächste Berechnung bei '+(2*o.n)+' Bewertungen oder ab '+fmtDay(o.day+OPT_DAYS)+'.');
  $('optHint').textContent=s.join(' ');
  $('optAuto').checked=auto;
  $('optNow').disabled=optBusy; $('optDef').disabled=optBusy||!own;
  if(document.activeElement!==$('optW')) $('optW').value=fw().join(', ');
}
function optChanged(){ saveQ(); const n=rescheduleFromLog(); saveQ(); scheduleSync(); renderPick(); return n; }
$('optNow').onclick=async()=>{
  optMsg('Rechne …');
  try{ const r=await optimize('hand');
    if(!r) return;
    optMsg(r.ok ? 'Übernommen. '+(r.moved?r.moved+' Karten neu eingeplant.':'Keine Karte musste verschoben werden.')
      : 'Keine Verbesserung gegenüber den jetzigen Werten — sie bleiben.');
  }catch(e){ optMsg('Nicht möglich: '+(e&&e.message||e),true); }
};
$('optDef').onclick=()=>{
  if(!confirm('Zurück zu den Standardwerten? Die automatische Berechnung wird dabei ausgeschaltet.')) return;
  snapshot('vor Rückkehr zu den Standardwerten');
  delete SRS.w; SRS.wauto=false; SRS.wu=Date.now(); SRS.wi={day:today(),src:'standard'};
  const n=optChanged(); optMsg('Standardwerte gelten.'+(n?' '+n+' Karten neu eingeplant.':''));
};
$('optAuto').onchange=()=>{
  SRS.wauto=$('optAuto').checked; SRS.wu=Date.now(); saveQ(); scheduleSync(); optMsg(''); optRender();
  if(!SRS.wauto) return;
  if(validW(SRS.w)) optAuto();
  else if(logLoad().e.length>=OPT_MIN){ optMsg('Rechne …');                   // zurück aus „Standardwerte": gleich neu rechnen
    optimize('auto').then(r=>optMsg(r&&r.ok?'Eigene Werte übernommen.':'Keine Verbesserung gegenüber den Standardwerten.'))
      .catch(e=>optMsg('Nicht möglich: '+(e&&e.message||e),true)); }
};
$('optSet').onclick=()=>{
  const w=$('optW').value.split(/[\s,;]+/).filter(Boolean).map(x=>+x.replace(/^\[|\]$/g,''));
  if(!validW(w) || w.slice(0,4).some(x=>x<=0)) { optMsg('Bitte genau 21 Zahlen eingeben, getrennt durch Kommas.',true); return; }
  snapshot('vor Eintrag eigener Parameter');
  SRS.w=w; SRS.wu=Date.now(); SRS.wi={day:today(),n:logLoad().e.length,src:'hand'};
  const n=optChanged(); $('optW').blur(); optRender();
  optMsg('Übernommen.'+(n?' '+n+' Karten neu eingeplant.':''));
};
document.querySelectorAll('#segret button').forEach(b=>b.onclick=()=>{
  RET=+b.dataset.r; store.set('q.ret',JSON.stringify(RET)); renderPick(); });
document.querySelectorAll('#segdir button').forEach(b=>b.onclick=()=>{
  dirMode=b.dataset.d; store.set('q.dir',JSON.stringify(dirMode)); renderPick(); });
$('ttsTest').onclick=()=>{
  ttsLast=null; $('ttsStat').textContent='spreche …'; $('ttsStat').className='';
  speak('Hola, ¿cómo está? Pura vida.');
  setTimeout(()=>{ if(!ttsLast) ttsLast={ok:true,msg:esVoice?esVoice.name+' ('+esVoice.lang+')':'Standardstimme'}; ttsInfo(); },3200);
};
$('autoSpeak').onchange=e=>{autoSpeak=e.target.checked;store.set('q.auto',JSON.stringify(autoSpeak))};
document.querySelectorAll('#seg button').forEach(b=>b.onclick=()=>{roundSize=+b.dataset.n;store.set('q.size',JSON.stringify(roundSize));renderPick()});
document.querySelectorAll('#segnew button').forEach(b=>b.onclick=()=>{newPerDay=+b.dataset.n;store.set('q.newcap',JSON.stringify(newPerDay));renderPick()});
document.querySelectorAll('#segmin button').forEach(b=>b.onclick=()=>{minutes=+b.dataset.n;store.set('q.minutes',JSON.stringify(minutes));SRS.spreadDay=null;spreadBacklog();renderPick()});
function show(id){['pick','play','sum','empty'].forEach(x=>$(x).hidden=(x!==id)); scrollTo({top:0});}

/* --- Runde --- */
let R=null;
function startRound(name,getCards,mode){
  const cards=getCards();
  const list = mode==='cram' ? cramRound(cards) : buildRound(cards, mode);
  R={name,getCards,mode,queue:list.map(c=>({...c,redo:0})),total:list.length,first:0,missed:[]};
  if(!list.length) return showEmpty(name,cards);
  $('pdeck').textContent=name+(mode==='cram'?' · freies Üben':mode==='extra'?' · Zusatzrunde':'');
  show('play'); nextCard();
}
function showEmpty(name,cards){
  const P=plan(cards), fresh=P.fresh.length, learned=cards.length-fresh, due=P.due.length;
  const nextDue=cards.filter(c=>st(c.key).b>0&&st(c.key).due>today()).map(c=>st(c.key).due).sort((a,b)=>a-b)[0];
  $('edeck').textContent=name;
  $('etitle').textContent=due?'Tagesziel erreicht':'Für heute erledigt';
  $('etext').textContent = due ? due+' weitere Wiederholungen wären fällig — freiwillig. Was liegen bleibt, verteilt die App auf die nächsten Tage.'
    : (fresh ? (P.backlog||P.heavy ? 'Neue Karten pausieren, damit die Wiederholungen der nächsten Tage in deine Lernzeit passen. ' : 'Das Tageskontingent für neue Karten ist aufgebraucht. ') : 'Alle Karten dieses Stapels sind gelernt. ')
      + (nextDue!==undefined ? 'Nächste Fälligkeit in '+(nextDue-today())+' Tag'+(nextDue-today()===1?'':'en')+'.' : '');
  $('extra').hidden=!due; $('moreNew').hidden=!fresh; $('cram').hidden=!learned;
  $('extra').onclick=()=>startRound(name,R.getCards,'extra');
  $('moreNew').onclick=()=>startRound(name,R.getCards,'more');
  $('cram').onclick=()=>startRound(name,R.getCards,'cram');
  show('empty');
}
function nextCard(){
  if(!R.queue.length) return finish();
  const c=R.queue[0], x=st(c.key);
  R.shownAt=Date.now();
  const toEs = c.redo ? c.toEs : chooseDir(c,x); // Wiederholung in derselben Richtung wie der Fehlversuch
  R.toEs=toEs;
  const [de,es]=c.it;
  $('qchip').textContent=toEs?'Ins Spanische':'Ins Deutsche';
  $('qchip').className=toEs?'qchip':'qchip rev';
  $('qstage').textContent=x.b===0?'Neu':'Stufe '+x.b;
  $('qredo').hidden=!c.redo;
  $('qleech').hidden=!(x.l>=LEECH);
  $('qprompt').textContent=toEs?de:es;
  $('qprompt').className=toEs?'qprompt':'qprompt esdir';
  $('qans').className=toEs?'qans':'qans dedir';
  $('qanstxt').textContent=toEs?es:de;
  $('qans').hidden=true; $('qtap').hidden=false;
  $('rowJudge').hidden=true;
  // Lautsprecher: Spanisch nur hörbar, wenn es schon sichtbar ist
  $('qspk').hidden=!TTS; $('qspk').disabled=toEs;
  $('qspk').onclick=e=>{e.stopPropagation(); speak(es,toEs?$('qanstxt'):$('qprompt'))};
  if(autoSpeak && !toEs) speak(es,$('qprompt'));
  [0,1,2].forEach(g=>$('iv'+g).textContent=fmtIvl(nextIvl(c,g)));
  const card=$('card'); card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
  const done=R.total-R.queue.filter(q=>!q.redo).length;
  $('fill').style.width=Math.round(done/R.total*100)+'%';
  $('qcount').textContent=Math.min(done+1,R.total)+' / '+R.total;
}
function nextIvl(c,g){                    // spiegelt die Logik in grade()
  const x=st(c.key), t=today();
  if(g===0) return 0;
  if(R.mode==='cram' && !c.redo) return null;
  return ivlOf(fsrsNext(x,g+1,t).s,c.key,t);
}
function fmtIvl(n){
  if(n===null) return 'unverändert';
  if(n===0) return 'gleich';
  if(n===1) return 'morgen';
  if(n<30) return n+' Tage';
  return Math.round(n/30)+' Mon.';
}
function reveal(){
  if(!$('qans').hidden) return;
  $('qans').hidden=false; $('qtap').hidden=true;
  $('qspk').disabled=false;
  if(autoSpeak && R.toEs) speak(R.queue[0].it[1],$('qanstxt'));
  $('rowJudge').hidden=false;
}
$('card').onclick=reveal;

/* g: 0 = Nochmal · 1 = Knapp · 2 = Saß */
function grade(g){
  if(!R || !R.queue.length || $('play').hidden) return;
  if(SRS.snapDay!==today()){ if(Object.keys(SRS.c).length) snapshot('Tagesbeginn'); SRS.snapDay=today(); }   // Stand vor dem ersten Lernen des Tages
  const c=R.queue.shift(), t=today(), x={...st(c.key)}, d=day();
  const firstTry=!c.redo, wasB=x.b, ms=R.shownAt?Date.now()-R.shownAt:0;
  if(firstTry && R.shownAt){                            // Tempo messen: gleitender Mittelwert, Ausreißer ignorieren
    const sec=ms/1000;
    if(sec>=1.5 && sec<=90) SRS.pace=+(.85*(SRS.pace||PACE_DEF)+.15*Math.min(40,Math.max(3,sec))).toFixed(2);
  }
  logReview(c.key,t,g+1,wasB>0?t-lastRev(x):-1,c.redo?1:R.mode==='cram'?2:R.mode==='extra'?3:0,R.toEs,ms);
  if(firstTry){ d.n++; if(g>0) d.ok++; if(x.b===0) d.nw++; if(g>0) R.first++;
    SRS.hist[t]=(SRS.hist[t]||0)+1; SRS.ok[t]=(SRS.ok[t]||0)+(g>0?1:0);
    if(wasB>0 && R.mode!=='cram'){                      // Trefferquote nur über echte Wiederholungen
      d.rn=(d.rn||0)+1; SRS.rn[t]=(SRS.rn[t]||0)+1;
      if(g>0){ d.rok=(d.rok||0)+1; SRS.rok[t]=(SRS.rok[t]||0)+1; } }
    { const sk=streak(); if(sk>(SRS.best||0)) SRS.best=sk; }
    if(SYNC&&SYNC.gist&&!SYNC.pending){ SYNC.pending=true; store.set('q.sync',JSON.stringify(SYNC)); }   // Verlassen der App lädt den Tagesstand hoch
    Object.keys(SRS.hist).forEach(k=>{ if(+k<t-365){ delete SRS.hist[k]; delete SRS.ok[k]; } });   // ein Jahr Verlauf
    Object.keys(SRS.rn).forEach(k=>{ if(+k<t-365){ delete SRS.rn[k]; delete SRS.rok[k]; } });
  }
  if(R.mode==='cram' && firstTry && g>0){
    /* freies Üben: Erfolg verschiebt nichts — die Abfrage war außerhalb des Plans */
  } else {
    const m=fsrsNext(x,g+1,t);
    x.s=+m.s.toFixed(3); x.d=+m.d.toFixed(3); x.b=stageOfS(x.s); x.r=x.fr=t;
    if(g===0){
      if(firstTry){ x.l=(x.l||0)+1; R.missed.push(c); }
      x.due=t;
      // Successive Relearning: ans Rundenende, bis die Karte einmal sitzt (Sicherung gegen Endlosschleife)
      if(c.redo<REDO_MAX) R.queue.push({...c,redo:c.redo+1,toEs:R.toEs});
    } else x.due=t+ivlOf(x.s,c.key,t);
  }
  const prev=SRS.c[c.key];
  if(!prev || prev.b!==x.b || prev.due!==x.due || prev.l!==x.l || prev.r!==x.r || prev.s!==x.s){   // nur echte Änderungen zählen beim Abgleich
    x.u=Date.now(); SRS.c[c.key]=x; saveQ();
  } else saveQ();                                                // Tagesstatistik trotzdem sichern
  nextCard();
}
/* „Brauche ich nicht": Karte ausblenden, aus der Runde nehmen (auch Wiederholungen), 6 s Rückgängig */
let skipUndo=null;
function skipCard(){
  if(!R || !R.queue.length || $('play').hidden) return;
  const c=R.queue[0], prev=SRS.c[c.key], removed=R.queue.filter(q=>q.key===c.key);
  R.queue=R.queue.filter(q=>q.key!==c.key);
  const counted=!c.redo;                                   // noch nicht beantwortet → zählt nicht mehr zur Runde
  if(counted) R.total=Math.max(0,R.total-1);
  SRS.c[c.key]={...st(c.key),x:1,u:Date.now()}; saveQ(); scheduleSync();
  showSkipToast(c,()=>{                                    // Rückgängig
    if(prev) SRS.c[c.key]={...prev,u:Date.now()}; else delete SRS.c[c.key];
    saveQ(); scheduleSync();
    if(R && !$('play').hidden){ R.queue.unshift(...removed); if(counted) R.total++; nextCard(); }
  });
  if(!R.queue.length && R.total===0){ show('pick'); renderPick(); return; }   // Runde bestand nur aus dieser Karte
  nextCard();
}
function showSkipToast(c,undo){
  if(skipUndo) skipUndo.el.remove();
  const el=document.createElement('div'); el.className='upd skiptoast';
  el.innerHTML='<span></span><button>Rückgängig</button>';
  el.querySelector('span').textContent='„'+c.it[1]+'“ ausgeblendet';
  const t=setTimeout(()=>{ el.remove(); if(skipUndo&&skipUndo.el===el) skipUndo=null; },6000);
  el.querySelector('button').onclick=()=>{ clearTimeout(t); el.remove(); skipUndo=null; undo(); };
  document.body.appendChild(el); skipUndo={el};
}
$('qskip').onclick=e=>{ e.stopPropagation(); skipCard(); };
$('again').onclick=()=>grade(0);
$('hard').onclick=()=>grade(1);
$('got').onclick=()=>grade(2);

function finish(){
  $('fill').style.width='100%';
  $('sumbig').innerHTML=R.first+'<span> / '+R.total+'</span>';
  $('sumtxt').textContent=R.first===R.total?'Alles beim ersten Versuch gewusst.':'beim ersten Versuch gewusst';
  const all=scopeCards(), d=day(), t=today();
  $('sToday').textContent=d.n;
  $('sRate').textContent=d.rn?Math.round((d.rok||0)/d.rn*100)+' %':'–';
  $('sLeft').textContent=all.filter(isDue).length;
  $('sTomorrow').textContent=all.filter(c=>{const x=st(c.key);return x.b>0&&x.due===t+1}).length;
  const L=$('sumlist'); L.innerHTML='';
  R.missed.forEach(c=>{const li=document.createElement('li');
    li.innerHTML='<span class="es"></span> <span class="gloss"></span>';
    li.children[0].textContent=c.it[1]; li.children[1].textContent='— '+c.it[0]; L.appendChild(li)});
  show('sum');
  maybeFlame();
  scheduleSync();
}

/* --- Flamme: einmal pro Tag nach der ersten abgeschlossenen Runde --- */
const MILESTONES={3:'Drei Tage — die Gewohnheit entsteht.',7:'Eine ganze Woche! ¡Qué bien!',14:'Zwei Wochen am Stück. ¡Excelente!',
  21:'Drei Wochen — jetzt ist es Routine.',30:'Ein Monat! ¡Pura vida!',50:'50 Tage. ¡Increíble!',75:'75 Tage. Costa Rica kann kommen.',100:'100 Tage! ¡Felicidades!'};
function flameMsg(n){
  if(MILESTONES[n]) return MILESTONES[n];
  if(n===1) return SRS.everBroken ? 'Neue Serie gestartet. ¡Vamos!' : 'Der erste Tag deiner Serie. ¡Vamos!';
  const next=Object.keys(MILESTONES).map(Number).find(m=>m>n);
  return next ? 'Noch '+(next-n)+(next-n===1?' Tag':' Tage')+' bis '+next+'.' : '¡Sigue así!';
}
function maybeFlame(){
  const t=today();
  if(!SRS.hist[t] || SRS.flame===t) return;
  if(SRS.flame!==undefined && SRS.flame<t-1 && !SRS.hist[t-1]) SRS.everBroken=true;
  SRS.flame=t; saveQ();
  const n=streak();
  $('fn0').textContent=Math.max(0,n-1); $('fn1').textContent=n;
  $('fnum').classList.remove('up');
  $('flbl').textContent=n===1?'Tag in Folge':'Tage in Folge';
  $('fmsg').textContent=flameMsg(n);
  const WD=['So','Mo','Di','Mi','Do','Fr','Sa'], mini=$('kFlame').innerHTML.replace(/kf(\d)/g,'wf$1');
  $('fweek').innerHTML=[...Array(7)].map((_,i)=>{const x=t-6+i,on=!!SRS.hist[x];
    return '<div class="'+(x===t?'now':'')+'"><span>'+WD[new Date(x*864e5).getUTCDay()]+'</span><i class="'+(on?'on':'')+'">'+(on?mini:'')+'</i></div>'}).join('');
  // Funken
  const box=$('fbig'); box.querySelectorAll('.spark').forEach(e=>e.remove());
  for(let i=0;i<10;i++){const sp=document.createElement('i');sp.className='spark';
    const a=Math.PI*2*i/10, r=70+Math.random()*30;
    sp.style.setProperty('--dx',(Math.cos(a)*r-3)+'px'); sp.style.setProperty('--dy',(Math.sin(a)*r-40)+'px');
    sp.style.animationDelay=(.3+Math.random()*.2)+'s'; box.appendChild(sp);}
  $('flame').hidden=false;
  setTimeout(()=>$('fnum').classList.add('up'),650);
}
$('fok').onclick=()=>{$('flame').hidden=true};

/* ===================== Speichern ===================== */
/* 1. Dauerhaften Speicher anfordern, damit iOS die Daten nicht bei Platzmangel räumt */
async function askPersist(){
  const el=$('stPersist');
  try{
    if(!(navigator.storage && navigator.storage.persist)){ el.textContent='nicht abfragbar'; return; }
    const p=(await navigator.storage.persisted()) || (await navigator.storage.persist());
    el.textContent=p?'dauerhaft geschützt':'kann bei Platzmangel geräumt werden'; el.className=p?'ok':'warn';
  }catch(e){ el.textContent='nicht abfragbar'; }
}

/* 2. Wiederherstellungspunkte: automatisch, lokal, die letzten 7 */
const SNAP_MAX=7;
function snapshot(reason){
  const list=loadJ('q.snaps',[]);
  list.unshift({t:Date.now(),r:reason,n:Object.keys(SRS.c).length,s:JSON.stringify(SRS)});
  for(let keep=SNAP_MAX; keep>=1; keep--){                 // bei vollem Speicher ältere Punkte opfern
    try{ localStorage.setItem(nsk('q.snaps'),JSON.stringify(list.slice(0,keep))); return; }catch(e){}
  }
}
function renderSnaps(){
  const list=loadJ('q.snaps',[]), sel=$('snapSel');
  $('snapN').textContent=list.length?list.length+' gespeichert':'noch keine';
  sel.innerHTML=list.map((x,i)=>'<option value="'+i+'">'+new Date(x.t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' · '+x.r+' · '+x.n+' Karten</option>').join('');
  sel.hidden=$('snapGo').hidden=!list.length;
}
$('snapGo').onclick=()=>{
  const list=loadJ('q.snaps',[]), x=list[+$('snapSel').value]; if(!x) return;
  if(!confirm('Lernstand auf '+new Date(x.t).toLocaleString('de-DE')+' zurücksetzen? Der jetzige Stand wird vorher als Punkt gesichert.')) return;
  snapshot('vor Zurücksetzen');
  const gen=(SRS.gen||0)+1;
  SRS=JSON.parse(x.s); if(!SRS.hist) SRS.hist={}; if(!SRS.ok) SRS.ok={}; if(!SRS.rn) SRS.rn={}; if(!SRS.rok) SRS.rok={};
  SRS.gen=gen;                                               // neue Generation: gilt auf allen Geräten
  saveQ(); renderPick(); renderSnaps(); scheduleSync(true);
};

/* 3. Cloud-Sync über ein geheimes GitHub-Gist */
const GH='https://api.github.com', LEARN_RE=/^espanol-lernstand.*\.json$/;
const slug=n=>n.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'profil';
const fileFor=n=>'espanol-lernstand-'+slug(n)+'.json';
const myFile=()=>(SYNC&&SYNC.file)||'espanol-lernstand.json';      // alte Einzeldatei bleibt gültig
const payload=()=>JSON.stringify({app:'espanol-de-bolsillo',v:3,name:curProfile().name,saved:new Date().toISOString(),srs:SRS});
function learnerFiles(g){
  return Object.entries(g.files||{}).filter(([f])=>LEARN_RE.test(f)).map(([f,v])=>{
    let d={}; try{d=JSON.parse(v.content||'{}')}catch(e){}
    return {file:f,name:d.name||'Profil ohne Namen',n:d.srs?begunN(d.srs.c):0,srs:d.srs}; });
}
let SYNC=loadJ('q.sync',null), syncTimer=null, syncing=false;
async function gh(path,opt={}){
  const r=await fetch(GH+path,{...opt,cache:'no-store',headers:{Authorization:'Bearer '+SYNC.token,Accept:'application/vnd.github+json',
    ...(opt.body?{'Content-Type':'application/json'}:{})}});
  if(r.status===401) throw new Error('Token ungültig oder abgelaufen');
  if(r.status===404) throw new Error('Gist nicht gefunden');
  if(!r.ok) throw new Error('GitHub antwortet '+r.status);
  if(r.status===204) return null;
  return r.json();
}
function mergeInto(T,rem){               // pro Karte gewinnt der neuere Stand, Lerntage werden vereinigt
  let n=0; T.c=T.c||{}; T.hist=T.hist||{};
  for(const [k,r] of Object.entries(rem.c||{})){ const l=T.c[k]; if(!l || (r.u||0)>(l.u||0)){ T.c[k]=r; n++; } }
  for(const [d,v] of Object.entries(rem.hist||{})){ if((T.hist[d]||0)<v){ T.hist[d]=v; n++; } }
  T.ok=T.ok||{};
  for(const [d,v] of Object.entries(rem.ok||{})){ if(T.ok[d]===undefined||T.ok[d]<v){ T.ok[d]=v; n++; } }
  T.rn=T.rn||{}; T.rok=T.rok||{};
  for(const [d,v] of Object.entries(rem.rn||{})){ if((T.rn[d]||0)<v){ T.rn[d]=v; n++; } }
  for(const [d,v] of Object.entries(rem.rok||{})){ if((T.rok[d]||0)<v){ T.rok[d]=v; n++; } }
  if((rem.wu||0)>(T.wu||0)){                                 // eigene FSRS-Parameter: der neuere Stand gilt, auch „zurück auf Standard"
    if(Array.isArray(rem.w)) T.w=rem.w; else delete T.w;
    T.wu=rem.wu; if(rem.wi) T.wi=rem.wi; if(rem.wauto!==undefined) T.wauto=rem.wauto; else delete T.wauto; n++; }
  if((rem.best||0)>(T.best||0)){ T.best=rem.best; n++; }
  if(rem.flame!==undefined && (T.flame===undefined || rem.flame>T.flame)) T.flame=rem.flame;
  if(rem.everBroken) T.everBroken=true;
  return n;
}
const mergeRemote=rem=>mergeInto(SRS,rem);
const fileOfProfile=id=>{ let x=null; try{x=JSON.parse(raw.get(pfx(id)+'q.sync')||'null')}catch(e){}
  return x&&x.gist ? (x.file||'espanol-lernstand.json') : null; };
const trimHist=h=>{ const t=today(), o={}; Object.entries(h||{}).forEach(([d,v])=>{ if(+d>t-400) o[d]=v; }); return o; };
function syncStatus(msg,err){
  const el=$('syStat'), on=!!(SYNC&&SYNC.gist&&!SYNC.choosing);
  $('syOffBox').hidden=on; $('syOnBox').hidden=!on;
  if(msg){ el.textContent=msg; el.className=err?'warn':''; return; }
  if(SYNC&&SYNC.choosing){ el.textContent='Profil zuordnen'; el.className=''; return; }
  if(!on){ el.textContent='aus'; el.className='';
    let shared=null; try{shared=JSON.parse(raw.get('app.gh')||'null')}catch(e){}
    const tk=(SYNC&&SYNC.token)||(shared&&shared.token);
    if(tk&&!$('syToken').value) $('syToken').value=tk;       // Zugang eines anderen Profils auf diesem Gerät
    return; }
  const m=SYNC.last?Math.round((Date.now()-SYNC.last)/6e4):null;
  el.textContent=m===null?'verbunden':'abgeglichen '+(m<1?'gerade eben':m<60?'vor '+m+' Min.':m<1440?'vor '+Math.round(m/60)+' Std.':'vor '+Math.round(m/1440)+' Tagen');
  el.className=SYNC.pending?'warn':'ok';
  if(SYNC.pending) el.textContent+=' · Änderungen offen';
}
async function syncNow(){
  if(!SYNC||!SYNC.gist||SYNC.choosing||syncing) return;   // ohne Zuordnung nie schreiben
  syncing=true; syncStatus('gleiche ab …');
  try{
    const g=await gh('/gists/'+SYNC.gist), f=g.files&&g.files[myFile()];
    for(const [fn,v] of Object.entries(g.files||{}))      // große Dateien liefert die API nur gekürzt
      if(fn!==myFile()&&LEARN_RE.test(fn)&&v.truncated){ try{ v.content=await (await fetch(v.raw_url)).text(); }catch(e){} }
    if(f){
      const txt=f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
      const rem=JSON.parse(txt).srs, lg=SRS.gen||0, rg=(rem&&rem.gen)||0;
      if(rem && rg>lg){                       // anderes Gerät hat zurückgesetzt oder eine Datei geladen: das gilt
        snapshot('vor Übernahme vom anderen Gerät');
        const keepDay=SRS.day; SRS=rem; SRS.day=keepDay; if(!SRS.hist) SRS.hist={}; if(!SRS.ok) SRS.ok={}; if(!SRS.rn) SRS.rn={}; if(!SRS.rok) SRS.rok={};
        saveQ(); if(!$('pick').hidden) renderPick();
      } else if(rem && rg===lg && mergeRemote(rem)){ saveQ(); if(!$('pick').hidden) renderPick(); }
      // rg<lg: dieses Gerät hat zurückgesetzt → nur hochladen
    }
    // Lernpartner: Lerntage roh merken — Serie und „heute" werden erst beim Anzeigen berechnet
    const others=learnerFiles(g).filter(x=>x.file!==myFile());
    raw.set('app.peers',JSON.stringify(others.map(x=>({name:x.name,file:x.file,
      hist:trimHist(x.srs&&x.srs.hist),begun:x.n}))));
    if(!$('pick').hidden) renderWho();                       // Partner sofort zeigen, auch wenn der Upload gleich scheitert
    // inaktive Profile auf diesem Gerät, die mit einer dieser Dateien verbunden sind, gleich mit auffrischen
    PROFILES.filter(q=>q.id!==CUR).forEach(q=>{
      const f=fileOfProfile(q.id), x=f&&others.find(o=>o.file===f); if(!x||!x.srs) return;
      let loc=null; try{loc=JSON.parse(raw.get(pfx(q.id)+'q.srs')||'null')}catch(e){}
      if(!loc){ loc={c:{},hist:{}}; }
      if((x.srs.gen||0)>(loc.gen||0)){ const day=loc.day; loc=JSON.parse(JSON.stringify(x.srs)); if(day) loc.day=day; }
      else if((x.srs.gen||0)===(loc.gen||0)) mergeInto(loc,x.srs); else return;
      raw.set(pfx(q.id)+'q.srs',JSON.stringify(loc));
    });
    await gh('/gists/'+SYNC.gist,{method:'PATCH',body:JSON.stringify({files:{[myFile()]:{content:payload()}}})});
    if(!$('pick').hidden){ renderWho(); if(document.querySelector('details.settings').open) renderDiag(); }
    SYNC.last=Date.now(); SYNC.pending=false; store.set('q.sync',JSON.stringify(SYNC)); syncStatus();
  }catch(e){
    SYNC.pending=true; store.set('q.sync',JSON.stringify(SYNC));
    syncStatus(navigator.onLine===false?'offline · wird nachgeholt':e.message,true);
  }finally{ syncing=false; if(typeof bkStatus==='function') bkStatus(); }
}
function scheduleSync(now){
  if(!SYNC||!SYNC.gist) return;
  SYNC.pending=true; store.set('q.sync',JSON.stringify(SYNC));
  clearTimeout(syncTimer); syncTimer=setTimeout(syncNow, now?0:2500);
}
$('syConnect').onclick=async()=>{
  const token=$('syToken').value.trim(); if(!token) return;
  if(isDefaultName(curProfile().name)){                   // „Ich" ist für Lernpartner nicht unterscheidbar
    const n=(prompt('Wie heißt du? Dein Lernpartner sieht diesen Namen.')||'').trim();
    if(n && !PROFILES.some(x=>x.id!==CUR&&x.name.toLowerCase()===n.toLowerCase())){ curProfile().name=n; saveProfiles(); renderWho(); }
  }
  SYNC={token}; syncStatus('verbinde …');
  try{
    const list=await gh('/gists?per_page=100');
    const hit=list.find(x=>x.files&&Object.keys(x.files).some(f=>LEARN_RE.test(f)));
    if(!hit){                                             // erster Lernender überhaupt: Gist anlegen
      const file=fileFor(curProfile().name);
      const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:'Español de bolsillo – Lernstand',public:false,
        files:{[file]:{content:payload()}}})});
      const dup=(await gh('/gists?per_page=100')).filter(x=>x.id!==g.id&&x.files&&Object.keys(x.files).some(f=>LEARN_RE.test(f)))
        .sort((p,q)=>(p.created_at+p.id<q.created_at+q.id?-1:1))[0];
      if(dup && (dup.created_at+dup.id) < (g.created_at+g.id)){   // anderes Gerät war schneller: dessen Gist nehmen
        await gh('/gists/'+g.id,{method:'DELETE'});
        SYNC.gist=dup.id; SYNC.choosing=true; return chooseLearner(learnerFiles(await gh('/gists/'+dup.id)));
      }
      SYNC.gist=g.id; SYNC.file=file; return finishConnect();
    }
    SYNC.gist=hit.id; SYNC.choosing=true;
    chooseLearner(learnerFiles(await gh('/gists/'+hit.id)));
  }catch(e){ SYNC=null; store.set('q.sync','null'); syncStatus(e.message,true); $('syOffBox').hidden=false; }
};
function chooseLearner(L){                              // Wer lernt auf diesem Profil?
  const box=$('syChoose'); box.innerHTML=''; box.hidden=false; $('syOffBox').hidden=true;
  syncStatus('Profil zuordnen');
  const h=document.createElement('p'); h.className='shint'; h.textContent='Im Cloud-Speicher gefunden. Wer lernt auf diesem Profil?'; box.appendChild(h);
  const mk=(html,cls,fn)=>{const b=document.createElement('button');b.className='act '+cls;b.innerHTML=html;b.onclick=fn;box.appendChild(b);return b;};
  const meN=curProfile().name.toLowerCase();
  L.sort((a,b)=>(b.name.toLowerCase()===meN)-(a.name.toLowerCase()===meN));
  L.forEach(x=>{ const same=x.name.toLowerCase()===meN;
    const b=mk('Das bin ich: <b></b> <small></small>',same?'pri':'',()=>{SYNC.file=x.file; finishConnect();});
    b.querySelector('b').textContent=x.name; b.querySelector('small').textContent='· '+x.n+' Karten'; });
  const me=curProfile().name;
  if(L.some(x=>x.name.toLowerCase()===meN)){ const w=document.createElement('p'); w.className='shint';
    w.textContent='Es gibt schon einen Lernstand „'+curProfile().name+'". Bist du das, nimm ihn — sonst entsteht eine zweite, getrennte Datei.'; box.appendChild(w); }
  const nb=mk('',L.some(x=>x.name.toLowerCase()===meN)?'':'pri',()=>{ let f=fileFor(me),i=2; while(L.some(x=>x.file===f)) f=fileFor(me+'-'+(i++)); SYNC.file=f; finishConnect(); });
  nb.textContent='Neu anlegen als „'+me+'"';
  mk('Abbrechen','',()=>{ SYNC=null; store.set('q.sync','null'); box.hidden=true; syncStatus(); });
}
async function finishConnect(){
  delete SYNC.choosing; $('syChoose').hidden=true;
  if(Object.keys(SRS.c).length) snapshot('vor erstem Abgleich');
  store.set('q.sync',JSON.stringify(SYNC)); $('syToken').value='';
  raw.set('app.gh',JSON.stringify({token:SYNC.token}));      // Zugang für weitere Profile auf diesem Gerät merken
  await syncNow();
}
$('syNow').onclick=()=>syncNow();
const APP_VERSION='2026-10-27 · 15';
function relDay(d){ if(d<0) return 'noch nie gelernt'; const n=today()-d; return n===0?'heute gelernt':n===1?'gestern gelernt':'zuletzt vor '+n+' Tagen'; }
function renderDiag(){
  $('verInfo').textContent='App '+APP_VERSION;
  if(window.caches&&caches.keys) caches.keys().then(k=>{ if(k.length) $('verInfo').textContent='App '+APP_VERSION+' · Offline-Speicher '+k.join(', '); }).catch(()=>{});
  const on=!!(SYNC&&SYNC.gist&&!SYNC.choosing); $('diagBox').hidden=!on; if(!on) return;
  const L=$('diagList'); L.innerHTML='';
  const row=(name,sub,tag,me,off,del)=>{ const r=document.createElement('div'); r.className='drow2'+(me?' me':'');
    r.innerHTML='<span class="ava"></span><span class="dn"><b></b><small></small></span><span class="tag2'+(off?' off':'')+'"></span>';
    r.querySelector('.ava').textContent=initial(name); r.querySelector('b').textContent=name; r.querySelector('small').textContent=sub;
    r.querySelector('.tag2').textContent=tag;
    if(del){ const b=document.createElement('button'); b.textContent='Löschen'; b.onclick=del; r.appendChild(b); }
    L.appendChild(r); };
  row(curProfile().name,myFile()+' · '+relDay(lastDay(SRS.hist))+' · Serie '+streak(),'du',true,false);
  const E=peerEntries().filter(e=>e.src==='cloud');
  $('diagN').textContent=E.length?E.length+(E.length===1?' Datei':' Dateien'):'keine';
  if(!E.length){ const p=document.createElement('p'); p.className='shint';
    p.textContent='Noch keine andere Person in diesem Gist. Auf dem anderen iPhone denselben Token eingeben und „Neu anlegen" wählen.'; L.appendChild(p); }
  E.forEach(e=>row(e.name,e.file+' · '+relDay(lastDay(e.hist))+' · Serie '+streakOf(e.hist),e.why,false,!e.shown,
    (e.shown&&!e.same)?null:async()=>{
      if(!confirm('Veraltete Datei „'+e.file+'" aus der Cloud löschen? Der aktuellere Lernstand von „'+e.name+'" bleibt erhalten.')) return;
      try{ await gh('/gists/'+SYNC.gist,{method:'PATCH',body:JSON.stringify({files:{[e.file]:null}})}); await syncNow(); renderDiag(); }
      catch(err){ syncStatus(err.message,true); }
    }));
}
$('syOff').onclick=()=>{
  if(!confirm('Cloud-Sync trennen? Das Gist bleibt auf GitHub erhalten, dieses Gerät gleicht nur nicht mehr ab.')) return;
  SYNC=null; store.set('q.sync','null'); syncStatus(); bkStatus();
};
// Abgleich beim Öffnen, beim Zurückkehren in die App und wenn das Netz wiederkommt
document.addEventListener('visibilitychange',()=>{
  if(!SYNC||!SYNC.gist) return;
  if(document.visibilityState==='visible' && (!SYNC.last || Date.now()-SYNC.last>6e4 || SYNC.pending)) syncNow();
  if(document.visibilityState==='hidden' && SYNC.pending) syncNow();
});
addEventListener('online',()=>{ if(SYNC&&SYNC.pending) syncNow(); });
if(SYNC&&SYNC.gist) setTimeout(syncNow,800);

/* --- Lernstand sichern / wiederherstellen --- */
const BK_KEYS=['q.srs','q.size','q.newcap','q.kind','q.auto','q.level','q.dir','q.minutes','q.ret','q.log'];
function bkStatus(){
  const last=loadJ('q.backup',null), started=Object.keys(SRS.c).length;
  const days=last===null?null:today()-last;
  const el=$('bkLast');
  el.textContent = last===null ? 'noch nie gesichert' : days===0 ? 'heute gesichert' : 'vor '+days+(days===1?' Tag':' Tagen');
  const synced = SYNC && SYNC.last && Date.now()-SYNC.last < 14*864e5;
  const stale = started>=20 && !synced && (last===null || days>=14);     // Erinnerung erst bei nennenswertem Stand
  el.className = stale ? 'warn' : '';
  document.querySelector('details.settings').classList.toggle('nudge',stale);
}
function bkMsg(t,err){ const m=$('bkMsg'); m.textContent=t; m.className='bkmsg'+(err?' err':''); m.hidden=false; }
$('bkOut').onclick=async()=>{
  const data={app:'espanol-de-bolsillo',v:1,saved:new Date().toISOString(),store:{}};
  BK_KEYS.forEach(k=>{const v=store.get(k); if(v!==null) data.store[k]=v;});
  data.store['q.srs']=JSON.stringify(SRS);
  const name='espanol-lernstand-'+slug(curProfile().name)+'-'+new Date().toISOString().slice(0,10)+'.json';
  const done=()=>{store.set('q.backup',JSON.stringify(today())); bkStatus();};
  await giveFile(name,JSON.stringify(data),'application/json','Español – Lernstand',done,'Gesichert. Am besten in „Dateien" oder iCloud Drive ablegen.');
};
/* Datei übergeben: Teilen-Menü (iPhone), sonst Download, sonst Zwischenablage */
async function giveFile(name,text,type,title,done,okMsg){
  try{
    const file=new File([text],name,{type});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title}); done(); bkMsg(okMsg); return;
    }
    const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); done();
    bkMsg('Datei „'+name+'" wurde erzeugt.');
  }catch(e){
    if(e && e.name==='AbortError') return;                     // Teilen abgebrochen
    try{ await navigator.clipboard.writeText(text); done(); bkMsg('Als Text in die Zwischenablage kopiert.'); }
    catch(_){ bkMsg('Export nicht möglich: '+(e&&e.message||e),true); }
  }
}
/* Abfrageprotokoll als CSV — Eingabe für die Anpassung der FSRS-Parameter */
function logCsv(){
  const L=logLoad(), q=v=>'"'+String(v).replace(/"/g,'""')+'"', M=['plan','redo','frei','zusatz'];
  return 'card_id,card,day,date,rating,elapsed_days,mode,to_spanish,duration_ms\n'+L.e.map(e=>
    [e[1],q(L.k[e[1]]),e[0],new Date(e[0]*864e5).toISOString().slice(0,10),e[2],e[3],M[e[4]]||e[4],e[5],e[6]].join(',')).join('\n')+'\n';
}
$('logOut').onclick=async()=>{
  const L=logLoad(); if(!L.e.length){ bkMsg('Noch keine Abfragen protokolliert — das beginnt mit diesem Update.'); return; }
  const name='espanol-protokoll-'+slug(curProfile().name)+'-'+new Date().toISOString().slice(0,10)+'.csv';
  await giveFile(name,logCsv(),'text/csv','Español – Abfrageprotokoll',()=>{},L.e.length+' Bewertungen exportiert.');
};
const readText=f=>f.text?f.text():new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsText(f)});
$('bkIn').onclick=()=>$('bkFile').click();
$('bkFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{
    const data=JSON.parse(await readText(f));
    const srs=JSON.parse(data.store['q.srs']);
    if(data.app!=='espanol-de-bolsillo' || !srs || typeof srs.c!=='object') throw new Error('keine gültige Sicherung');
    const n=Object.keys(srs.c).length, when=new Date(data.saved).toLocaleDateString('de-DE');
    if(!confirm('Sicherung vom '+when+' mit '+n+' begonnenen Karten laden? Der aktuelle Stand wird ersetzt.')) return;
    snapshot('vor Laden einer Datei');
    Object.entries(data.store).forEach(([k,v])=>{ if(BK_KEYS.includes(k)) store.set(k,v); });
    const gen=(SRS.gen||0)+1;
    SRS=srs; if(!SRS.hist) SRS.hist={}; if(!SRS.ok) SRS.ok={}; if(!SRS.rn) SRS.rn={}; if(!SRS.rok) SRS.rok={};
    SRS.gen=gen;                                             // neue Generation: gilt auf allen Geräten
    saveQ(); scheduleSync(true);
    LOG=null; RET=loadJ('q.ret',0.9);
    roundSize=loadJ('q.size',10); newPerDay=loadJ('q.newcap',10); minutes=loadJ('q.minutes',10); deckKind=loadJ('q.kind','s'); autoSpeak=loadJ('q.auto',false); level=loadJ('q.level','basis'); dirMode=loadJ('q.dir','auto');
    renderPick(); bkStatus(); bkMsg('Lernstand vom '+when+' geladen ('+n+' Karten).');
  }catch(err){ bkMsg('Datei konnte nicht gelesen werden: '+err.message,true); }
};
$('flame').onclick=e=>{if(e.target.id==='flame')$('flame').hidden=true};
$('nextround').onclick=()=>startRound(R.name,R.getCards,R.mode==='cram'?'cram':'normal');
$('topick').onclick=()=>{renderPick();show('pick')};
$('back').onclick=()=>{if(TTS)speechSynthesis.cancel();renderPick();show('pick')};
$('back2').onclick=()=>{renderPick();show('pick')};
function quizEnter(){ spreadBacklog();
   if(!R || !$('pick').hidden || !$('sum').hidden || !$('empty').hidden){ renderPick(); show('pick'); } }

/* Einmalig (Version 13): Karten, die seit der FSRS-Umstellung mit zu niedriger Schwierigkeit geplant wurden,
   aus dem Protokoll neu berechnen — vorher Wiederherstellungspunkt. */
if(!loadJ('q.fix1',false)){
  try{ if(logLoad().e.length){ snapshot('vor Neuberechnung der Abstände'); const n=rescheduleFromLog(); if(n) scheduleSync(); } }catch(e){}
  store.set('q.fix1','true');
}

/* Eigene Parameter: im Hintergrund prüfen, ob eine Neuberechnung fällig ist — nicht mitten in einer Runde */
function optWhenIdle(){ if($('play').hidden) optAuto(); else setTimeout(optWhenIdle,6e4); }
setTimeout(optWhenIdle,4000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') setTimeout(optWhenIdle,4000); });

/* ===================== Hinweise ===================== */
const tip=document.createElement('div'); tip.className='tip'; tip.hidden=true; document.body.appendChild(tip);
let tipTimer=null;
document.addEventListener('click',e=>{                    // Werte aus title-Attributen per Tipp zeigen (iPhone hat keinen Mauszeiger)
  const el=e.target.closest&&e.target.closest('#statsBody [title], #peers [title], #week [title]');
  if(!el) return;
  tip.textContent=el.getAttribute('title'); tip.hidden=false;
  clearTimeout(tipTimer); tipTimer=setTimeout(()=>tip.hidden=true,2600);
});

/* ===================== Offline ===================== */
if('serviceWorker' in navigator){
  const hadCtl=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{    // neue Version hat übernommen: Neustart anbieten
    if(!hadCtl) return;
    const u=document.createElement('div'); u.className='upd';
    u.innerHTML='<span>Neue Version geladen</span><button>Neu starten</button>';
    u.querySelector('button').onclick=()=>location.reload(); document.body.appendChild(u);
  });
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
