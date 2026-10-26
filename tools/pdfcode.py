import pdfplumber,sys,json,re
def is_mono(f): return 'Mono' in f
def page_blocks(p):
    chars=[c for c in p.chars if is_mono(c['fontname']) and c['text'].strip()!='' or (is_mono(c['fontname']) and c['text']==' ')]
    chars=[c for c in p.chars if is_mono(c['fontname'])]
    if not chars: return []
    # group by line (top)
    chars.sort(key=lambda c:(round(c['top']),c['x0']))
    lines=[]
    for c in chars:
        if lines and abs(lines[-1]['top']-c['top'])<3: lines[-1]['chars'].append(c)
        else: lines.append({'top':c['top'],'chars':[c]})
    segs=[]
    for L in lines:
        cs=sorted(L['chars'],key=lambda c:c['x0'])
        cur=[cs[0]]
        for c in cs[1:]:
            w=cur[-1]['x1']-cur[-1]['x0'] or 5
            if c['x0']-cur[-1]['x1']>max(25,4*w): segs.append(cur); cur=[c]
            else: cur.append(c)
        segs.append(cur)
    # build text per seg with spacing
    out=[]
    for s in segs:
        cw=min((c['x1']-c['x0']) for c in s if c['text'].isascii()) if any(c['text'].isascii() for c in s) else s[0]['size']*0.6
        cw=max(cw, s[0]['size']*0.55)
        txt=''; x=s[0]['x0']
        for c in s:
            gap=c['x0']-x
            if gap>cw*0.5: txt+=' '*max(1,round(gap/cw))
            txt+=c['text']; x=c['x1']
        out.append({'x0':s[0]['x0'],'top':s[0]['top'],'bot':s[0]['bottom'],'size':s[0]['size'],'cw':cw,'text':txt.rstrip()})
    # group segs into blocks: same column (x0 within block range), vertically consecutive
    out.sort(key=lambda o:(o['x0']//1,o['top']))
    blocks=[]
    for o in sorted(out,key=lambda o:o['top']):
        placed=False
        for b in blocks:
            last=b[-1]
            minx=min(e['x0'] for e in b)
            if o['x0']>=minx-3 and o['x0']<minx+260 and 0<o['top']-last['top']<last['size']*2.6:
                # also must not be claimed by a block whose minx is closer
                b.append(o); placed=True; break
        if not placed: blocks.append([o])
    res=[]
    for b in blocks:
        minx=min(e['x0'] for e in b); cw=b[0]['cw']
        lines=[' '*round((e['x0']-minx)/cw)+e['text'] for e in b]
        res.append({'top':b[0]['top'],'x0':minx,'lines':lines})
    res.sort(key=lambda r:(r['x0']>p.width/2, r['top']))
    return res
pdf=pdfplumber.open(sys.argv[1])
allb=[]
for pi,p in enumerate(pdf.pages):
    t=(p.extract_text() or '').split('\n')
    title=t[0] if t else ''
    for b in page_blocks(p):
        allb.append({'page':pi+1,'title':title,'lines':b['lines']})
json.dump(allb,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
print(len(allb))
