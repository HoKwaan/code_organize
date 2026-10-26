"""API 모음: supplement.py 의 줄마다 강의 코드에서 같은 API 를 쓰는 실제 줄을 찾아 바꾼다.

강의 자료에 그 API 가 있으면 강의 코드 줄(출처 링크 포함)로, 없을 때만 supplement.py 의 줄을 '보충' 으로 남긴다.
"""
import re

STOP = {'if', 'int', 'NULL', 'sizeof', 'printf', 'perror', 'return', 'pid_t', 'FILE', 'void', 'unsigned', 'long', 'static'}
KIND_RANK = {None: 0, 'fill': 0, 'src': 1, 'pdf': 1, 'inline': 2, 'quiz': 3}
SUBJ_NAME = {'mcu': 'MCU', 'linux': 'Linux', 'eio': 'EIO'}
ARRLEN = re.compile(r'sizeof\s*\(\s*(\w+)\s*\)\s*/\s*sizeof\s*\(\s*\1\s*\[\s*0\s*\]\s*\)')


def code_part(line):
    """주석을 뗀 코드. '#' 로 시작하는 줄은 #include · #define 만 코드로 본다."""
    s = line.strip()
    if s.startswith('#') and not re.match(r'#\s*(include|define)\b', s):
        return ''
    return re.sub(r'//.*|/\*.*?(\*/|$)', '', s).strip()


def no_str(c):
    return re.sub(r'"(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\'', '""', c)


def keys(line):
    """그 줄이 보여 주려는 API: 대문자 상수, 호출하는 함수(객체.메서드), 구조체 멤버. (이름, 호출인가)"""
    c = no_str(code_part(line))
    out = []
    for m in re.finditer(r'(\b[A-Za-z_]\w*\.)?\b([A-Za-z_]\w*)', c):
        obj, t = m.group(1) or '', m.group(2)
        call = c[m.end():].lstrip().startswith('(')
        if obj and call:
            out.append((obj + t, True))
        elif t in STOP:
            continue
        elif call:
            out.append((t, True))
        elif (t.isupper() and len(t) > 2) or re.match(r'st_\w+$', t):
            out.append((t, False))
    if not out and 'perror' in c:
        out = [('perror', True)]
    return list(dict.fromkeys(out))


def candidates(sn):
    """강의 코드의 줄들: (식별자 문자열, 줄, 스니펫, 줄 번호)."""
    for x in sn:
        if x.get('kind') == 'ref':
            continue
        text = x.get('kind') in ('quiz', 'inline', 'table')
        code = (x.get('answer') or x.get('code', '')) if x.get('kind') == 'quiz' else x.get('code', '')
        for i, l in enumerate(code.split('\n')):
            s = l.strip()
            c = s if text else code_part(s)
            if c and len(c) <= 160:
                yield no_str(c), s, x, i


def has(c, k, call, text=False):
    if not call:
        return re.search(r'\b' + re.escape(k) + r'\b', c)
    # 호출은 이름 뒤에 '(' 가 있어야 하고, 앞에 다른 객체가 붙으면 안 된다 (dht.begin ≠ Serial.begin).
    # 본문 · 괄호 넣기 문장은 함수 이름만 나와도 된다.
    return re.search(r'(?<![\w.])' + re.escape(k) + (r'\b' if text else r'\s*\('), c)


def find(cands, line, subj):
    ks = keys(line)
    arrlen = ARRLEN.search(line)
    if not ks and not arrlen:
        return None
    soft = [k for k in ks if k[0].startswith('st_')] if len(ks) > 1 else []   # st.st_mode 같은 인자는 없어도 된다
    ks = [k for k in ks if k not in soft]
    last = [k for k, call in ks if not call and k.isupper()][-1:]          # 그 줄이 보여 주는 상수 (보통 맨 뒤)
    best = None
    modes = re.findall(r'"[^"]{1,3}"', code_part(line))                    # fopen 의 "r" · "w" 처럼 짧은 문자열 인자도 맞아야 한다
    for c, s, x, i in cands:
        if any(m not in s for m in modes):
            continue
        if x['subject'] != subj and 'mcu' in (subj, x['subject']):
            continue                              # MCU(Arduino) 와 Linux · EIO(C) 는 같은 이름이라도 다른 API
        text = x.get('kind') in ('quiz', 'inline')    # 표는 함수 이름만으로는 안 되고 호출 모양이 있어야 한다
        if arrlen:
            if not ARRLEN.search(c):
                continue
            miss = 0
        else:
            miss = sum(not has(c, k, call, text) for k, call in ks)
            # 다 맞는 줄이 없으면 그 상수를 쓰는 강의 줄도 받는다 (예: O_RDWR | O_SYNC)
            if miss and not (last and has(c, last[0], False)):
                continue
        extra = len({t for t in re.findall(r'\b[A-Z][A-Z0-9_]{2,}\b', c)} - {k for k, _ in ks})
        stmt = text or bool(re.search(r'[;{})]$', c))     # 한 문장으로 끝나는 줄을 먼저
        rank = 4 if x.get('kind') == 'table' or '-md-' in x['id'] else KIND_RANK.get(x.get('kind'), 2)   # 표 · md 판은 다른 데 없을 때만
        score = (miss > 0, x['subject'] != subj, rank, not stmt, extra, len(s))
        if best is None or score < best[0]:
            best = (score, s, x, i)
    return best


def label(x):
    p = f" {x['period']}교시" if x.get('period') and x['period'] < 99 else ''
    return f"{SUBJ_NAME[x['subject']]} D{x['day']}{p}"


def build(sn, supp):
    cands = list(candidates(sn))
    out = []
    for n, (subj, title, lang, code) in enumerate(supp):
        name = title.replace('보충 · ', '')
        got, refs, miss = [], [], []
        for line in code.split('\n'):
            desc = line.split('//', 1)[1].strip() if '//' in line else ''
            hit = find(cands, line, subj)
            if hit:
                _, s, x, i = hit
                if any(r[1] == x['id'] and r[2] == i for r in refs):
                    continue                      # 같은 강의 줄이 이미 들어감
                refs.append([len(got), x['id'], i])
                got.append((code_part(s) or s, f'{desc} · {label(x)}' if desc else label(x)))
            else:
                miss.append(line)
        if got:
            w = min(max(len(c) for c, _ in got) + 2, 64)
            out.append(dict(id=f'{subj}-api-{n}', subject=subj, day=0, period=0, topic='API 모음', kind='ref',
                            title=f'강의 코드 · {name}', lang=lang, refs=refs,
                            source='강의 자료에서 같은 API 를 쓰는 줄을 모음 (줄마다 출처 링크)',
                            code='\n'.join(f'{c.ljust(w)} // {d}' for c, d in got)))
        if miss:
            out.append(dict(id=f'{subj}-ref-{n}', subject=subj, day=0, period=0, topic='API 모음', kind='ref',
                            title=f'보충 · {name} (강의 자료에 없음)', lang=lang,
                            source='보충 — 14개 강의 페이지 · src · PDF 슬라이드 · md 어디에도 없는 표준 API',
                            code='\n'.join(miss)))
    return out
