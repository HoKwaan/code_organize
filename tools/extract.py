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
            r'<table[^>]*>(?P<table>.*?)</table>'
            r'|<svg[^>]*>(?P<svg>.*?)</svg>'
            r'|<h3[^>]*>(?P<h3>.*?)</h3>'
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
        tables = []        # [{'heading', 'desc', 'rows': [[셀, ...], ...]}]
        prose = []         # 본문 · 그림 글자 (코드 태그 밖) — 함수 이름 같은 코드 조각을 찾는다
        for t in tok_re.finditer(sec):
            g = t.groupdict()
            if g['table'] is not None:
                rows = [[clean_inline(c) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.S)]
                        for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', g['table'], re.S)]
                rows = [r for r in rows if any(r)]
                if rows:
                    tables.append(dict(heading=heading, desc=last_p, rows=rows))
                for c in re.findall(r'<code[^>]*>(.*?)</code>', g['table'], re.S):
                    inline.append(clean_inline(c))
            elif g['svg'] is not None:
                prose.extend(html.unescape(re.sub(r'<[^>]+>', '', x)) for x in re.findall(r'<text[^>]*>(.*?)</text>', g['svg'], re.S))
            elif g['h3'] is not None:
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
                else:
                    prose.append(clean_inline(re.sub(r'<code[^>]*>.*?</code>', ' ', g['li'], flags=re.S)))
            elif g['p'] is not None:
                txt = clean_inline(g['p'])
                prose.append(clean_inline(re.sub(r'<code[^>]*>.*?</code>', ' ', g['p'], flags=re.S)))
                # inline <code> inside paragraphs
                for c in re.findall(r'<code[^>]*>(.*?)</code>', g['p'], re.S):
                    inline.append(clean_inline(c))
                if txt:
                    last_p = txt
            elif g['code'] is not None:
                inline.append(clean_inline(g['code']))
        items.append(dict(sid=sid, period=period, pnum=pnum, ltitle=ltitle, blocks=blocks, inline=inline, quiz=quiz,
                          tables=tables, prose=prose))
    return doc_title, items


def section_snippets(subject, day, sec, url, snippets, tag='', label='강의'):
    """한 교시(section)의 코드 블록 · 빈칸 · 표 · 본문 코드 · 괄호 넣기를 snippets 에 더한다. 더한 블록 수를 돌려준다."""
    cnt = 0
    topic = f'Day {day} · {sec["period"]} {sec["ltitle"]}' if sec['pnum'] else f'Day {day} · 개요'
    blocks = sec['blocks']
    # pair fill questions with their answers
    i = 0
    k = 0
    while i < len(blocks):
        b = blocks[i]
        lang = guess_lang(b['cls'], b['code'], subject)
        k += 1
        sid = f'{subject}-d{day}-{tag}{sec["sid"]}-{k}'
        base = dict(id=sid, subject=subject, day=day, period=sec['pnum'], topic=topic,
                    source=f'{subject.upper() if subject!="eio" else "Embedded_IO"} Day {day} {label} · {sec["period"]}',
                    url=f'{url}#{sec["sid"]}', lang=lang)
        if lang == 'text':
            # expected output → attach to previous code snippet
            prev = next((x for x in reversed(snippets) if x.get('_sec') == (subject, day, tag + sec['sid'])), None)
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
                                 filled=f'{nf}/{nb}', _sec=(subject, day, tag + sec['sid'])))
            cnt += 1 + len(ans)
            i += 1
            continue
        if b['fill'] and b['answer']:
            # answer already attached to its question; keep extra answer code (e.g. answer without question)
            q = next((x for x in snippets if x.get('_sec') == (subject, day, tag + sec['sid']) and x.get('kind') == 'fill' and x['title'] == b['heading']), None)
            if q is not None:
                i += 1
                continue
        snippets.append(dict(base, title=b['heading'] + (' (정답)' if b['answer'] else ''), desc=b['desc'],
                             code=b['code'], _sec=(subject, day, tag + sec['sid'])))
        cnt += 1
        i += 1
    # tables (표) — 강의 본문의 표를 한 줄에 한 행씩 ' | ' 로 이어서
    for n, tb in enumerate(sec.get('tables', []), 1):
        same = sum(1 for x in sec['tables'][:n] if x['heading'] == tb['heading'])
        snippets.append(dict(id=f'{subject}-d{day}-{tag}{sec["sid"]}-t{n}', subject=subject, day=day, period=sec['pnum'],
                             topic=topic, title=f'표 · {tb["heading"]}' + (f' ({same})' if same > 1 else ''), kind='table',
                             desc=tb['desc'], source=f'Day {day} {label} · {sec["period"]} 표', url=f'{url}#{sec["sid"]}',
                             lang='text', code='\n'.join(' | '.join(r) for r in tb['rows']), _sec=(subject, day, tag + sec['sid'])))
    cnt += len(sec.get('tables', []))
    # inline code collection
    seen, inl = set(), []
    for c in sec['inline']:
        if len(c) < 2 or c in seen:
            continue
        seen.add(c)
        inl.append(c)
    if inl:
        snippets.append(dict(id=f'{subject}-d{day}-{tag}{sec["sid"]}-inline', subject=subject, day=day, period=sec['pnum'],
                             topic=topic, title='본문 속 코드 · 명령어', kind='inline',
                             source=f'Day {day} {label} · {sec["period"]} 본문', url=f'{url}#{sec["sid"]}',
                             lang='text', code='\n'.join(inl), _sec=(subject, day, tag + sec['sid'])))
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
        snippets.append(dict(id=f'{subject}-d{day}-{tag}{sec["sid"]}-{qid}', subject=subject, day=day, period=sec['pnum'],
                             topic=topic, title=qz['title'], kind='quiz', lang='text',
                             source=f'Day {day} {label} · {sec["period"]} 괄호 넣기', url=f'{url}#{qid}',
                             blank='\n'.join(f'{n + 1}. {q}' for n, q in enumerate(qz['q'])),
                             answer='\n'.join(f'{n + 1}. {a}' for n, a in enumerate(qz['a'])),
                             code='\n'.join(lines)))
    return cnt


MD_FILES = [('mcu', d, f'MCU-day{d}/MCU_Day{d}_lecture.md') for d in (1, 2, 3)]


def md_inline(t):
    """마크다운 한 줄 → 글자만 (강조 · 링크 · 백틱을 뗀다)."""
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)|</?(?:img|br|details|summary|a|b|strong|em|span|div|p|sup|sub|kbd)\b[^>]*>', '', t)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    return re.sub(r'\s+', ' ', t.replace('**', '').replace('`', '')).strip()


def parse_md(path):
    """MCU_DayN_lecture.md 를 parse_lecture 와 같은 모양(교시별 blocks · tables · inline · quiz)으로 읽는다."""
    lines = open(path, encoding='utf-8').read().replace('\r', '').split('\n')
    new = lambda sid, period, pnum, t: dict(sid=sid, period=period, pnum=pnum, ltitle=t, blocks=[], inline=[], quiz={}, tables=[], prose=[])
    sec = new('intro', '개요', 0, '개요')
    items = [sec]
    heading, fill_id, in_details, last_p = '개요', None, False, ''
    i = 0
    while i < len(lines):
        l = lines[i]
        i += 1
        m = re.match(r'# (\d+)\s*교시\s*·\s*(.*?)\s*(\(\d\d:\d\d[^)]*\))?\s*$', l)
        if m:
            sec = new(f'sec{m.group(1)}', f'{m.group(1)}교시', int(m.group(1)), m.group(2))
            items.append(sec)
            heading, fill_id, last_p = sec['ltitle'], None, ''
        elif l.startswith(('# ', '## ', '### ')):
            heading, fill_id, last_p = md_inline(l.lstrip('# ')).lstrip('▶⚙️🛠 ').strip(), None, ''
        elif l.startswith('#### '):
            heading, last_p = md_inline(l[5:]).lstrip('✏️ ').strip(), ''
            m = re.search(r'(빈칸 채우기|괄호 넣기)\s*([\d-]+)', heading)
            fill_id = ('f' if m.group(1) == '빈칸 채우기' else 'p') + m.group(2) if m else None
        elif l.startswith('<details'):
            in_details = True
        elif l.startswith('</details'):
            in_details = False
        elif l.startswith('```'):
            cls = 'language-' + l[3:].strip() if l[3:].strip() else ''
            body = []
            while i < len(lines) and not lines[i].startswith('```'):
                body.append(lines[i].rstrip())
                i += 1
            i += 1
            sec['blocks'].append(dict(heading=heading, fill=fill_id, answer=in_details, cls=cls,
                                      code='\n'.join(body).replace(SHOW_BLANK, BLANK).rstrip('\n'), desc=last_p))
        elif l.startswith('|'):
            rows = []
            i -= 1
            while i < len(lines) and lines[i].startswith('|'):
                cells = [md_inline(c) for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                    rows.append(cells)
                sec['inline'] += [re.sub(r'\s+', ' ', c).strip() for c in re.findall(r'`([^`]+)`', lines[i])]
                i += 1
            sec['tables'].append(dict(heading=heading, desc=last_p, rows=rows))
        elif l.strip():
            sec['inline'] += [re.sub(r'\s+', ' ', c).strip() for c in re.findall(r'`([^`]+)`', l)]
            m = re.match(r'\s*\d+\.\s+(.*)', l)
            if m and fill_id and fill_id.startswith('p'):
                qz = sec['quiz'].setdefault(fill_id, dict(title=heading, q=[], a=[]))
                q = m.group(1) if in_details else re.sub(r'\(\s*　+\s*\)|\(\S[^()]*\s/\s[^()]*\S\)', BLANK, m.group(1))   # ( ) 빈칸 · (가 / 나) 고르기
                (qz['a'] if in_details else qz['q']).append(md_inline(q))
            else:
                txt = md_inline(re.sub(r'`[^`]*`', ' ', l.lstrip('-*> ')))
                sec['prose'].append(txt)
                if not l.startswith('<'):
                    last_p = md_inline(l.lstrip('-*> '))
    return [s for s in items if s['blocks'] or s['tables'] or s['quiz'] or s['inline']]


def norm_line(l):
    return re.sub(r'\s+', '', l)


def md_snippets(snippets):
    """강의 md 판에만 있는 내용 (HTML 강의와 다른 코드 · 빈칸 · 괄호 넣기 · 표) 을 더한다."""
    have = {norm_line(l) for x in snippets for k in ('code', 'blank', 'answer', 'output') for l in x.get(k, '').split('\n')}

    def is_new(x):
        if x.get('kind') in ('quiz', 'table'):
            ls = x['code'].split('\n') if x['kind'] == 'table' else re.sub(r'\[|\]', '', x['code']).split('\n')
            ls = [re.sub(r'^\d+\.\s*', '', l) for l in ls]
            pool = have if x['kind'] == 'table' else {re.sub(r'^\d+\.|\[|\]', '', h) for h in have}
            return any(norm_line(l) and norm_line(l) not in pool for l in ls)
        if x.get('kind') == 'inline':
            return False
        ls = '\n'.join(x.get(k, '') for k in ('code', 'blank', 'answer')).split('\n')
        return any(norm_line(l) not in have for l in ls if l.strip() and not l.strip().startswith(('//', '#', '/*')) or l.strip().startswith('#include'))

    for subject, day, rel in MD_FILES:
        path = os.path.join(AIC, rel)
        if not os.path.exists(path):
            continue
        url = f'https://github.com/imguru-mooc/AI_CAMPUS/blob/main/{rel}'
        got = []
        for sec in parse_md(path):
            section_snippets(subject, day, sec, url, got, tag='md-', label='강의 md(이전 판)')
        for x in got:
            if is_new(x):
                x['title'] = x['title'] + ' — md 판에만 있음'
                snippets.append(x)


CALL_RX = re.compile(r'(?<![\w.])([A-Za-z_]\w*)\(([ -~]{0,40}?)\)')
CONST_RX = re.compile(r'\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b')
PATH_RX = re.compile(r'(?<![\w.])/(?:dev|sys|proc|boot|etc)/[\w./:*-]*\w')


def prose_code(snippets, secs_all):
    """코드 태그 없이 본문 · 그림 글자에만 나온 함수 호출 · 상수 · 경로를 그 교시의 '본문 속 코드' 에 더한다."""
    text = '\n'.join(x.get(k, '') for x in snippets for k in ('code', 'blank', 'answer', 'output'))
    have = norm_line(text)
    calls = set(re.findall(r'(?<![\w.])([A-Za-z_]\w*)\s*\(', text))
    by_id = {x['id']: x for x in snippets}
    for subject, day, url, sec in secs_all:
        found = []
        for t in sec['prose']:
            for m in CALL_RX.finditer(t):
                name, args = m.group(1), m.group(2)
                if '_' in name or (name[0].islower() and name in calls and len(name) > 3 and args.strip()):
                    found.append(m.group(0))
            found += CONST_RX.findall(t) + PATH_RX.findall(t)
        found = [c for c in dict.fromkeys(found) if norm_line(c) not in have]
        if not found:
            continue
        sid = f'{subject}-d{day}-{sec["sid"]}-inline'
        if sid in by_id:
            by_id[sid]['code'] += '\n' + '\n'.join(found)
        else:
            topic = f'Day {day} · {sec["period"]} {sec["ltitle"]}' if sec['pnum'] else f'Day {day} · 개요'
            x = dict(id=sid, subject=subject, day=day, period=sec['pnum'], topic=topic, title='본문 속 코드 · 명령어', kind='inline',
                     source=f'Day {day} 강의 · {sec["period"]} 본문', url=f'{url}#{sec["sid"]}', lang='text', code='\n'.join(found))
            snippets.append(x)
            by_id[sid] = x


def build():
    snippets = []
    stats = {}
    secs_all = []
    for subject, day, rel in LECTURES:
        doc_title, secs = parse_lecture(subject, day, rel)
        url = f'https://imguru-mooc.github.io/AI_CAMPUS/{rel}'
        stats[rel] = sum(section_snippets(subject, day, sec, url, snippets) for sec in secs)
        secs_all += [(subject, day, url, sec) for sec in secs]
    md_snippets(snippets)
    prose_code(snippets, secs_all)
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
