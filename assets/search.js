/* 빈칸 코드 검색 엔진
 *
 * 시험 문제의 빈칸 줄(____, □, ( ㉠ ), ??? 등)이나 TODO 를 붙여넣으면
 * 빈칸을 와일드카드로 보고, 나머지 토큰을 IDF 가중 LCS 로 정리본 코드 줄과 맞춘다.
 * 맞춰진 앞뒤 토큰 사이에 있는 코드 토큰이 빈칸 정답 후보가 된다.
 */
(function () {
  'use strict';

  const BLANK = '\u0000';

  // 빈칸 표기들. 순서 중요(긴 패턴 먼저).
  const BLANK_PATTERNS = [
    /\/\*\s*(?:TODO|todo|빈칸)[\s\S]*?\*\//g,
    /\(\s*[①-⑳㉠-㉭㈀-㈍ⓐ-ⓩ]\s*\)|\(\s{2,}\)/g,   // ( ㉠ )  (   )
    /\[\s*[①-⑳㉠-㉭ⓐ-ⓩ]\s*\]|\[\s{2,}\]/g,       // [ ㉠ ]  [   ]
    /<\s*빈칸\s*\d*\s*>/g,
    /\{\{\s*[^}]*\}\}/g,                                   // {{ }}
    /_{2,}/g,
    /[□■▢☐]+/g,
    /\?{2,}/g,
    /…|\.{3,}/g,
    /[①-⑳㉠-㉭ⓐ-ⓩ]/g,
    /빈칸\s*\d*/g
  ];
  const TODO_LINE = /(?:\/\/|#|--|\/\*)\s*(?:TODO|todo|ToDo)\b:?\s*(.*?)(?:\*\/)?\s*$/;

  const TOKEN_RE = new RegExp([
    BLANK,
    '0[xX][0-9a-fA-F]+', '0[bB][01]+', '\\d+(?:\\.\\d+)?[uUlLfF]*',
    '[A-Za-z_$][A-Za-z0-9_]*',
    '[가-힣]+',
    '->', '<<=?', '>>=?', '[<>=!+\\-*/%&|^]=', '&&', '\\|\\|', '\\+\\+', '--', '::',
    '\\S'
  ].join('|'), 'g');

  const PUNCT_W = 0.15;   // 괄호 · 세미콜론 같은 기호 가중치

  function markBlanks(text) {
    let s = text;
    for (const re of BLANK_PATTERNS) s = s.replace(re, ` ${BLANK} `);
    return s;
  }

  function tokenize(line) {
    return line.match(TOKEN_RE) || [];
  }

  function isWord(t) { return /^[A-Za-z_$가-힣0-9]/.test(t); }

  // camelCase / snake_case 를 쪼갠 소문자 하위 토큰
  function subTokens(t) {
    if (!/^[A-Za-z_]/.test(t)) return [];
    return t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\s]+/).map(x => x.toLowerCase()).filter(x => x.length > 1);
  }

  let INDEX = null;

  function build(data) {
    const lines = [];
    const df = new Map();
    const snippets = (data.snippets || []).map(s => ({ ...s, kind: 'snippet' }))
      .concat((data.exams || []).map(s => ({ ...s, kind: 'exam' })));
    snippets.forEach((sn, si) => {
      const codeLines = String(sn.code || '').replace(/\r/g, '').split('\n');
      sn._lines = codeLines;
      sn._meta = tokenize([sn.title, sn.topic, sn.desc, (sn.tags || []).join(' ')].join(' ')).filter(isWord).map(t => t.toLowerCase());
      codeLines.forEach((raw, li) => {
        const pos = [];
        const toks = [];
        for (const m of raw.matchAll(TOKEN_RE)) { toks.push(m[0]); pos.push([m.index, m.index + m[0].length]); }
        if (!toks.length) return;
        const low = toks.map(t => t.toLowerCase());
        lines.push({ si, li, raw, toks, low, pos });
        new Set(low).forEach(t => df.set(t, (df.get(t) || 0) + 1));
      });
    });
    INDEX = { snippets, lines, df, N: Math.max(lines.length, 1) };
    return INDEX;
  }

  function idf(t) {
    if (!isWord(t)) return PUNCT_W;
    const d = INDEX.df.get(t) || 0;
    return Math.log(1 + INDEX.N / (1 + d)) + 0.2;
  }

  function tokSim(q, c) {
    if (q === c) return 1;
    if (!isWord(q) || !isWord(c)) return 0;
    if (q.length >= 3 && c.length >= 3 && (c.startsWith(q) || q.startsWith(c))) return 0.6;
    const qs = subTokens(q), cs = subTokens(c);
    if (qs.length && cs.length) {
      const hit = qs.filter(x => cs.includes(x)).length;
      if (hit) return 0.5 * hit / Math.max(qs.length, cs.length);
    }
    return 0;
  }

  /* 쿼리 토큰(빈칸 제외)과 코드 줄 토큰의 가중 LCS.
   * 반환: { score, match: [qi -> ci] } */
  function align(qLow, qW, cLow) {
    const n = qLow.length, m = cLow.length;
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        let best = Math.max(dp[i - 1][j], dp[i][j - 1]);
        const sim = qLow[i - 1] === BLANK ? 0 : tokSim(qLow[i - 1], cLow[j - 1]);
        if (sim > 0) best = Math.max(best, dp[i - 1][j - 1] + sim * qW[i - 1]);
        dp[i][j] = best;
      }
    }
    const match = new Array(n).fill(-1);
    let i = n, j = m;
    while (i > 0 && j > 0) {
      const sim = qLow[i - 1] === BLANK ? 0 : tokSim(qLow[i - 1], cLow[j - 1]);
      if (sim > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + sim * qW[i - 1])) < 1e-9) {
        match[i - 1] = j - 1; i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
    }
    return { score: dp[n][m], match };
  }

  // 빈칸 자리에 해당하는 코드 원문 조각
  function fills(q, match, line) {
    const out = [];
    q.toks.forEach((t, qi) => {
      if (t !== BLANK) return;
      let a = -1, b = line.toks.length;
      for (let k = qi - 1; k >= 0; k--) if (match[k] >= 0) { a = match[k]; break; }
      for (let k = qi + 1; k < q.toks.length; k++) if (match[k] >= 0) { b = match[k]; break; }
      // 빈칸이 줄 끝/처음에 있고 앵커가 없으면 후보를 만들지 않는다
      if (a < 0 && b >= line.toks.length) { out.push(null); return; }
      // 같은 앵커 사이에 빈칸이 여러 개면 나누지 않고 전체 조각을 준다
      out.push(b > a + 1 ? line.raw.slice(line.pos[a + 1][0], line.pos[b - 1][1]).trim() : null);
    });
    return out;
  }

  function prepQueryLine(raw) {
    const todo = raw.match(TODO_LINE);
    const marked = markBlanks(todo ? raw.replace(TODO_LINE, ` ${BLANK} $1`) : raw);
    const toks = tokenize(marked);
    const low = toks.map(t => t === BLANK ? BLANK : t.toLowerCase());
    const w = low.map(t => t === BLANK ? 0 : idf(t));
    const total = w.reduce((a, b) => a + b, 0);
    const words = low.filter(t => t !== BLANK && isWord(t)).length;
    return { raw, toks, low, w, total, words, blanks: toks.filter(t => t === BLANK).length, todo: !!todo };
  }

  function scoreLine(q, line) {
    const { score, match } = align(q.low, q.w, line.low);
    // 코드 줄이 지나치게 길면 약간 감점 (짧고 정확한 줄 우선)
    const extra = Math.max(0, line.toks.length - q.toks.length * 2);
    const s = q.total ? (score / q.total) * (1 / (1 + 0.02 * extra)) : 0;
    return { s, match };
  }

  /* query: 붙여넣은 텍스트 (여러 줄 가능)
   * opts.subject: 과목 필터
   * 반환: { lines: [줄별 후보], snippets: [스니펫 순위] } */
  function search(query, opts = {}) {
    if (!INDEX) build(window.CODE_INDEX || {});
    const subj = opts.subject || '';
    const qLines = String(query).replace(/\r/g, '').split('\n')
      .map(prepQueryLine)
      .filter(q => q.words > 0 || q.blanks > 0)
      .filter(q => q.total > 0);
    if (!qLines.length) return { lines: [], snippets: [] };

    const pool = INDEX.lines.filter(l => {
      const sn = INDEX.snippets[l.si];
      return (!subj || sn.subject === subj) && sn.kind === 'snippet';
    });

    // 스니펫별 누적 점수
    const snScore = new Map();
    const perLine = qLines.map(q => {
      const bestBySn = new Map();
      const hits = [];
      for (const line of pool) {
        const r = scoreLine(q, line);
        if (r.s < 0.25) continue;
        hits.push({ line, s: r.s, match: r.match });
        const prev = bestBySn.get(line.si);
        if (!prev || prev.s < r.s) bestBySn.set(line.si, { s: r.s, li: line.li });
      }
      bestBySn.forEach((v, si) => {
        const e = snScore.get(si) || { sum: 0, lines: new Set() };
        e.sum += v.s * q.total;
        e.lines.add(v.li);
        snScore.set(si, e);
      });
      return { q, hits };
    });

    const qTotal = qLines.reduce((a, q) => a + q.total, 0);
    // 메타(제목·태그·설명) 보너스
    const qWords = new Set(qLines.flatMap(q => q.low.filter(t => t !== BLANK && isWord(t))));
    const snippets = [...snScore.entries()].map(([si, e]) => {
      const sn = INDEX.snippets[si];
      const metaHit = sn._meta.filter(t => qWords.has(t)).length;
      return { sn, score: e.sum / qTotal + Math.min(0.15, 0.03 * metaHit), lines: e.lines };
    }).sort((a, b) => b.score - a.score).slice(0, opts.limit || 30);

    const snRank = new Map(snippets.map((x, i) => [x.sn, x.score]));
    const lines = perLine.map(({ q, hits }) => {
      hits.forEach(h => { h.total = h.s + 0.3 * (snRank.get(INDEX.snippets[h.line.si]) || 0); });
      hits.sort((a, b) => b.total - a.total);
      const seen = new Set();
      const top = [];
      for (const h of hits) {
        const key = h.line.raw.trim();
        if (seen.has(key)) continue;
        seen.add(key);
        top.push({
          sn: INDEX.snippets[h.line.si], li: h.line.li, raw: h.line.raw, s: h.s,
          fills: q.blanks && !q.todo ? fills(q, h.match, h.line) : [],
          // TODO 줄은 설명 주석과 맞춘 뒤 그 아래 코드가 정답이 된다
          after: q.todo ? INDEX.snippets[h.line.si]._lines.slice(h.line.li + 1, h.line.li + 6) : null
        });
        if (top.length >= (opts.perLine || 5)) break;
      }
      return { q, top };
    });

    return { lines, snippets };
  }

  // 단순 키워드 검색(상단 검색창 드롭다운용): 제목·태그·코드 토큰 포함 여부
  function quick(query, limit = 8) {
    if (!INDEX) build(window.CODE_INDEX || {});
    const words = tokenize(query).filter(isWord).map(t => t.toLowerCase());
    if (!words.length) return [];
    return INDEX.snippets.map(sn => {
      const hay = (sn.title + ' ' + (sn.tags || []).join(' ') + ' ' + sn.code).toLowerCase();
      const hit = words.filter(w => hay.includes(w)).length;
      return { sn, hit };
    }).filter(x => x.hit === words.length).slice(0, limit).map(x => x.sn);
  }

  window.CodeSearch = { build, search, quick, markBlanks, BLANK };
})();
