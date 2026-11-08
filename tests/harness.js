/* Mini-Testrahmen: t(name, bedingung); done() schreibt das Ergebnis nach body[data-result] */
const _res={ok:0,all:0,fail:[]};
function t(name,cond){ _res.all++; if(cond) _res.ok++; else _res.fail.push(name); }
function done(){
  document.body.dataset.result = _res.fail.length ? 'FAIL: '+_res.fail.join(' | ') : 'PASS '+_res.ok+'/'+_res.all;
}
window.onerror=(m,src,line)=>{ _res.all++; _res.fail.push('Skriptfehler: '+m+' (Zeile '+line+')'); done(); };
window.addEventListener('unhandledrejection',e=>{ _res.all++; _res.fail.push('Promise-Fehler: '+(e.reason&&e.reason.message||e.reason)); done(); });
