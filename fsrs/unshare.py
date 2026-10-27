"""Macht den importierten Speicher eines WASM-Moduls nicht-geteilt (Flag 0x03 -> 0x01).
Dann braucht es kein SharedArrayBuffer / keine Cross-Origin-Isolation (Safari)."""
import sys
src,dst=sys.argv[1],sys.argv[2]
b=bytearray(open(src,'rb').read())
def leb(p):
    r=s=0
    while True:
        x=b[p]; p+=1; r|=(x&0x7f)<<s; s+=7
        if x<0x80: return r,p
p=8; done=False
while p<len(b):
    sid=b[p]; size,q=leb(p+1); end=q+size
    if sid==2:
        n,q=leb(q)
        for _ in range(n):
            l,q=leb(q); mod=bytes(b[q:q+l]); q+=l
            l,q=leb(q); name=bytes(b[q:q+l]); q+=l
            kind=b[q]; q+=1
            if kind==0: _,q=leb(q)
            elif kind==1: q+=1; fl=b[q]; q+=1; _,q=leb(q); q= leb(q)[1] if fl&1 else q
            elif kind==2:
                fl=b[q]
                print('memory import',mod,name,'flag',hex(fl))
                assert fl in (1,3)
                b[q]=fl&~2; done=True
                q+=1; _,q=leb(q); q= leb(q)[1] if fl&1 else q
            elif kind==3: q+=2
            else: raise SystemExit('unknown import kind %d'%kind)
    p=end
assert done
open(dst,'wb').write(b); print('ok ->',dst)
