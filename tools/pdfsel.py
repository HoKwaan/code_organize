import json,re
sn=json.load(open('sn.json'))
def norm(l): return re.sub(r'\s+','',re.sub(r'//.*|/\*.*?\*/','',l))
have=set()
for x in sn:
    if x['subject']!='mcu': continue
    for k in ('code','answer','blank','output'):
        for l in x.get(k,'').split('\n'):
            n=norm(l)
            if n: have.add(n)
codey=re.compile(r'[;{}]|#include|#define|\w+\(.*\)')
out=[]
stats={}
for d in (1,2,3,4):
    blocks=json.load(open(f'pdf/b{d}.json'))
    keep=0
    for b in blocks:
        lines=[l for l in b['lines'] if l.strip()]
        code_lines=[l for l in lines if codey.search(l)]
        if len(code_lines)<2: continue
        new=[l for l in lines if norm(l) and norm(l) not in have]
        newcode=[l for l in new if codey.search(l)]
        stats.setdefault(d,[0,0,0]); stats[d][0]+=1
        if not newcode: stats[d][1]+=1; continue
        stats[d][2]+=1
        out.append(dict(day=d,page=b['page'],title=b['title'],code='\n'.join(b['lines']).strip('\n'),new=newcode))
json.dump(out,open('pdf/new.json','w'),ensure_ascii=False,indent=1)
print(stats)
for o in out: print('== d%d p%d %s'%(o['day'],o['page'],o['title'][:50])); print('\n'.join('   + '+l for l in o['new']))
