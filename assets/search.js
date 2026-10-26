/* 빈칸 코드 검색 엔진
 *
 * 시험 문제의 빈칸 줄(______, □, ( ㉠ ), ??? 등)이나 TODO 를 붙여넣으면
 *  - 코드 부분: 빈칸을 와일드카드로 보고 IDF 가중 LCS 로 정리본 코드 줄과 맞춘다.
 *    맞춰진 앞뒤 토큰 사이에 있는 코드가 빈칸 정답 후보가 된다. 같은 후보끼리 묶어 보여준다.
 *  - 주석 부분(설명): 한글 2글자 조각으로 정리본 주석 · 괄호 넣기 문장과 비교해 힌트 점수로 쓴다.
 *  - 주석만 있는 줄이 이어지면(TODO 설명) 하나의 묶음으로 보고, 설명에 나온 함수 · 변수 이름과
 *    한글 설명이 많이 겹치는 코드 조각을 찾아준다.
 */
(function () {
  'use strict';

  const BLANK = '\u0000';

  // 코드 부분에서 빈칸으로 보는 표기들
  const BLANK_PATTERNS = [
    /\(\s*[①-⑳㉠-㉭ⓐ-ⓩ]\s*\)|\(\s{2,}\)/g,       // ( ㉠ )  (   )
    /\[\s*[①-⑳㉠-㉭ⓐ-ⓩ]\s*\]|\[\s{2,}\]/g,       // [ ㉠ ]  [   ]
    /<\s*빈칸\s*\d*\s*>/g,
    /_{3,}/g,
    /[□■▢☐]+/g,
    /\?{2,}/g,
    /…|\.{3,}/g,
    /[①-⑳㉠-㉭ⓐ-ⓩ]/g,
    /빈칸\s*\d*/g
  ];

  const TOKEN_RE = new RegExp([
    BLANK,
    '0[xX][0-9a-fA-F]+[uUlL]*', '0[bB][01]+', '\\d+(?:\\.\\d+)?[uUlLfF]*',
    '[A-Za-z_$][A-Za-z0-9_]*',
    '[가-힣]+',
    '->', '<<=?', '>>=?', '[<>=!+\\-*/%&|^]=', '&&', '\\|\\|', '\\+\\+', '--', '::',
    '\\S'
  ].join('|'), 'g');

  const PUNCT_W = 0.15;   // 괄호 · 세미콜론 같은 기호 가중치

  function isWord(t) { return /^[A-Za-z_$가-힣0-9]/.test(t); }
  function isIdent(t) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(t); }

  function tokenizePos(s) {
    const toks = [], pos = [];
    for (const m of s.matchAll(TOKEN_RE)) { toks.push(m[0]); pos.push([m.index, m.index + m[0].length]); }
    return { toks, pos };
  }

  // 줄을 코드 / 주석으로 나눈다. 주석만 있는 줄은 code 가 빈 문자열.
  function splitComment(line) {
    const t = line.trim();
    if (/^(\/\/|\/\*|\*|#(?!include|define|if|ifn?def|endif|else|elif|undef|pragma)|--)/.test(t) && !/^#!/.test(t)) {
      return { code: '', comment: t.replace(/^(\/\/+|\/\*+|\*+\/?|#+|--)\s*/, '').replace(/\*\/\s*$/, '') };
    }
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) return { code: line.slice(0, i), comment: line.slice(i + 2).replace(/\*\/\s*$/, '') };
      if (c === '#' && i > 0 && /\s/.test(line[i - 1]) && /\s/.test(line[i + 1] || ' ')) return { code: line.slice(0, i), comment: line.slice(i + 1) };
    }
    return { code: line, comment: '' };
  }

  function markBlanks(text) {
    let s = text;
    for (const re of BLANK_PATTERNS) s = s.replace(re, ` ${BLANK} `);
    return s;
  }

  // camelCase / snake_case 를 쪼갠 소문자 하위 토큰
  function subTokens(t) {
    if (!/^[A-Za-z_]/.test(t)) return [];
    return t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\s]+/).map(x => x.toLowerCase()).filter(x => x.length > 1);
  }

  // 한글은 2글자 조각, 영문 식별자는 소문자 이름과 하위 단어로
  function hintGrams(text) {
    const g = new Set();
    for (const w of String(text).match(/[가-힣]+|[A-Za-z][A-Za-z0-9_]*/g) || []) {
      if (/^[가-힣]/.test(w)) {
        for (let i = 0; i < w.length - 1; i++) g.add(w.slice(i, i + 2));
      } else {
        g.add(w.toLowerCase());
        subTokens(w).forEach(x => g.add(x));
      }
    }
    return g;
  }

  function gramSim(q, c) {
    if (!q.size || !c.size) return 0;
    let hit = 0;
    q.forEach(x => { if (c.has(x)) hit++; });
    return hit / q.size;
  }

  // 설명 주석의 한글 → 함수 · 상수 이름에 자주 쓰는 영어 조각 (빈칸 후보 이름과 비교)
  const KO_EN = [
    ['읽', ['read', 'get', 'recv']], ['쓰기', ['write', 'set', 'send']], ['쓰는', ['write', 'set']], ['열', ['open']], ['닫', ['close']],
    ['만들', ['create', 'new', 'init', 'make']], ['생성', ['create', 'new']], ['기다', ['wait', 'join', 'poll', 'take', 'receive']],
    ['잠금', ['lock', 'mutex']], ['잠그', ['lock']], ['잡', ['lock', 'take']], ['풀', ['unlock', 'give', 'release']], ['요청', ['request']],
    ['반납', ['release', 'free', 'close']], ['해제', ['free', 'release', 'unlock']], ['값', ['value', 'val']], ['라인', ['line']],
    ['시간', ['time', 'ms', 'us', 'ns']], ['시각', ['time', 'timestamp']], ['보내', ['send', 'write']], ['받', ['receive', 'recv', 'read']],
    ['깨우', ['signal', 'notify', 'broadcast', 'give']], ['알리', ['signal', 'notify']], ['소리', ['tone', 'buz']], ['주파수', ['tone', 'freq', 'frequency']],
    ['방향', ['direction', 'dir']], ['입력', ['input', 'in']], ['출력', ['output', 'out', 'print']], ['이어', ['append']], ['끝에', ['append', 'end']],
    ['링크', ['link', 'lstat', 'readlink', 'symlink']], ['종료', ['exit', 'status', 'term']], ['쓰레드', ['thread', 'pthread']], ['스레드', ['thread', 'pthread']],
    ['상태', ['status', 'state']], ['밝기', ['duty', 'write', 'pwm']], ['듀티', ['duty']], ['분해능', ['resolution', 'bits']], ['속도', ['baud', 'speed']],
    ['통신', ['serial', 'begin', 'baud']], ['초기', ['init', 'begin']], ['시작', ['begin', 'start']], ['멈', ['stop', 'pause']], ['지우', ['clear']],
    ['복사', ['copy', 'memcpy', 'dup']], ['비교', ['cmp', 'compare']], ['길이', ['len', 'length', 'size']], ['크기', ['size', 'sizeof']],
    ['개수', ['count', 'n', 'size']], ['인터럽트', ['interrupt', 'isr', 'irq']], ['타이머', ['timer']], ['큐', ['queue']], ['태스크', ['task']],
    ['세마포', ['semaphore', 'sem']], ['조건', ['cond']], ['신호', ['signal', 'sig']], ['시그널', ['signal', 'sig']], ['프로세스', ['process', 'fork', 'pid']],
    ['자식', ['child', 'fork', 'wait']], ['부모', ['parent', 'ppid']], ['실행', ['exec', 'run']], ['파일', ['file', 'open', 'fd']],
    ['디렉터리', ['dir', 'directory']], ['메모리', ['memory', 'mem', 'mmap', 'malloc']], ['매핑', ['mmap', 'map']], ['풀업', ['pullup', 'pull', 'up']],
    ['풀다운', ['pulldown', 'pull', 'down']], ['엣지', ['edge']], ['이벤트', ['event']], ['버퍼', ['buffer', 'buf']], ['켜', ['on', 'high', 'active']],
    ['꺼', ['off', 'low', 'inactive']], ['끄', ['off', 'low', 'inactive']], ['정보', ['stat', 'info']], ['권한', ['access', 'mode', 'chmod']],
    ['주소', ['addr', 'address']], ['전송', ['transfer', 'transmission', 'write', 'send']], ['화면', ['lcd', 'print', 'display']], ['커서', ['cursor']]
  ];

  function koHints(comment) {
    const out = new Set();
    KO_EN.forEach(([ko, en]) => { if (comment.includes(ko)) en.forEach(e => out.add(e)); });
    return out;
  }

  let INDEX = null;

  function build(data) {
    const lines = [], quiz = [];
    const df = new Map();
    // 시험 양식의 제공 코드(도우미 함수 등)도 검색 대상에 넣는다
    const snippets = (data.snippets || []).concat((data.exams || []).map(e => Object.assign({ kind: 'exam' }, e)));
    snippets.forEach((sn, si) => {
      const codeLines = String(sn.code || '').replace(/\r/g, '').split('\n');
      sn._lines = codeLines;
      sn._si = si;
      const idents = new Set();
      const meta = [sn.title, sn.topic, sn.desc].join(' ');
      sn._grams = hintGrams(meta + ' ' + codeLines.map(l => splitComment(l).comment).join(' '));
      codeLines.forEach((raw, li) => {
        if (sn.kind === 'quiz') {
          const ans = [...raw.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
          if (raw.trim()) quiz.push({ si, li, raw, grams: hintGrams(raw.replace(/\[[^\]]*\]/g, ' ')), ans });
          return;
        }
        const { code, comment } = splitComment(raw);
        const { toks, pos } = tokenizePos(code);
        toks.forEach(t => { if (isIdent(t)) idents.add(t.toLowerCase()); });
        if (!toks.length) return;
        const low = toks.map(t => t.toLowerCase());
        lines.push({ si, li, raw, code, toks, low, pos, grams: hintGrams(comment) });
        if (sn.kind !== 'exam') new Set(low).forEach(t => df.set(t, (df.get(t) || 0) + 1));   // 가중치는 정리본 기준
      });
      sn._idents = idents;
    });
    INDEX = { snippets, lines, quiz, df, N: Math.max(lines.length, 1) };
    return INDEX;
  }

  const OPS = new Set(['==', '!=', '<=', '>=', '&&', '||', '->', '<<', '>>', '+=', '-=', '|=', '&=', '^=', '<<=', '>>=', '++', '--', '|', '&', '^', '~', '!', '<', '>', '%', '*', '/', '+', '-', '?', ':']);
  const KEYWORDS = new Set(['int', 'long', 'char', 'void', 'const', 'static', 'unsigned', 'signed', 'struct', 'return', 'if', 'else', 'for', 'while', 'do', 'float', 'double', 'bool', 'uint8_t', 'uint32_t', 'int32_t', 'size_t', 'ssize_t', 'volatile', 'sizeof', 'break', 'continue', 'true', 'false', 'null']);

  function idf(t) {
    if (OPS.has(t)) return 0.7;
    if (t === '=') return 0.35;
    if (!isWord(t)) return PUNCT_W;
    if (KEYWORDS.has(t)) return 0.6;
    const d = INDEX.df.get(t) || 0;
    if (!d) return 0.3;      // 정리본에 없는 이름(시험 문제만의 변수명)은 맞출 수 없으니 가볍게
    return Math.log(1 + INDEX.N / (1 + d)) + 0.2;
  }

  // 1 = 같음, 0.6 = 앞/뒷부분 일치(빈칸이 이름 일부를 가린 경우), 하위 단어 일부 일치
  function tokSim(q, c) {
    if (q === c) return 1;
    if (!isWord(q) || !isWord(c)) return 0;
    if (q.length >= 3 && c.length >= 3 && (c.startsWith(q) || c.endsWith(q))) return 0.6;
    const qs = subTokens(q), cs = subTokens(c);
    if (qs.length && cs.length) {
      const hit = qs.filter(x => cs.includes(x)).length;
      if (hit) return 0.5 * hit / Math.max(qs.length, cs.length);
    }
    return 0;
  }

  /* 쿼리 토큰(빈칸 제외)과 코드 줄 토큰의 가중 LCS. 반환: { score, match: [qi -> ci] } */
  function align(qLow, qW, cLow) {
    const n = qLow.length, m = cLow.length;
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    const sim = (i, j) => (qLow[i] === BLANK ? 0 : tokSim(qLow[i], cLow[j]));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        let best = Math.max(dp[i - 1][j], dp[i][j - 1]);
        const s = sim(i - 1, j - 1);
        if (s > 0) best = Math.max(best, dp[i - 1][j - 1] + s * qW[i - 1]);
        dp[i][j] = best;
      }
    }
    const match = new Array(n).fill(-1);
    let i = n, j = m;
    while (i > 0 && j > 0) {
      const s = sim(i - 1, j - 1);
      if (s > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + s * qW[i - 1])) < 1e-9) {
        match[i - 1] = j - 1; i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
    }
    return { score: dp[n][m], match };
  }

  // 정리본 줄의 이름을 시험 문제 이름으로 바꾸는 표 (sizeof(melody[0]) → sizeof(SOS[0]))
  function renameMap(q, match, line) {
    const map = new Map();
    q.toks.forEach((t, i) => {
      if (t === BLANK || !isIdent(t)) return;
      let j = match[i];
      if (j < 0) {
        const L = i > 0 ? match[i - 1] : -1, R = i + 1 < q.toks.length ? match[i + 1] : -1;
        if (L >= 0 && R === L + 2) j = L + 1;
        else return;
      }
      const c = line.toks[j];
      if (isIdent(c) && c !== t && !KEYWORDS.has(c.toLowerCase())) map.set(c, t);
    });
    return map;
  }

  function applyMap(text, map) {
    if (!text || !map.size) return text;
    return text.replace(/[A-Za-z_][A-Za-z0-9_]*/g, w => map.get(w) || w);
  }

  // 빈칸 자리에 해당하는 코드 원문 조각
  function rawFills(q, match, line) {
    const out = [];
    q.toks.forEach((t, qi) => {
      if (t !== BLANK) return;
      let a = -1, b = line.toks.length, ka = -1, kb = -1;
      for (let k = qi - 1; k >= 0; k--) if (match[k] >= 0) { a = match[k]; ka = k; break; }
      for (let k = qi + 1; k < q.toks.length; k++) if (match[k] >= 0) { b = match[k]; kb = k; break; }
      if (a < 0 && b >= line.toks.length) { out.push(null); return; }
      let start = a + 1 < line.toks.length ? line.pos[a + 1][0] : line.code.length;
      let end = b - 1 > a ? line.pos[b - 1][1] : start;
      // 바로 붙은 앵커가 이름 일부만 맞았다면(GPIOD_EDGE_EVENT____) 남은 글자가 정답
      if (ka === qi - 1 && a >= 0 && q.low[ka] !== line.low[a] && line.low[a].startsWith(q.low[ka])) {
        start = line.pos[a][0] + q.toks[ka].length;
        if (end < start) end = line.pos[a][1];
      }
      if (kb === qi + 1 && b < line.toks.length && q.low[kb] !== line.low[b] && line.low[b].endsWith(q.low[kb])) {
        if (end <= start) start = line.pos[b][0];
        end = line.pos[b][1] - q.toks[kb].length;
      }
      // 왼쪽 앵커 없이 줄 맨 앞이 빈칸이면(______(a, b)) 오른쪽 앵커 바로 앞 이름(obj.method 포함)만 정답
      if (ka < 0 && b < line.toks.length) {
        let k = b - 1;
        while (k > 0 && (line.toks[k - 1] === '.' || line.toks[k - 1] === '->') && isIdent(line.toks[k - 2] || '')) k -= 2;
        if (k >= 0 && isIdent(line.toks[k])) start = line.pos[k][0];
      }
      // 오른쪽 앵커 없이 줄 끝이 빈칸이면 왼쪽 앵커 바로 뒤 한 덩어리만
      if (kb < 0 && a >= 0 && a + 1 < line.toks.length) {
        let k = a + 1;
        while (k + 1 < line.toks.length && !/^[;,){}]$/.test(line.toks[k + 1])) k++;
        end = line.pos[k][1];
      }
      let seg = end > start ? line.code.slice(start, end).trim() : '';
      // 짝이 없는 닫는 괄호가 나오면 거기서 자른다 (== LOW) count++ → LOW)
      let depth = 0;
      for (let i = 0; i < seg.length; i++) {
        const c = seg[i];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c) && --depth < 0) { seg = seg.slice(0, i).trim(); break; }
      }
      out.push(seg || null);
    });
    return out;
  }

  function prepCodeLine(raw) {
    const { code, comment } = splitComment(raw);
    const marked = markBlanks(code);
    const toks = marked.match(TOKEN_RE) || [];
    const low = toks.map(t => t === BLANK ? BLANK : t.toLowerCase());
    const w = low.map(t => t === BLANK ? 0 : idf(t));
    const total = w.reduce((a, b) => a + b, 0);
    return { raw, code, comment, toks, low, w, total, blanks: toks.filter(t => t === BLANK).length, grams: hintGrams(comment), koHints: koHints(comment) };
  }

  // 붙여넣은 글을 "코드 줄" 과 "설명 묶음(주석만 있는 줄들)" 으로 나눈다
  function parseQuery(text) {
    const items = [];
    let block = null;
    String(text).replace(/\r/g, '').split('\n').forEach(raw => {
      if (!raw.trim()) { block = null; return; }
      const { code, comment } = splitComment(raw);
      if (!code.trim() && comment.trim()) {
        if (!block) { block = { type: 'todo', lines: [] }; items.push(block); }
        block.lines.push(raw);
        return;
      }
      block = null;
      items.push({ type: 'line', raw });
    });
    return items;
  }

  // 빈칸 바로 옆 토큰이 그대로 맞고, 그 사이가 짧을수록 1 에 가깝다
  function anchorScore(q, match, line) {
    let sum = 0, n = 0;
    q.toks.forEach((t, qi) => {
      if (t !== BLANK) return;
      n++;
      const L = qi > 0 && q.toks[qi - 1] !== BLANK ? match[qi - 1] : null;
      const R = qi + 1 < q.toks.length && q.toks[qi + 1] !== BLANK ? match[qi + 1] : null;
      const lOk = L === null ? 0.5 : (L >= 0 && line.low[L] === q.low[qi - 1] ? 1 : (L >= 0 ? 0.6 : 0));
      const rOk = R === null ? 0.5 : (R >= 0 && line.low[R] === q.low[qi + 1] ? 1 : (R >= 0 ? 0.6 : 0));
      let v = (lOk + rOk) / 2;
      if (L !== null && R !== null && L >= 0 && R >= 0 && R - L - 1 > 6) v *= 0.5;   // 빈칸 자리가 너무 길다
      sum += v;
    });
    return n ? sum / n : 0;
  }

  function searchLine(raw, pool, ctxScore, opts) {
    const q = prepCodeLine(raw);
    if (!q.total) return { type: 'line', q, groups: [], hints: [] };
    // 개념 힌트: 괄호 넣기 문장 (설명 주석과 비슷한 문장의 [정답])
    const hints = [];
    if (q.grams.size) {
      INDEX.quiz.forEach(z => {
        if (opts.subject && INDEX.snippets[z.si].subject !== opts.subject) return;
        const s = gramSim(q.grams, z.grams);
        if (s >= 0.4) hints.push({ z, s });
      });
      hints.sort((a, b) => b.s - a.s);
    }
    const hintAns = new Map();
    hints.slice(0, 5).forEach(h => h.z.ans.forEach(a => {
      const k = a.replace(/\s+/g, '').toLowerCase();
      hintAns.set(k, Math.max(hintAns.get(k) || 0, h.s));
    }));
    const hits = [];
    for (const line of pool) {
      const r = align(q.low, q.w, line.low);
      let s = r.score / q.total;
      if (s < 0.3) continue;
      const extra = Math.max(0, line.toks.length - q.toks.length * 2);
      s *= 1 / (1 + 0.02 * extra);
      const hint = q.grams.size ? Math.max(gramSim(q.grams, line.grams), 0.6 * gramSim(q.grams, INDEX.snippets[line.si]._grams)) : 0;
      const anc = q.blanks ? anchorScore(q, r.match, line) : 0;
      let total = s + 0.6 * anc + 0.25 * hint + 0.15 * (ctxScore.get(line.si) || 0);
      if (INDEX.snippets[line.si].kind === 'exam') total *= 0.7;   // 시험지 자신의 줄은 정리본이 없을 때만 앞에 오게
      hits.push({ line, s, hint, total, match: r.match });
    }
    hits.sort((a, b) => b.total - a.total);
    // 같은 정답 후보끼리 묶기
    const groups = [];
    const byKey = new Map();
    for (const h of hits.slice(0, 400)) {
      h.sn = INDEX.snippets[h.line.si];
      h.rawFills = q.blanks ? rawFills(q, h.match, h.line) : [];
      const map = q.blanks ? renameMap(q, h.match, h.line) : null;
      const f = h.rawFills.map(x => applyMap(x, map));
      if (q.blanks && (f.every(x => !x) || f.some(x => x && /_{3,}|\u0000/.test(x)))) continue;
      const key = q.blanks ? f.map(x => (x || '?').replace(/\s+/g, '')).join('|') : h.line.raw.trim();
      let g = byKey.get(key);
      if (!g) {
        g = { fills: f, best: h, count: 0, examples: [] };
        byKey.set(key, g);
        groups.push(g);
      }
      g.count++;
      if (g.examples.length < 3 && !g.examples.some(e => e.line.raw.trim() === h.line.raw.trim())) g.examples.push(h);
    }
    // 묶음 점수: 가장 좋은 줄 + 여러 곳에서 쓰인 정도 + 괄호 넣기 정답과 같은지 - 지나치게 긴 조각
    groups.forEach(g => {
      const key = g.fills.map(x => (x || '').replace(/\s+/g, '').toLowerCase()).join('');
      const long = g.fills.some(x => x && (x.match(TOKEN_RE) || []).length > 8);
      // 빈칸 바로 뒤가 '(' 이면 함수 이름 자리 → 이름 하나(obj.method 포함)가 아닌 후보는 뒤로
      const fnSlot = q.toks.some((t, i) => t === BLANK && q.toks[i + 1] === '(');
      const notName = fnSlot && g.fills.some(x => x && !/^[A-Za-z_][\w]*(?:(?:\.|->)[A-Za-z_]\w*)*$/.test(x));
      let ko = 0;
      if (q.koHints.size) g.fills.forEach(x => {
        if (!x) return;
        const low = x.toLowerCase();
        const subs = subTokens(x.replace(/[^A-Za-z0-9_]+/g, '_'));
        q.koHints.forEach(k => { if (subs.includes(k) || (k.length >= 4 && low.includes(k))) ko++; });
      });
      g.score = g.best.total + Math.min(0.45, 0.15 * ko) + 0.04 * Math.log2(1 + g.count) + (hintAns.has(key) ? 0.4 * hintAns.get(key) + 0.25 : 0) - (long ? 0.2 : 0) - (notName ? 0.3 : 0);
      g.fromHint = hintAns.has(key);
    });
    groups.sort((a, b) => b.score - a.score);
    return {
      type: 'line', q, groups: groups.slice(0, opts.perLine || 5),
      hints: hints.slice(0, 3).map(h => ({ sn: INDEX.snippets[h.z.si], li: h.z.li, raw: h.z.raw, ans: h.z.ans, s: h.s }))
    };
  }

  function searchTodo(lines, snippetPool, ctxScore, opts) {
    const text = lines.map(l => splitComment(l).comment).join(' ');
    const grams = hintGrams(text.replace(/\bTODO\b\s*\d*/g, ''));
    const ids = [...new Set((text.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])
      .filter(t => t.length > 1 && !/^todo$/i.test(t)).map(t => t.toLowerCase()))];
    const idW = ids.map(t => idf(t));
    const idTotal = idW.reduce((a, b) => a + b, 0) || 1;
    const res = [];
    for (const sn of snippetPool) {
      if (sn.kind === 'quiz' || sn.kind === 'exam') continue;
      let hit = 0;
      ids.forEach((t, i) => { if (sn._idents.has(t)) hit += idW[i]; });
      const s = (ids.length ? 0.7 * hit / idTotal : 0) + 0.5 * gramSim(grams, sn._grams) + 0.2 * (ctxScore.get(sn._si) || 0);
      if (s > 0.2) res.push({ sn, s });
    }
    res.sort((a, b) => b.s - a.s);
    const top = res.slice(0, opts.perTodo || 5).map(r => {
      // 설명에 나온 이름이 들어 있는 줄을 강조
      const marks = new Set();
      r.sn._lines.forEach((l, i) => {
        const toks = (splitComment(l).code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).map(t => t.toLowerCase());
        if (toks.some(t => ids.includes(t))) marks.add(i);
      });
      return { sn: r.sn, s: r.s, marks };
    });
    return { type: 'todo', lines, ids, top };
  }

  /* query: 붙여넣은 텍스트 (여러 줄 가능), opts.subject: 과목 필터 */
  function search(query, opts = {}) {
    if (!INDEX) build(window.CODE_INDEX || {});
    const subj = opts.subject || '';
    const items = parseQuery(query);
    const snOk = sn => (!subj || sn.subject === subj);
    const pool = INDEX.lines.filter(l => snOk(INDEX.snippets[l.si]));
    const snippetPool = INDEX.snippets.filter(snOk);

    // 빈칸 없는 코드 줄로 어느 코드 조각과 비슷한 문제인지(문맥) 점수를 매긴다
    const ctxScore = new Map();
    const qs = items.filter(it => it.type === 'line').map(it => prepCodeLine(it.raw)).filter(q => !q.blanks && q.total > 2);
    qs.forEach(q => {
      const best = new Map();
      for (const line of pool) {
        const s = align(q.low, q.w, line.low).score / q.total;
        if (s >= 0.6 && (best.get(line.si) || 0) < s) best.set(line.si, s);
      }
      best.forEach((s, si) => ctxScore.set(si, (ctxScore.get(si) || 0) + s / qs.length));
    });

    const results = items.map(it => it.type === 'line'
      ? searchLine(it.raw, pool, ctxScore, opts)
      : searchTodo(it.lines, snippetPool, ctxScore, opts));

    const related = [...ctxScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([si, s]) => ({ sn: INDEX.snippets[si], s }));
    return { items: results, related };
  }

  window.CodeSearch = { build, search, splitComment, markBlanks, BLANK };
})();
