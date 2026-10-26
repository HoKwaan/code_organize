import json,re,sys,importlib.util
sn=json.load(open('sn.json'))
blob='\n'.join('\n'.join([x.get('code',''),x.get('blank',''),x.get('answer',''),x.get('output','')]) for x in sn)
spec=importlib.util.spec_from_file_location('ex','extract.py'); ex=importlib.util.module_from_spec(spec); spec.loader.exec_module(ex)
tot=miss=0
for subj,d,rel in ex.LECTURES:
    s=open('aic/'+rel,encoding='utf-8').read()
    for p in re.findall(r'<pre[^>]*>(.*?)</pre>',s,re.S):
        t=ex.text_of(p).replace('\x01','____').rstrip('\n'); t='\n'.join(l.rstrip() for l in t.split('\n')); tot+=1
        if t not in blob: miss+=1; print('MISS',rel,repr(t[:100]))
    # inline codes
    for c in re.findall(r'<code[^>]*>(.*?)</code>',re.sub(r'<pre.*?</pre>','',s,flags=re.S),re.S):
        c=ex.clean_inline(c)
        if len(c)>=2 and c not in blob: print('MISS inline',rel,c)
print('pre total',tot,'missing',miss)
