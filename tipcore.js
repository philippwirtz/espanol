/* ===================== Tippkarten: reine Logik ===================== */
/* Prüft ein getipptes Vokabelwort und sagt, ob die Karte überhaupt tippbar ist.
   Nutzt vtNorm aus verbcore.js (erst zur Laufzeit aufgerufen, Ladereihenfolge egal). */
const TIP_ART=/^(el|la|los|las|un|una) /;
const tipPlain=s=>s.replace(/[¿¡?!]/g,'').replace(/^[\s.]+|[\s.]+$/g,'');

/* Alternativen („el hijo / la hija“), Aufzählungen und Auslassungen lassen sich nicht eindeutig tippen;
   ganze Sätze (Aufbau-Kapitel haben Beispielsätze als Wortkarten) auch nicht: Satzzeichen am Ende und mehr als zwei Wörter */
const tipEligible=es=>!/[\/,…]/.test(es) && !(/[.!?]$/.test(es) && es.split(/\s+/).length>2);

function tipOneEdit(a,b){                       // Abstand genau 1 (Ersetzen, Einfügen oder Löschen)
  if(Math.abs(a.length-b.length)>1) return false;
  let i=0; while(i<a.length && i<b.length && a[i]===b[i]) i++;
  if(a.length===b.length) return i<a.length && a.slice(i+1)===b.slice(i+1);
  const [s,l]=a.length<b.length?[a,b]:[b,a];
  return s.slice(i)===l.slice(i+1);
}

/* Synonyme (SYN in content.js) zu einem Kartenwort, ohne Artikel und Akzente.
   form = Form im Satz: hängt dort eine Endung am Kartenwort (cerveza → cervezas), bekommen die Synonyme sie auch (birras). */
const tipBase=w=>vtNorm(tipPlain(w),false).replace(TIP_ART,'');
function tipAlts(word,form){
  const G=typeof SYN==='object'?SYN:[], b=tipBase(word);
  const g=G.find(g=>g.some(w=>tipBase(w)===b)); if(!g) return [];
  const f=tipBase(form||word), suf=f.startsWith(b)?f.slice(b.length):'';
  return g.filter(w=>tipBase(w)!==b).map(w=>tipBase(w)+suf);
}

/* ok = richtig · alt = Synonym aus SYN (zählt als richtig) · near = Akzent (bei strengem Schalter), Artikel oder ein Buchstabe daneben · wrong = sonst */
function tipCheck(input,answer,strict,alts){
  const i=vtNorm(tipPlain(input),true), a=vtNorm(tipPlain(answer),true);
  if(!i) return 'wrong';
  if(i===a) return 'ok';
  const fi=vtNorm(i,false), fa=vtNorm(a,false);
  if(fi===fa) return strict?'near':'ok';
  if(alts && alts.includes(fi.replace(TIP_ART,''))) return 'alt';
  if(TIP_ART.test(fa) && fi===fa.replace(TIP_ART,'')) return 'near';
  if(fa.length>=4 && tipOneEdit(fi,fa)) return 'near';
  return 'wrong';
}
