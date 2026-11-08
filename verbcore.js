/* ===================== Verbtrainer: reine Logik ===================== */
/* Liest die Formen aus VERBS (content.js), prüft Antworten und berechnet die Bewertungsstufe.
   Keine Abhängigkeit zu app.js, damit die Funktionen einzeln testbar sind. */
const VT_FORMS=[
  {id:'pres',label:'Präsens'},{id:'ind',label:'Indefinido'},{id:'imp',label:'Imperfecto'},
  {id:'fut',label:'Futur'},{id:'kond',label:'Konditional'},{id:'subj',label:'Subjuntivo'},
  {id:'impv',label:'Imperativ'},{id:'ger',label:'Gerundio'},{id:'part',label:'Partizip'}];
const VT_PRON=['yo','tú','él/ella/Ud.','nosotros','vosotros','ellos/ellas/Uds.'];
const VT_THIRD_ONLY=['gustar','costar','doler'];          // nur 3. Person gebräuchlich: él/Ud. und ellos
const VT_HEAD={'Präsens':'pres','Indefinido':'ind','Imperfecto':'imp','Futur':'fut','Konditional':'kond','Subjuntivo':'subj'};
const VT_SINGLE={'Gerundium':'ger','Partizip':'part'};

const vtText=h=>h.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
const vtCells=rest=>[...rest.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);

function vtCards(verbs=VERBS){
  const byForm={};                                        // Form → Karten in VERBS-Reihenfolge
  VT_FORMS.forEach(f=>byForm[f.id]=[]);
  verbs.forEach(v=>{
    const forms={};                                       // Form → Items dieses Verbs
    for(const tb of v.h.match(/<table[\s\S]*?<\/table>/g)||[]){
      const head=[...tb.match(/<tr>(<th[\s\S]*?)<\/tr>/)?.[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)||[]].map(m=>vtText(m[1]));
      let pos=0;
      for(const r of tb.matchAll(/<tr><td class="de">([^<]*)<\/td>([\s\S]*?)<\/tr>/g)){
        const label=r[1].trim(), cells=vtCells(r[2]);
        if(cells.length===3){                             // Personenzeile
          const p=pos++;
          if(VT_THIRD_ONLY.includes(v.t) && p!==2 && p!==5) continue;
          cells.forEach((c,i)=>{
            const f=VT_HEAD[head[i+1]]; if(!f) return;
            (forms[f]=forms[f]||[]).push({label:VT_PRON[p],answers:vtText(c).split(/\s*\/\s*/),irregular:/<b>/.test(c)});
          });
        } else if(VT_SINGLE[label]){
          forms[VT_SINGLE[label]]=[{label:label==='Gerundium'?'Gerundio':label,answers:[vtText(cells[0])],irregular:/<b>/.test(cells[0])}];
        } else if(label==='Imperativ'){
          forms.impv=vtText(cells[0]).split(' · ').map(p=>{
            const m=p.match(/^¡(.+?)!\s*(usted|ustedes|tú)$/); return {label:m[2],answers:[m[1].trim()],irregular:false}; });
        }
      }
    }
    VT_FORMS.forEach(f=>{ if(forms[f.id]) byForm[f.id].push({key:'vb:'+v.t+':'+f.id,verb:v.t,sub:v.sub,group:v.g,form:f.id,items:forms[f.id]}); });
  });
  return VT_FORMS.flatMap(f=>byForm[f.id]);
}

/* strict = Akzente zählen; sonst werden á é í ó ú ü wie a e i o u u behandelt (ñ bleibt eigener Buchstabe) */
function vtNorm(s,strict){
  s=s.trim().toLowerCase().replace(/\s+/g,' ').normalize('NFC');
  return strict ? s : s.normalize('NFD').replace(/[́̈]/g,'').normalize('NFC');
}
function vtCheck(input,answers,strict,impv){
  if(impv) input=input.replace(/^[\s¡]+|[\s!]+$/g,'');
  if(!vtNorm(input,true)) return 'wrong';
  if(answers.some(a=>vtNorm(a,true)===vtNorm(input,true))) return 'ok';
  if(answers.some(a=>vtNorm(a,false)===vtNorm(input,false))) return strict?'accent':'ok';
  return 'wrong';
}
/* Fehler beim ersten Versuch → FSRS-Bewertung: 3 Saß · 2 Knapp (bis ein Drittel falsch) · 1 Nochmal */
function vtGradeOf(errors,n){
  return errors===0 ? 3 : errors<=Math.floor(n/3) ? 2 : 1;
}
