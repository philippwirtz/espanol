/* FSRS-Optimierer im Hintergrund (Modul-Worker). Eingabe {r,t,l,c} wie computeParameters, Ausgabe {w} oder {err}. */
import init,{Fsrs} from './fsrs/fsrs_browser.js';
let ready=null;
self.onmessage=async e=>{
  try{
    ready=ready||init(); await ready;
    const D=e.data;
    const w=new Fsrs().computeParameters(Uint32Array.from(D.r),Uint32Array.from(D.t),Uint32Array.from(D.l),
      null,true,BigInt64Array.from(D.c,BigInt));
    postMessage({w:Array.from(w)});
  }catch(x){ postMessage({err:String(x&&x.message||x)}); }
};
