import json,re,os
sn=json.load(open('sn.json'))
pdf=json.load(open('pdf/new.json'))
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
U=os.path.join(ROOT,'materials','exams')+'/'
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from extract import guess_lang
PDF_URL={'mcu':'MCU-day{d}','linux':'Linux-day{d}','eio':'EmbeddedIO-day{d}'}
cnt={}
for o in pdf:
    t=re.sub(r'\s*\d+\s*교시\s*$','',o['title']).strip()
    m=re.search(r'(\d+)\s*교시\s*$',o['title']) or re.match(r'\s*(\d+)\s*교시',o['title'])
    k=(o['subject'],o['day'],o['page']); cnt[k]=cnt.get(k,0)+1
    lang='cpp' if o['subject']=='mcu' else guess_lang('',o['code'],o['subject'])
    sn.append(dict(id=f"{o['subject']}-d{o['day']}-pdf-p{o['page']}-{cnt[k]}",subject=o['subject'],day=o['day'],period=int(m.group(1)) if m else 0,
        topic=None,title=f"슬라이드 p.{o['page']} · {t}",kind='pdf',lang=lang,source=f"{o['pdf']} p.{o['page']}",
        url=f"https://github.com/imguru-mooc/AI_CAMPUS/blob/main/{PDF_URL[o['subject']].format(d=o['day'])}/{o['pdf']}",code=o['code']))
# topics: reuse lecture topic names by (subject,day,period)
names={}
for x in sn:
    if x.get('topic') and x['period'] and x['period']<99 and '-md-' not in x['id']: names.setdefault((x['subject'],x['day'],x['period']),x['topic'])
for x in sn:
    if not x.get('topic') or '-md-' in x['id']: x['topic']=names.get((x['subject'],x['day'],x['period']),x.get('topic') or f"Day {x['day']} · 슬라이드")
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from supplement import SUPP; import refs
sn.extend(refs.build(sn, SUPP))   # 강의 코드에 있는 API 는 강의 줄로, 없는 것만 보충으로
idx={x['id']:i for i,x in enumerate(sn)}
sn.sort(key=lambda x:(['mcu','linux','eio'].index(x['subject']),x['day'],x['period'] if x['period'] else 0,x.get('kind')=='inline',x.get('kind')=='pdf',idx[x['id']]))
keep=['id','subject','day','period','topic','title','kind','lang','source','url','desc','code','blank','answer','output','refs']
sn=[{k:x[k] for k in keep if x.get(k) or (k in ('day','period') and x.get(k)==0)} for x in sn]
ids=[x['id'] for x in sn]; assert len(ids)==len(set(ids)), 'dup ids'
def rd(n): return open(U+n,encoding='utf-8').read().replace('\r','').rstrip('\n')
exams=[
 dict(id='mcu-eval',subject='mcu',title='MCU 2차 평가(C형) 양식',source='mcu_eval_template.ino',lang='cpp',code=rd('mcu_eval_template.ino')),
 dict(id='linux-eval',subject='linux',title='Linux 2차 평가(C형) 양식',source='linux_eval_template.c',lang='c',code=rd('linux_eval_template.c')),
 dict(id='eio-eval',subject='eio',title='Embedded_IO 2차 평가(C형) 양식',source='eio_eval_template.c',lang='c',code=rd('eio_eval_template.c')),
]
data=dict(built=__import__('datetime').date.today().isoformat(),
 subjects=[dict(id='mcu',name='MCU',full='MCU (Arduino · ESP32)',lang='cpp',days=4),
           dict(id='linux',name='Linux',full='Linux (shell · C)',lang='c',days=5),
           dict(id='eio',name='Embedded_IO',full='Embedded_IO (C)',lang='c',days=5)],
 snippets=sn, exams=exams)
hdr='''// 코드 정리 데이터 — tools/build.sh 로 생성한다. 직접 고치지 말고 스크립트를 다시 돌린다.
// 출처: imguru-mooc/AI_CAMPUS 강의 페이지(MCU 1~4, Linux 1~5, EmbeddedIO 1~5)와 src/ 소스, MCU_Day1~4.pdf, 평가 양식 3개
'''
out=hdr+'window.CODE_INDEX = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'
open(os.path.join(ROOT,'data','index.js'),'w').write(out)
import collections
print(len(out)//1024,'KB', len(sn), collections.Counter(x['subject'] for x in sn), collections.Counter(x.get('kind','code') for x in sn))
