/* ===================== Verbtrainer: Lernstand und Planung ===================== */
/* Karten vb:<verb>:<form> liegen in SRS.c und werden wie Vokabeln mit FSRS geplant (fsrsNext, ivlOf aus app.js).
   SRS wird bei Sync, Wiederherstellung und Profilwechsel neu zugewiesen: hier immer die globale Variable lesen.
   Bewusst nicht berührt: q.log, SRS.ok/rn/rok/pace, day() — Zielretention und Optimierer bleiben auf Vokabeln eingestellt. */
const VT_DEF={forms:['pres','ind','imp'],size:5,newPerDay:2,strict:true};
let VT_ALL=null;
const vtAll=()=>VT_ALL||(VT_ALL=vtCards());

function vtSettings(){                                   // immer frisch lesen: kein Zustand, der nach Profilwechsel veraltet
  const ids=VT_FORMS.map(f=>f.id), clamp=(v,lo,hi,d)=>Number.isFinite(+v)&&v!==null?Math.min(hi,Math.max(lo,Math.round(+v))):d;
  const f=loadJ('q.vbforms',VT_DEF.forms);
  return {forms:Array.isArray(f)?f.filter(x=>ids.includes(x)):VT_DEF.forms,
    size:clamp(loadJ('q.vbsize',VT_DEF.size),1,30,VT_DEF.size),
    newPerDay:clamp(loadJ('q.vbnew',VT_DEF.newPerDay),0,20,VT_DEF.newPerDay),
    strict:loadJ('q.vbacc',VT_DEF.strict)!==false};
}
const vtSave=(key,value)=>store.set('q.'+key,JSON.stringify(value));

const vtPool=()=>{ const on=vtSettings().forms; return vtAll().filter(c=>on.includes(c.form)); };
function vtNewLeft(){
  const v=SRS.vnw, used=v&&v.d===today()?v.n:0;
  return Math.max(0,vtSettings().newPerDay-used);
}
function vtPlan(){
  const t=today(), pool=vtPool();
  const due=pool.filter(c=>{const x=st(c.key);return x.b>0&&x.due<=t})
                .sort((a,b)=>riskOf(b)-riskOf(a));
  return {due,fresh:pool.filter(c=>!(st(c.key).b>0)),newLeft:vtNewLeft()};
}
function vtBuildRound(){
  const p=vtPlan();
  return [...p.due,...p.fresh.slice(0,p.newLeft)].slice(0,vtSettings().size);
}

/* wrong = Indizes der falschen Items (bezogen auf card.items). Spiegelt grade() in app.js.
   Wiederholungen in der Runde (redo) planen die Karte neu, zählen aber nicht in Serie, Tageslimit und Fehlerzahl. */
function vtGrade(card,wrong,redo){
  const G=vtGradeOf(wrong.length,card.items.length), t=today();
  if(SRS.snapDay!==t){ if(Object.keys(SRS.c).length) snapshot('Tagesbeginn'); SRS.snapDay=t; }
  const old=st(card.key), wasNew=!(old.b>0), x=reviewState(old,G,t,card.key);
  if(G===1 && !redo) x.l=(x.l||0)+1;
  x.u=Date.now(); SRS.c[card.key]=x;
  if(!redo){
    SRS.hist[t]=(SRS.hist[t]||0)+1;
    { const sk=streak(); if(sk>(SRS.best||0)) SRS.best=sk; }
    Object.keys(SRS.hist).forEach(k=>{ if(+k<t-365){ delete SRS.hist[k]; delete SRS.ok[k]; } });   // ein Jahr Verlauf, wie grade()
    if(wasNew){ if(!SRS.vnw||SRS.vnw.d!==t) SRS.vnw={d:t,n:0}; SRS.vnw.n++; }
    if(SYNC&&SYNC.gist&&!SYNC.pending){ SYNC.pending=true; store.set('q.sync',JSON.stringify(SYNC)); }
  }
  saveQ();
  return {G,days:G===1?0:x.due-t};
}

/* ===================== Verbtrainer: Oberfläche ===================== */
const vtEl=()=>document.getElementById('vtrain');
const vtEsc=s=>s.replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
let VTR=null;                                            // laufende Runde: {queue:[{card,redo}], total, first}
let VTCHK=0;                                             // Zeitpunkt der letzten Prüfung (Schutz gegen Doppeltippen)
let VTLAST=null;                                         // zuletzt fokussiertes Eingabefeld (für die Sonderzeichenleiste)

function vtEnter(){ VTR=null; vtHome(); }
function vtRefresh(){ if(tab==='vt' && !VTR) vtHome(); }

function vtHome(){
  const s=vtSettings(), p=vtPlan(), n=vtBuildRound().length, pool=vtPool();
  const open=!!vtEl().querySelector('details.settings[open]');   // die Einstellungen bleiben beim Umschalten offen
  const hint = !s.forms.length ? 'Keine Form eingeschaltet. Schalte unter Einstellungen mindestens eine ein.'
             : !n ? 'Heute fertig. Morgen gibt es wieder Fälliges und neue Karten.' : '';
  const begun=pool.filter(c=>st(c.key).b>0).length;
  vtEl().innerHTML=
    '<div class="vtbox"><div class="hero">'+
    '<div class="kpis"><div class="kpi due"><b id="vtdue">'+p.due.length+'</b><span>fällig</span></div>'+
    '<div class="kpi"><b id="vtnewn">'+Math.min(p.fresh.length,p.newLeft)+'</b><span>neu für heute</span></div>'+
    '<div class="kpi"><b>'+begun+'</b><span>von '+pool.length+' begonnen</span></div></div>'+
    '<p class="shint" id="vthint"'+(hint?'':' hidden')+'>'+hint+'</p>'+
    '<button class="today" id="vtstart"'+(n?'':' disabled')+'>'+(n?'<b>Tagesrunde · Verben</b><span>'+n+' Karten</span>':'<b>Für heute erledigt ✓</b><span>Verben sind für heute durch</span>')+'</button>'+
    stageBar(pool)+
    '<div class="legend2"><span><i style="background:var(--rule)"></i>Neu</span><span><i style="background:var(--saf)"></i>Lernphase</span><span><i style="background:var(--pri)"></i>Gefestigt</span><span><i style="background:var(--ok)"></i>Sicher</span></div></div>'+
    '<details class="settings"'+(open?' open':'')+'><summary><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>Einstellungen</summary>'+
    '<div class="vtsethead">Formen</div>'+
    VT_FORMS.map(f=>'<label class="toggle"><span>'+f.label+'</span><input type="checkbox" data-form="'+f.id+'"'+(s.forms.includes(f.id)?' checked':'')+'></label>').join('')+
    '<div class="vtsethead">Runde</div>'+
    '<label class="toggle"><span>Karten pro Runde</span><input type="number" id="vtsize" min="1" max="30" value="'+s.size+'"></label>'+
    '<label class="toggle"><span>Neue Karten pro Tag</span><input type="number" id="vtnew" min="0" max="20" value="'+s.newPerDay+'"></label>'+
    '<label class="toggle"><span>Akzente müssen stimmen</span><input type="checkbox" id="vtacc"'+(s.strict?' checked':'')+'></label>'+
    '</details></div>';
}

function vtStart(){
  const cards=vtBuildRound(); if(!cards.length) return;
  VTR={queue:cards.map(c=>({card:c,redo:0})),total:cards.length,first:0};
  vtShow();
}
function vtShow(){
  const e=VTR.queue[0];
  if(!e){ vtFinish(); return; }
  const c=e.card, done=VTR.total-VTR.queue.filter(x=>!x.redo).length;
  vtEl().innerHTML=
    '<div class="vtbox"><div class="vttop"><button class="back" id="vtleave">‹ Zurück</button><span class="vtcount">'+Math.min(done+1,VTR.total)+' / '+VTR.total+'</span></div>'+
    '<div class="qcard vtcard"><div class="chips"><span class="qchip vtform">'+VT_FORMS.find(f=>f.id===c.form).label+'</span>'+
    '<span class="qchip stagechip">'+ruedaSvg((SRS.c[c.key]||{}).b||0,MAX)+((SRS.c[c.key]||{}).b?'Stufe '+SRS.c[c.key].b:'Neu')+'</span>'+
    (e.redo?'<span class="qchip redo">Wiederholung</span>':'')+'</div>'+
    '<div class="vtverb">'+vtEsc(c.verb)+'</div><div class="vtsub">'+vtEsc(c.sub)+'</div>'+
    '<div class="vtkeys" id="vtkeys">'+['á','é','í','ó','ú','ñ','ü'].map(ch=>'<button type="button" data-ch="'+ch+'">'+ch+'</button>').join('')+'</div>'+
    c.items.map((it,i)=>'<div class="vtrow"><label>'+vtEsc(it.label)+'</label><input type="text" data-i="'+i+'" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>').join('')+
    '<div class="vtres" id="vtres"></div></div>'+
    '<div class="vtbtns" id="vtbtns"><button class="act" id="vtgiveup">Weiß ich nicht</button><button class="act pri" id="vtcheck">Prüfen</button></div></div>';
  const first=vtEl().querySelector('.vtrow input'); if(first) first.focus();
}

function vtCheckNow(giveUp){
  const e=VTR.queue[0], c=e.card, s=vtSettings(), rows=[...vtEl().querySelectorAll('.vtrow')];
  const res=c.items.map((it,i)=>giveUp?'wrong':vtCheck(rows[i].querySelector('input').value,it.answers,s.strict,c.form==='impv'));
  const wrong=res.map((r,i)=>r==='ok'?-1:i).filter(i=>i>=0);
  const g=vtGrade(c,wrong,!!e.redo);                     // bewertet und speichert sofort
  VTCHK=Date.now();
  VTR.queue.shift();
  if(g.G===1 && e.redo<REDO_MAX) VTR.queue.push({card:{...c,items:c.items.filter((_,i)=>wrong.includes(i))},redo:e.redo+1});
  if(!e.redo && g.G>1) VTR.first++;
  rows.forEach((row,i)=>{
    const it=c.items[i]; row.querySelector('input').disabled=true;
    row.classList.add(res[i]==='ok'?'ok':'bad');
    if(res[i]!=='ok'){
      const sol=it.answers.map(vtEsc).join(' / ');
      row.insertAdjacentHTML('beforeend','<div class="vtsol">'+(it.irregular?'<b>'+sol+'</b>':sol)+
        (res[i]==='accent'?' <span class="vtacc">nur der Akzent stimmt nicht</span>':'')+'</div>');
    }
  });
  document.getElementById('vtkeys').style.display='none';
  const nOk=c.items.length-wrong.length;                  // Rad nur ab 3 Formen: bei Gerundio/Partizip wäre es ein einzelnes Blatt
  document.getElementById('vtres').innerHTML=(c.items.length>=3?ruedaSvg(c.items.length,c.items.length,{cls:'big spin',label:nOk+' von '+c.items.length+' richtig',classes:res.map(r=>r==='ok'?'ok':'bad')}):'')+
    '<div class="vtnext">Nächster Termin: '+(g.G===1?'heute noch einmal':fmtIvl(g.days))+'</div>';
  document.getElementById('vtbtns').innerHTML='<button class="act pri" id="vtnext">Weiter</button>';
  document.getElementById('vtnext').focus();
}
function vtFinish(){
  vtEl().innerHTML='<div class="vtbox"><div class="vtdone"><b>Runde fertig</b><p>'+VTR.total+' Karten, davon '+VTR.first+' beim ersten Versuch gewusst.</p></div>'+
    '<button class="act pri" id="vtback">Zurück</button></div>';
  VTR=null; scheduleSync();                              // wie finish() bei den Vokabeln: Stand bald hochladen
}

/* Ereignisse einmal am Container (der Inhalt wird bei jedem Bildschirm ersetzt) */
(function(){
  const el=vtEl(); if(!el) return;
  el.addEventListener('click',ev=>{
    const b=ev.target.closest('button'); if(!b) return;
    if(b.id==='vtstart') vtStart();
    else if(b.id==='vtcheck') vtCheckNow(false);
    else if(b.id==='vtgiveup') vtCheckNow(true);
    else if(b.id==='vtnext'){ if(Date.now()-VTCHK>=400) vtShow(); }     // ein zweiter Tipp auf „Prüfen“ landet sonst auf „Weiter“
    else if(b.id==='vtback') vtHome();
    else if(b.id==='vtleave'){ VTR=null; vtHome(); }
    else if(b.dataset.ch){
      const i=VTLAST&&el.contains(VTLAST)?VTLAST:el.querySelector('.vtrow input:not([disabled])');
      if(i){ i.setRangeText(b.dataset.ch,i.selectionStart??i.value.length,i.selectionEnd??i.value.length,'end'); i.focus(); }
    }
  });
  el.addEventListener('mousedown',ev=>{ if(ev.target.closest('#vtkeys button')) ev.preventDefault(); });   // Fokus im Feld behalten
  el.addEventListener('focusin',ev=>{ if(ev.target.matches('.vtrow input')) VTLAST=ev.target; });
  el.addEventListener('keydown',ev=>{
    if(ev.key!=='Enter' || ev.repeat || !ev.target.matches('.vtrow input:not([disabled])')) return;      // gehaltene Taste darf nichts abschicken
    const all=[...el.querySelectorAll('.vtrow input')], i=all.indexOf(ev.target);
    if(i<all.length-1) all[i+1].focus(); else vtCheckNow(false);
    ev.preventDefault();
  });
  el.addEventListener('change',ev=>{
    const x=ev.target;
    if(x.dataset.form){ vtSave('vbforms',[...el.querySelectorAll('input[data-form]:checked')].map(i=>i.dataset.form)); vtHome(); }
    else if(x.id==='vtsize'){ vtSave('vbsize',+x.value); vtHome(); }
    else if(x.id==='vtnew'){ vtSave('vbnew',+x.value); vtHome(); }
    else if(x.id==='vtacc'){ vtSave('vbacc',x.checked); }
  });
})();
