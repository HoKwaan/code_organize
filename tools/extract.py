"""Extract every code block from the AI_CAMPUS lecture pages, src/ files, MCU PDFs into snippets JSON."""
import html, json, re, sys, os

SP = os.path.dirname(os.path.abspath(__file__))
AIC = os.path.join(SP, 'aic')

LECTURES = [
    ('mcu', d, f'MCU-day{d}/MCU_Day{d}_lecture.html') for d in range(1, 5)
] + [
    ('linux', d, f'Linux-day{d}/lecture.html') for d in range(1, 6)
] + [
    ('eio', d, f'EmbeddedIO-day{d}/lecture.html') for d in range(1, 6)
]
SRC_DIRS = [('linux', 1, os.path.join(SP, 'ld1/linux-day1/src'))] + \
    [('linux', d, os.path.join(AIC, f'Linux-day{d}/src')) for d in range(2, 6)] + \
    [('eio', d, os.path.join(AIC, f'EmbeddedIO-day{d}/src')) for d in range(1, 6)]

BLANK = '\x01'          # internal placeholder; shown as ____ on the site
SHOW_BLANK = '____'


def text_of(frag):
    frag = re.sub(r'<input[^>]*class="blank[^"]*"[^>]*>', BLANK, frag)
    frag = re.sub(r'<select[^>]*class="blank[^"]*".*?</select>', BLANK, frag, flags=re.S)
    frag = re.sub(r'<br\s*/?>', '\n', frag)
    return html.unescape(re.sub(r'<[^>]+>', '', frag))


def clean_inline(frag):
    return re.sub(r'\s+', ' ', text_of(frag)).strip()


def guess_lang(cls, code, subject):
    lang = (cls or '').replace('language-', '')
    if lang in ('', None):
        if subject == 'mcu':
            return 'cpp'
        return 'c' if re.search(r'#include|;\s*$', code, re.M) else 'bash'
    return {'make': 'makefile', 'powershell': 'powershell'}.get(lang, lang)


def norm_ws(s):
    return re.sub(r'\s+', ' ', s).strip()


def split_comment(line):
    """(code part, comment part) — keeps the line whole if it is only a comment."""
    if line.lstrip().startswith(('//', '#', '/*')):
        return line, ''
    m = re.search(r'\s*(//|/\*|\s#\s).*$', line)
    return (line[:m.start()], line[m.start():]) if m else (line, '')


def blank_rx(text):
    out = []
    for p in text.split(BLANK):
        if p and not p.strip():
            out.append(r'\s+')
            continue
        out.append(r'\s*'.join(re.escape(w) for w in p.split()) if p.strip() else '')
    return out


def try_fill(text, ans):
    """Match question text (with blanks) against answer text. Returns filled text or None."""
    parts = blank_rx(text)
    a = norm_ws(ans)
    tail = a.startswith('...') or a.startswith('…')
    a = a.lstrip('.… ').strip() if tail else a
    head_len = len(norm_ws(text.split(BLANK)[0]))
    words = norm_ws(text.split(BLANK)[0])
    # allowed left cuts: none, or (for answers that only show the end of the line) at word boundaries
    cuts = [0] + [m.start() for m in re.finditer(r'(?<=\s)\S|(?<=[=(,])\S', words)]
    for cut in cuts:
        rest = words[cut:]
        if cut and not tail and len(rest.replace(' ', '')) < min(8, head_len):
            continue
        p0 = r'\s*'.join(re.escape(w) for w in rest.split()) if rest.strip() else ''
        rx = r'\s*' + '(.+?)'.join([p0] + parts[1:]) + r'\s*$'
        try:
            m = re.match(rx, a)
        except re.error:
            continue
        if m and all(g.strip() for g in m.groups()) and all(len(g) <= 50 and (';' not in g or tail) for g in m.groups()):
            it = iter(m.groups())
            return re.sub(BLANK, lambda _: next(it).strip(), text)
    return None


def context_fill(line, ans_lines):
    """Fallback: for each blank, find the answer line sharing the longest left/right context."""
    cur = line
    while BLANK in cur:
        i = cur.index(BLANK)
        L = norm_ws(cur[:i])[-40:]
        R = norm_ws(cur[i + 1:].split(BLANK)[0])[:40]
        best = None
        for a in ans_lines:
            a = norm_ws(a)
            for ll in range(len(L), 2, -1):
                j = a.find(L[-ll:])
                if j < 0:
                    continue
                start = j + ll
                rr = 0
                end = None
                for r in range(min(len(R), 40), 0, -1):
                    k = a.find(R[:r], start + 1)
                    if k >= 0:
                        rr, end = r, k
                        break
                if end is None and not R.strip():
                    end, rr = len(a), 0
                if end is None:
                    break
                fill = a[start:end].strip()
                if fill and len(fill) <= 60 and ll + rr >= 6 and (best is None or ll + rr > best[0]):
                    best = (ll + rr, fill)
                break
        if best is None:
            return None
        cur = cur[:i] + best[1] + cur[i + 1:]
    return cur


def fill_from_answer(q_code, ans_code):
    """Fill blanks in question lines using matching answer lines. Returns (filled_code, n_filled, n_blanks).
    Answers usually come in the same order as the blank lines, so the search starts after the last used answer."""
    ans_all = [l for l in ans_code.split('\n') if l.strip()]
    out, nf, nb = [], 0, 0
    ptr = 0
    for line in q_code.split('\n'):
        if BLANK not in line:
            out.append(line)
            continue
        nb += line.count(BLANK)
        body, comment = split_comment(line)
        order = list(range(ptr, len(ans_all))) + list(range(0, ptr))
        res, used = None, None
        for idx in order:                          # whole line, comments included
            res = try_fill(line, ans_all[idx])
            if res:
                used = idx
                break
        if res is None and BLANK in body and BLANK not in comment:
            for idx in order:                      # code part only
                r = try_fill(body, split_comment(ans_all[idx])[0])
                if r:
                    res, used = r + comment, idx
                    break
        if res is None:
            res = context_fill(line, [ans_all[i] for i in order])
        if res is None:
            out.append(line)
            continue
        if used is not None:
            ptr = used + 1
        nf += line.count(BLANK)
        out.append(res)
    return '\n'.join(out), nf, nb


def parse_lecture(subject, day, rel):
    s = open(os.path.join(AIC, rel), encoding='utf-8').read()
    s = re.sub(r'<style.*?</style>|<script.*?</script>', '', s, flags=re.S)
    doc_title = clean_inline(re.search(r'<title>(.*?)</title>', s, re.S).group(1))
    sections = re.split(r'(?=<section id=")', s)
    items = []
    for sec in sections:
        m = re.match(r'<section id="([^"]+)"', sec)
        if not m:
            continue
        sid = m.group(1)
        head = re.search(r'<header class="sec-head">(.*?)</header>', sec, re.S)
        if head:
            period = clean_inline((re.search(r'<span class="period">(.*?)</span>', head.group(1), re.S) or re.search(r'^(.*?)<h1', head.group(1), re.S)).group(1))
            ltitle = clean_inline(re.search(r'<h1>(.*?)</h1>', head.group(1), re.S).group(1))
        else:
            period, ltitle = '개요', '개요'
        n = re.search(r'(\d+)', period)
        pnum = int(n.group(1)) if n else 0
        # walk tokens in order
        tok_re = re.compile(
            r'<h3[^>]*>(?P<h3>.*?)</h3>'
            r'|<h4[^>]*id="(?P<h4id>[^"]*)"[^>]*>(?P<h4>.*?)</h4>'
            r'|<h4[^>]*>(?P<h4b>.*?)</h4>'
            r'|<details[^>]*>(?P<dopen>)'
            r'|</details>(?P<dclose>)'
            r'|<summary[^>]*>(?P<sum>.*?)</summary>'
            r'|<pre(?P<pattr>[^>]*)>(?P<pre>.*?)</pre>'
            r'|<li[^>]*>(?P<li>(?:(?!<pre|<li)[\s\S])*?)</li>'
            r'|<p(?:\s[^>]*)?>(?P<p>(?:(?!<pre|<div)[\s\S])*?)</p>'
            r'|<code[^>]*>(?P<code>.*?)</code>', re.S)
        heading, fill_id, in_details, last_p = ltitle, None, False, ''
        inline = []
        quiz = {}          # 괄호 넣기 id -> {'title', 'q': [...], 'a': [...]}
        blocks = []
        for t in tok_re.finditer(sec):
            g = t.groupdict()
            if g['h3'] is not None:
                heading = clean_inline(g['h3']).lstrip('▶ ').strip(); fill_id = None; last_p = ''
            elif g['h4'] is not None:
                heading = clean_inline(g['h4']).lstrip('✏️ ').strip(); fill_id = g['h4id']; last_p = ''
            elif g['h4b'] is not None:
                heading = clean_inline(g['h4b']).strip(); last_p = ''
            elif g['dopen'] is not None:
                in_details = True
            elif g['dclose'] is not None:
                in_details = False
            elif g['sum'] is not None:
                pass
            elif g['pre'] is not None:
                cls = re.search(r'class="([^"]*)"', g['pattr'])
                code = text_of(g['pre']).rstrip('\n')
                code = '\n'.join(l.rstrip() for l in code.split('\n'))
                blocks.append(dict(heading=heading, fill=fill_id, answer=in_details, cls=cls.group(1) if cls else '', code=code, desc=last_p))
            elif g['li'] is not None:
                for c in re.findall(r'<code[^>]*>(.*?)</code>', g['li'], re.S):
                    inline.append(clean_inline(c))
                if fill_id and fill_id.startswith('p'):
                    qz = quiz.setdefault(fill_id, dict(title=heading, q=[], a=[]))
                    (qz['a'] if in_details else qz['q']).append(clean_inline(g['li']))
            elif g['p'] is not None:
                txt = clean_inline(g['p'])
                # inline <code> inside paragraphs
                for c in re.findall(r'<code[^>]*>(.*?)</code>', g['p'], re.S):
                    inline.append(clean_inline(c))
                if txt:
                    last_p = txt
            elif g['code'] is not None:
                inline.append(clean_inline(g['code']))
        items.append(dict(sid=sid, period=period, pnum=pnum, ltitle=ltitle, blocks=blocks, inline=inline, quiz=quiz))
    return doc_title, items


def build():
    snippets = []
    stats = {}
    for subject, day, rel in LECTURES:
        doc_title, secs = parse_lecture(subject, day, rel)
        url = f'https://imguru-mooc.github.io/AI_CAMPUS/{rel}'
        cnt = 0
        for sec in secs:
            topic = f'Day {day} · {sec["period"]} {sec["ltitle"]}' if sec['pnum'] else f'Day {day} · 개요'
            blocks = sec['blocks']
            # pair fill questions with their answers
            i = 0
            k = 0
            while i < len(blocks):
                b = blocks[i]
                lang = guess_lang(b['cls'], b['code'], subject)
                k += 1
                sid = f'{subject}-d{day}-{sec["sid"]}-{k}'
                base = dict(id=sid, subject=subject, day=day, period=sec['pnum'], topic=topic,
                            source=f'{subject.upper() if subject!="eio" else "Embedded_IO"} Day {day} 강의 · {sec["period"]}',
                            url=f'{url}#{sec["sid"]}', lang=lang)
                if lang == 'text':
                    # expected output → attach to previous code snippet
                    prev = next((x for x in reversed(snippets) if x.get('_sec') == (subject, day, sec['sid'])), None)
                    if prev is not None and not b['answer']:
                        prev['output'] = (prev.get('output', '') + ('\n\n' if prev.get('output') else '') + b['code'])
                        cnt += 1
                        i += 1
                        continue
                if b['fill'] and not b['answer']:
                    # collect answers that follow in details with same fill id
                    ans = [x for x in blocks[i + 1:] if x['fill'] == b['fill'] and x['answer']]
                    ans_code = '\n'.join(x['code'] for x in ans)
                    filled, nf, nb = fill_from_answer(b['code'], ans_code) if BLANK in b['code'] else (b['code'], 0, 0)
                    snippets.append(dict(base, title=b['heading'], kind='fill', desc=b['desc'],
                                         blank=b['code'], answer=ans_code, code=filled if nb else b['code'],
                                         filled=f'{nf}/{nb}', _sec=(subject, day, sec['sid'])))
                    cnt += 1 + len(ans)
                    i += 1
                    continue
                if b['fill'] and b['answer']:
                    # answer already attached to its question; keep extra answer code (e.g. answer without question)
                    q = next((x for x in snippets if x.get('_sec') == (subject, day, sec['sid']) and x.get('kind') == 'fill' and x['title'] == b['heading']), None)
                    if q is not None:
                        i += 1
                        continue
                snippets.append(dict(base, title=b['heading'] + (' (정답)' if b['answer'] else ''), desc=b['desc'],
                                     code=b['code'], _sec=(subject, day, sec['sid'])))
                cnt += 1
                i += 1
            # inline code collection
            seen, inl = set(), []
            for c in sec['inline']:
                if len(c) < 2 or c in seen:
                    continue
                seen.add(c)
                inl.append(c)
            if inl:
                snippets.append(dict(id=f'{subject}-d{day}-{sec["sid"]}-inline', subject=subject, day=day, period=sec['pnum'],
                                     topic=topic, title='본문 속 코드 · 명령어', kind='inline',
                                     source=f'Day {day} 강의 · {sec["period"]} 본문', url=f'{url}#{sec["sid"]}',
                                     lang='text', code='\n'.join(inl), _sec=(subject, day, sec['sid'])))
            for qid, qz in sec['quiz'].items():
                lines = []
                for n, q in enumerate(qz['q']):
                    a = qz['a'][n] if n < len(qz['a']) else ''
                    vals = [v.strip() for v in re.split(r'\s+/\s+', a)] if a else []
                    if q.count(BLANK) and len(vals) == q.count(BLANK):
                        it = iter(vals)
                        filled = re.sub(BLANK, lambda _: '[' + next(it) + ']', q)
                    else:
                        filled = q + (f'   → 정답: {a}' if a else '')
                    lines.append(f'{n + 1}. {filled}')
                snippets.append(dict(id=f'{subject}-d{day}-{sec["sid"]}-{qid}', subject=subject, day=day, period=sec['pnum'],
                                     topic=topic, title=qz['title'], kind='quiz', lang='text',
                                     source=f'Day {day} 강의 · {sec["period"]} 괄호 넣기', url=f'{url}#{qid}',
                                     blank='\n'.join(f'{n + 1}. {q}' for n, q in enumerate(qz['q'])),
                                     answer='\n'.join(f'{n + 1}. {a}' for n, a in enumerate(qz['a'])),
                                     code='\n'.join(lines)))
        stats[rel] = cnt
    # src files
    for subject, day, d in SRC_DIRS:
        if not os.path.isdir(d):
            continue
        for root, _, files in os.walk(d):
            for f in sorted(files):
                p = os.path.join(root, f)
                relp = os.path.relpath(p, d)
                if f.endswith(('.csv', '.txt', '.o')):
                    continue
                code = open(p, encoding='utf-8', errors='replace').read().replace('\r', '').rstrip('\n')
                ext = f.rsplit('.', 1)[-1] if '.' in f else f
                lang = {'c': 'c', 'h': 'c', 'sh': 'bash', 'ino': 'cpp', 'dts': 'c', 'service': 'ini'}.get(ext, 'makefile' if f == 'Makefile' else 'text')
                snippets.append(dict(id=f'{subject}-d{day}-src-{relp.replace("/", "-")}', subject=subject, day=day, period=99,
                                     topic=f'Day {day} · 소스 파일 (src/)', title=f'src/{relp}', kind='src', lang=lang,
                                     source=f'AI_CAMPUS {("Linux" if subject=="linux" else "EmbeddedIO")}-day{day}/src/{relp}', code=code))
    for s in snippets:
        s.pop('_sec', None)
        for k in ('code', 'blank', 'answer', 'output'):
            if k in s:
                s[k] = s[k].replace(BLANK, SHOW_BLANK)
    return snippets, stats


if __name__ == '__main__':
    sn, stats = build()
    json.dump(sn, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
    for k, v in stats.items():
        print(k, v)
    print('snippets', len(sn))
