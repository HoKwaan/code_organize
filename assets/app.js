(function () {
  'use strict';

  const DATA = window.CODE_INDEX || { subjects: [], snippets: [], exams: [] };
  DATA.snippets.forEach(sn => { sn.day = sn.day || 0; sn.period = sn.period || 0; });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const subjById = Object.fromEntries(DATA.subjects.map(s => [s.id, s]));
  const snById = Object.fromEntries(DATA.snippets.map(s => [s.id, s]));
  const examById = Object.fromEntries((DATA.exams || []).map(s => [s.id, s]));
  const KIND_LABEL = { fill: '빈칸 채우기', quiz: '괄호 넣기', inline: '본문 코드', src: '소스 파일', pdf: 'PDF 슬라이드', table: '표', ref: '보충', api: '강의 코드 모음', exam: '양식' };
  const kindOf = sn => (sn.kind === 'ref' && sn.refs ? 'api' : sn.kind);
  const EXPLAIN = window.CODE_EXPLAIN || {};

  window.CodeSearch.build(DATA);

  /* ---------- 묶음: 과목 → Day → 교시 ---------- */
  function groupKey(sn) { return `${sn.day}-${sn.period}`; }
  const GROUPS = {};       // subject -> [{key, day, period, topic, items}]
  DATA.snippets.forEach(sn => {
    const list = GROUPS[sn.subject] = GROUPS[sn.subject] || [];
    const key = groupKey(sn);
    let g = list.find(x => x.key === key);
    if (!g) { g = { key, day: sn.day, period: sn.period, topic: sn.topic, items: [] }; list.push(g); }
    g.items.push(sn);
  });
  Object.values(GROUPS).forEach(list => list.sort((a, b) => (a.day || 99) - (b.day || 99) || a.period - b.period));
  function groupLabel(g) {
    if (!g.day) return 'API 모음';
    if (g.period === 99) return '소스 파일 (src/)';
    if (!g.period) return '개요';
    return g.topic.replace(/^Day \d+ · /, '');
  }
  function groupHref(subject, g) { return `#/t/${subject}/${g.day}/${g.period}`; }

  /* ---------- 코드 블록 ---------- */
  function hl(code, lang) {
    if (window.hljs && lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch (e) { /* fallthrough */ }
    }
    return esc(code);
  }

  // hljs 출력의 <span> 이 줄을 넘어가도 깨지지 않게 줄마다 열린 태그를 다시 연다
  function splitHighlighted(html) {
    const out = [];
    let open = [];
    for (const line of html.split('\n')) {
      const stack = [...open];
      const re = /<span[^>]*>|<\/span>/g;
      let m;
      while ((m = re.exec(line))) { if (m[0] === '</span>') stack.pop(); else stack.push(m[0]); }
      out.push(open.join('') + line + '</span>'.repeat(stack.length));
      open = stack;
    }
    return out;
  }

  function langOf(sn) { return sn.lang || (subjById[sn.subject] || {}).lang; }

  function codeBlock(code, lang, opts = {}) {
    const marks = opts.marks || new Set();
    const lines = splitHighlighted(hl(String(code || ''), lang));
    const rows = lines.map((h, i) =>
      `<div class="ln${marks.has(i) ? ' mark' : ''}" data-l="${i}"><span class="no">${i + 1}</span><span class="tx">${h || ' '}</span></div>`).join('');
    const label = opts.label ? `<span>${esc(opts.label)}</span>` : `<span>${esc(lang || '')}</span>`;
    return `<div class="code${opts.compact ? ' compact' : ''}"><div class="code-h">${label}<button type="button" class="copy">복사</button></div><pre><code class="hljs">${rows}</code></pre><textarea class="raw" hidden>${esc(code)}</textarea></div>`;
  }

  // 설명 글: 빈 줄로 문단, '- ' 글머리 목록, 'N. ' 번호 목록, `…` 코드 글자 (tools/explain.js 참고)
  function explainBox(id) {
    const t = EXPLAIN[id];
    if (!t) return '';
    const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
    let out = '', list = null;
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    t.split('\n').forEach(l => {
      const b = l.match(/^\s*- (.*)$/), n = l.match(/^(\d+)\. (.*)$/);
      if (b || n) {
        const tag = b ? 'ul' : 'ol';
        if (list !== tag) { close(); out += `<${tag}>`; list = tag; }
        out += n ? `<li value="${n[1]}">${inl(n[2])}</li>` : `<li>${inl(b[1])}</li>`;
      } else if (!l.trim()) close();
      else { close(); out += `<p>${inl(l)}</p>`; }
    });
    close();
    return `<div class="explain"><div class="explain-h">설명</div>${out}</div>`;
  }

  function blankLines(sn) {
    const s = new Set();
    if (sn.blank) sn.blank.split('\n').forEach((l, i) => { if (/_{3,}/.test(l)) s.add(i); });
    return s;
  }

  function snippetCard(sn, opts = {}) {
    const lang = langOf(sn);
    const marks = opts.marks || blankLines(sn);
    const kind = sn.kind ? `<span class="tag k-${sn.kind}">${KIND_LABEL[kindOf(sn)] || sn.kind}</span>` : '';
    const head = opts.noHead ? '' : `<div class="card-h"><a href="#/c/${enc(sn.id)}" class="card-title">${esc(sn.title)}</a>${kind}</div>`;
    let extra = '';
    if (sn.kind === 'fill' || sn.kind === 'quiz') {
      extra += `<details class="sub"><summary>빈칸 원본 보기</summary>${codeBlock(sn.blank, sn.kind === 'quiz' ? 'text' : lang, { label: '빈칸 원본', compact: true })}</details>`;
      if (sn.answer) extra += `<details class="sub"><summary>강의 정답 원문</summary>${codeBlock(sn.answer, sn.kind === 'quiz' ? 'text' : lang, { label: '정답', compact: true })}</details>`;
    }
    if (sn.refs) extra += `<details class="sub" open><summary>줄마다 강의 출처</summary><ol class="refs">${sn.refs.map(([li, id, l]) => {
      const o = snById[id];
      return o ? `<li value="${li + 1}"><a href="#/c/${enc(id)}?l=${l}">${esc(snLabel(o))}</a> <span class="muted">${l + 1}행</span></li>` : '';
    }).join('')}</ol></details>`;
    if (sn.output) extra += `<details class="sub"><summary>기대 출력</summary>${codeBlock(sn.output, 'text', { label: '출력', compact: true })}</details>`;
    const label = sn.kind === 'fill' ? '완성 코드 (빈칸 자리 노란 줄)' : sn.kind === 'quiz' ? '정답을 [ ] 안에 채운 문장' : null;
    return `<section class="snip" id="sn-${esc(sn.id)}">${head}
      ${sn.desc ? `<p class="desc">${esc(sn.desc)}</p>` : ''}
      ${codeBlock(sn.code, sn.kind === 'quiz' || sn.kind === 'inline' ? 'text' : lang, { marks, label, compact: opts.compact })}
      ${explainBox(sn.id)}
      ${extra}
      <div class="src">${sn.url ? `<a href="${esc(sn.url)}" target="_blank" rel="noopener">${esc(sn.source || '원본')}</a>` : esc(sn.source || '')}</div>
    </section>`;
  }

  function crumbs(parts) {
    return `<div class="crumbs">${parts.map(([href, t]) => href ? `<a href="${href}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join('<span class="sep">/</span>')}</div>`;
  }

  /* ---------- 사이드바 ---------- */
  function renderSide(route) {
    const cur = route.path;
    const link = (href, text, cnt) => `<a class="side-item${cur === href ? ' on' : ''}" href="${href}">${esc(text)}${cnt != null ? `<span class="cnt">${cnt}</span>` : ''}</a>`;
    $('#side').innerHTML = `
      <div class="side-sec">
        <a href="#/search" class="side-link${route.name === 'search' ? ' on' : ''}">🔎 빈칸 검색</a>
        ${(DATA.exams || []).map(e => `<a href="#/e/${e.id}" class="side-link${cur === '#/e/' + e.id ? ' on' : ''}">📝 ${esc(e.title.replace('양식', '양식'))}</a>`).join('')}
      </div>
      ${DATA.subjects.map(sub => {
        const groups = GROUPS[sub.id] || [];
        const open = route.subject === sub.id;
        const days = [...new Set(groups.map(g => g.day))];
        return `<details class="side-sec" ${open ? 'open' : ''}>
          <summary><a href="#/s/${sub.id}">${esc(sub.full)}</a></summary>
          ${days.map(d => {
            const gs = groups.filter(g => g.day === d);
            const dopen = open && route.day === d;
            return `<details class="side-day" ${dopen ? 'open' : ''}><summary>${d ? `Day ${d}` : 'API 모음'}</summary>
              ${gs.map(g => link(groupHref(sub.id, g), groupLabel(g), g.items.length)).join('')}</details>`;
          }).join('')}
        </details>`;
      }).join('')}`;
  }

  /* ---------- 페이지 ---------- */
  function searchBox(q, subj) {
    return `<form class="bigsearch" id="bigSearch">
      <textarea id="bq" rows="6" spellcheck="false" placeholder="검색을 원하는 부분을 넣으세요.">${esc(q)}</textarea>
      <div class="bs-row">
        <select id="bs" aria-label="과목">
          <option value="">전체 과목</option>
          ${DATA.subjects.map(s => `<option value="${s.id}"${s.id === subj ? ' selected' : ''}>${esc(s.full)}</option>`).join('')}
        </select>
        <button type="submit" class="btn">검색 (Ctrl+Enter)</button>
      </div>
    </form>`;
  }

  function helpBox(open) {
    return `<details class="help"${open ? ' open' : ''}><summary>검색 방법</summary>
      <ul>
        <li>빈칸은 <code>______</code>, <code>□</code>, <code>( ㉠ )</code>, <code>???</code>, <code>...</code> 처럼 그대로 붙여넣으면 됩니다.</li>
        <li>줄 끝의 설명 주석(<code>// ② 빨강 LED 핀을 출력으로</code>)도 같이 넣으세요. 설명이 비슷한 코드와 괄호 넣기 정답을 더 앞에 보여줍니다.</li>
        <li>함수 이름이나 파라미터가 빠져 있어도 남은 부분으로 같은 모양의 줄을 찾고, 빈칸 자리에 들어간 코드를 <mark>후보</mark>로 묶어 보여줍니다. 숫자는 정리본에서 그 후보가 쓰인 횟수입니다.</li>
        <li><code>// TODO</code> 설명 여러 줄을 붙여넣으면, 설명에 나온 함수 · 변수 이름이 많이 들어 있는 예제 코드를 찾아줍니다.</li>
        <li>앞뒤 코드 줄을 같이 붙여넣으면 같은 예제에서 나온 후보가 더 앞에 옵니다.</li>
      </ul></details>`;
  }

  function pageHome() {
    const n = DATA.snippets.length;
    return `
      <section class="hero">
        <h1>코드 정리 · 빈칸 검색</h1>
        <p>MCU · Linux · Embedded_IO 강의 자료의 코드 ${n}개를 모았습니다.</p>
        ${searchBox('', '')}
        ${helpBox(false)}
      </section>
      <h2>양식</h2>
      <section class="cards">
        ${(DATA.exams || []).map(e => `<a class="card" href="#/e/${e.id}"><div class="card-t">${esc(e.title)}</div><div class="card-n">${esc(e.source)} · 바로 찾기</div></a>`).join('')}
      </section>
      <h2>과목</h2>
      <section class="cards">
        ${DATA.subjects.map(s => `<a class="card" href="#/s/${s.id}"><div class="card-t">${esc(s.full)}</div><div class="card-n">${DATA.snippets.filter(x => x.subject === s.id).length}개 코드 · Day 1~${s.days}</div></a>`).join('')}
      </section>
      <p class="muted">데이터 갱신: ${esc(DATA.built || '')}</p>`;
  }

  function pageSubject(id) {
    const sub = subjById[id];
    if (!sub) return notFound();
    const groups = GROUPS[id] || [];
    const days = [...new Set(groups.map(g => g.day))];
    return `${crumbs([['#/', '홈'], [null, sub.full]])}
      <h1>${esc(sub.full)}</h1>
      ${days.map(d => `<h2>${d ? `Day ${d}` : 'API 모음 (강의 코드에서 모은 줄 · 자료에 없는 보충)'}</h2>
        <ul class="list">${groups.filter(g => g.day === d).map(g => {
          const kinds = {};
          g.items.forEach(x => { const k = kindOf(x) || 'code'; kinds[k] = (kinds[k] || 0) + 1; });
          const sum = Object.entries(kinds).map(([k, c]) => `${KIND_LABEL[k] || '예제'} ${c}`).join(' · ');
          return `<li><a href="${groupHref(id, g)}">${esc(groupLabel(g))}</a><span class="src">${sum}</span></li>`;
        }).join('')}</ul>`).join('')}`;
  }

  function pageGroup(subject, day, period) {
    const sub = subjById[subject];
    const g = (GROUPS[subject] || []).find(x => x.day === day && x.period === period);
    if (!sub || !g) return notFound();
    const toc = g.items.map(sn => `<li><a href="#/c/${enc(sn.id)}">${esc(sn.title)}</a>${sn.kind ? ` <span class="tag k-${sn.kind}">${KIND_LABEL[kindOf(sn)]}</span>` : ''}</li>`).join('');
    return `${crumbs([['#/', '홈'], [`#/s/${subject}`, sub.full], [null, day ? `Day ${day}` : 'API 모음'], [null, groupLabel(g)]])}
      <h1>${esc(day ? `Day ${day} · ${groupLabel(g)}` : groupLabel(g))}</h1>
      <details class="toc"><summary>${day ? '이 교시' : '이 묶음'} 코드 ${g.items.length}개</summary><ol>${toc}</ol></details>
      ${g.items.map(sn => snippetCard(sn)).join('')}`;
  }

  function pageSnippet(id, params) {
    const sn = snById[id];
    if (!sn) return notFound();
    const sub = subjById[sn.subject] || { full: sn.subject };
    const g = (GROUPS[sn.subject] || []).find(x => x.key === groupKey(sn));
    const l = params.get('l');
    const marks = l != null ? new Set(l.split(',').filter(Boolean).map(Number)) : undefined;
    return `${crumbs([['#/', '홈'], [`#/s/${sn.subject}`, sub.full], g ? [groupHref(sn.subject, g), (sn.day ? `Day ${sn.day} · ` : '') + groupLabel(g)] : [null, ''], [null, sn.title]])}
      <h1>${esc(sn.title)}</h1>
      ${snippetCard(sn, { marks, noHead: true })}`;
  }

  /* ---------- 시험 양식 ---------- */
  // 양식의 빈칸 · TODO 와 data/exam_answers.js 의 정답
  const EXAM_QS = {};
  function examQs(ex) {
    return EXAM_QS[ex.id] || (EXAM_QS[ex.id] = window.ExamKit.attach(ex.id, window.ExamKit.questions(ex.code)));
  }

  function examAnswer(q, lang) {
    const a = q.ans;
    if (!a) return '<div class="q-ans"><p class="muted">정리된 정답이 없습니다. 아래 버튼으로 비슷한 코드를 찾아보세요.</p></div>';
    const why = a.why ? `<p class="q-why">${esc(a.why)}</p>` : '';
    if (q.todo) return `<div class="q-ans">${codeBlock(a.code, lang, { label: '정답 코드 (TODO 설명 아래에 넣는다)', compact: true })}${why}</div>`;
    const alt = a.alt ? ` <span class="muted">같이 맞음: ${a.alt.map(x => `<code>${esc(x)}</code>`).join(', ')}</span>` : '';
    return `<div class="q-ans"><div class="q-key">정답 <code class="ans">${esc(a.answer)}</code>${alt}</div>${why}</div>`;
  }

  function examQuestion(q, n, lang) {
    const text = q.text.split('\n').map(l => l.trim().replace(/\s{3,}/g, '   ')).join('\n');
    return `<li class="exam-q" data-n="${n}">
      <div class="q-head"><span class="q-no">${n + 1}</span><code>${esc(text)}</code><span class="q-line">${q.line + 1}행</span></div>
      <button type="button" class="q-show">정답 보기</button>
      ${examAnswer(q, lang)}
      <button type="button" class="q-btn" data-n="${n}">정리본에서 비슷한 코드 찾기</button>
      <div class="q-res" hidden></div></li>`;
  }

  function pageExam(id) {
    const ex = examById[id];
    if (!ex) return notFound();
    const qs = examQs(ex);
    const marks = new Set();
    qs.forEach(q => { for (let k = q.line; k <= q.end; k++) marks.add(k); });
    const sol = window.ExamKit.solved(ex.code, qs);
    const nb = qs.filter(q => !q.todo).length, nt = qs.filter(q => q.todo).length;
    return `${crumbs([['#/', '홈'], [null, '양식'], [null, ex.title]])}
      <h1>${esc(ex.title)}</h1>
      <p class="muted">${esc(ex.source)} · 빈칸 ${nb}곳 · TODO ${nt}곳. 문제마다 정답이 하나씩 있습니다. 정답은 양식의 [N단계] 기대값이 나오도록 맞춘 답이고, 정답을 채운 전체 코드는 맨 아래에 있습니다.</p>
      <div class="exam-actions"><button type="button" class="btn" id="hideAns"></button></div>
      <ol class="exam-qs">${qs.map((q, n) => examQuestion(q, n, ex.lang)).join('')}</ol>
      <h2>양식 전체 코드</h2>
      <details class="sub" open><summary>정답을 채운 전체 코드 (채운 줄은 노란 줄)</summary>${codeBlock(sol.code, ex.lang, { marks: sol.marks, label: ex.source + ' · 정답' })}</details>
      <details class="sub"><summary>빈칸 양식 원본</summary>${codeBlock(ex.code, ex.lang, { marks, label: ex.source })}</details>`;
  }

  function solveExamQuestion(ex, q, box) {
    const res = window.CodeSearch.search(q.text, { subject: ex.subject });
    box.innerHTML = renderItems(res.items) + `<p class="q-more"><a href="#/search?q=${enc(q.text)}&s=${ex.subject}">검색 화면에서 열기</a></p>`;
    box.hidden = false;
  }

  // 검색어에 양식의 빈칸 줄이나 TODO 첫 줄이 그대로 들어 있으면 그 문제의 정답을 돌려준다
  function examKey(s) {
    return s.replace(/\/\/.*$|\/\*.*?(\*\/|$)/gm, '')
      .replace(/_{3,}|[□■▢☐]+|\?{2,}|\(\s*[①-⑳㉠-㉭]\s*\)/g, '_')
      .replace(/\s+/g, '');
  }

  function examExact(text) {
    const hits = [];
    const lines = text.split('\n');
    const keys = new Set(lines.map(examKey).filter(k => k.length > 3));
    const todos = lines.map(l => l.trim().replace(/\s+/g, ' ')).filter(l => /TODO\s*\d+\s*:/.test(l));
    (DATA.exams || []).forEach(ex => examQs(ex).forEach((q, n) => {
      if (!q.ans) return;
      const hit = q.todo
        ? todos.some(t => t === q.text.split('\n')[0].trim().replace(/\s+/g, ' '))
        : keys.has(examKey(q.text));
      if (hit) hits.push({ ex, q, n });
    }));
    return hits;
  }

  function renderExact(hits) {
    if (!hits.length) return '';
    return `<div class="exact"><div class="exact-t">양식 문제의 정답</div>${hits.map(h => `
      <div class="exact-q"><a href="#/e/${enc(h.ex.id)}" class="muted">${esc(h.ex.title)} · 문제 ${h.n + 1} (${h.q.line + 1}행)</a>
        ${h.q.todo ? '' : `<div class="qline-q"><code>${esc(h.q.text.trim())}</code></div>`}
        ${examAnswer(h.q, h.ex.lang)}</div>`).join('')}</div>`;
  }

  /* ---------- 검색 ---------- */
  function pageSearch(params) {
    const q = params.get('q') || '';
    const subj = params.get('s') || '';
    let body = '';
    if (q.trim()) {
      const t0 = performance.now();
      const r = window.CodeSearch.search(q, { subject: subj });
      body = renderExact(examExact(q)) + `<p class="muted">${Math.round(performance.now() - t0)} ms</p>` + renderItems(r.items) + renderRelated(r.related);
    }
    return `${crumbs([['#/', '홈'], [null, '빈칸 검색']])}
      <h1>빈칸 검색</h1>
      ${searchBox(q, subj)}
      ${helpBox(!q.trim())}
      ${body}`;
  }

  function lineLink(sn, li) {
    return sn.kind === 'exam' ? `#/e/${enc(sn.id)}` : `#/c/${enc(sn.id)}?l=${li}`;
  }

  function snLabel(sn) {
    const sub = subjById[sn.subject] || {};
    if (sn.kind === 'exam') return `${sub.name || ''} · 양식 (제공 코드)`;
    return `${sub.name || ''}${sn.day ? ` · Day ${sn.day}` : ''} · ${sn.title}`;
  }

  function markFill(raw, fills) {
    let html = esc(raw);
    (fills || []).filter(Boolean).forEach(f => {
      const e = esc(f);
      const i = html.indexOf(e);
      if (i >= 0) html = html.slice(0, i) + `<mark>${e}</mark>` + html.slice(i + e.length);
    });
    return html;
  }

  function renderItems(items) {
    if (!items.length) return '<p class="empty">검색할 내용이 없습니다.</p>';
    const blanky = items.filter(it => (it.type === 'line' && it.q.blanks) || it.type === 'todo');
    const show = blanky.length ? blanky : items;
    return show.map(it => it.type === 'line' ? renderLine(it) : renderTodo(it)).join('');
  }

  function renderLine(it) {
    const groups = it.groups.map((g, gi) => `
      <li class="grp${gi === 0 ? ' best' : ''}">
        ${it.q.blanks ? `<div class="fill">${g.fills.map(f => f ? `<code class="ans">${esc(f)}</code>` : '<span class="na">?</span>').join(' <span class="sep">,</span> ')}
          <span class="cnt">${g.count}곳</span>${g.fromHint ? '<span class="tag k-quiz">괄호 넣기 정답과 같음</span>' : ''}</div>` : ''}
        ${g.examples.map(h => `<a class="cand" href="${lineLink(h.sn, h.line.li)}"><code>${markFill(h.line.raw.trim(), h.rawFills)}</code><span class="cand-m">${esc(snLabel(h.sn))}</span></a>`).join('')}
      </li>`).join('');
    const hints = it.hints.length ? `<div class="hints"><div class="hints-t">비슷한 설명의 괄호 넣기</div>${it.hints.map(h =>
      `<a class="hint" href="#/c/${enc(h.sn.id)}?l=${h.li}">${esc(h.raw).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>')}<span class="cand-m">${esc(snLabel(h.sn))}</span></a>`).join('')}</div>` : '';
    return `<div class="qline">
      <div class="qline-q"><code>${esc(it.q.raw.trim())}</code></div>
      ${groups ? `<ol class="grps">${groups}</ol>` : '<div class="empty sm">비슷한 줄을 찾지 못했습니다. 설명 주석을 빼거나 앞뒤 줄을 같이 넣어 보세요.</div>'}
      ${hints}
    </div>`;
  }

  function renderTodo(it) {
    return `<div class="qline todo">
      <div class="qline-q"><pre>${esc(it.lines.map(l => l.trim()).join('\n'))}</pre></div>
      ${it.ids.length ? `<div class="muted sm">설명 속 이름: ${it.ids.map(t => `<code>${esc(t)}</code>`).join(' ')}</div>` : ''}
      ${it.top.length ? it.top.map(t => `<div class="hit">
          <div class="hit-h"><a href="#/c/${enc(t.sn.id)}?l=${[...t.marks].join(',')}">${esc(snLabel(t.sn))}</a></div>
          ${codeBlock(t.sn.code, langOf(t.sn), { marks: t.marks, compact: true })}
        </div>`).join('') : '<div class="empty sm">관련 코드를 찾지 못했습니다.</div>'}
    </div>`;
  }

  function renderRelated(rel) {
    if (!rel || !rel.length) return '';
    return `<h2>붙여넣은 코드와 비슷한 예제</h2><ul class="list">${rel.filter(r => r.sn.kind !== 'exam').map(r =>
      `<li><a href="#/c/${enc(r.sn.id)}">${esc(snLabel(r.sn))}</a></li>`).join('')}</ul>`;
  }

  function notFound() {
    return '<h1>찾을 수 없음</h1><p><a href="#/">홈으로</a></p>';
  }

  /* ---------- 라우터 ---------- */
  function parse() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const params = new URLSearchParams(qs || '');
    const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
    const r = { params, path: '#' + path };
    if (!seg.length) return Object.assign(r, { name: 'home' });
    if (seg[0] === 's') return Object.assign(r, { name: 'subject', subject: seg[1] });
    if (seg[0] === 't') return Object.assign(r, { name: 'group', subject: seg[1], day: +seg[2], period: +seg[3] });
    if (seg[0] === 'c') {
      const sn = snById[seg[1]] || {};
      return Object.assign(r, { name: 'snippet', id: seg[1], subject: sn.subject, day: sn.day, path: sn.subject ? `#/t/${sn.subject}/${sn.day}/${sn.period}` : r.path });
    }
    if (seg[0] === 'e') return Object.assign(r, { name: 'exam', id: seg[1] });
    if (seg[0] === 'search') return Object.assign(r, { name: 'search' });
    return Object.assign(r, { name: '404' });
  }

  function render() {
    const r = parse();
    let html;
    switch (r.name) {
      case 'home': html = pageHome(); break;
      case 'subject': html = pageSubject(r.subject); break;
      case 'group': html = pageGroup(r.subject, r.day, r.period); break;
      case 'snippet': html = pageSnippet(r.id, r.params); break;
      case 'exam': html = pageExam(r.id); break;
      case 'search': html = pageSearch(r.params); break;
      default: html = notFound();
    }
    const main = $('#main');
    main.innerHTML = html;
    renderSide(r);
    closeSide();
    const mark = main.querySelector('.ln.mark');
    if (mark && r.name === 'snippet' && r.params.get('l') != null) mark.scrollIntoView({ block: 'center' });
    else window.scrollTo(0, 0);
    bindPage(r);
  }

  function bindPage(r) {
    const form = $('#bigSearch');
    if (form) {
      const go = e => {
        if (e) e.preventDefault();
        const q = $('#bq').value;
        const s = $('#bs').value;
        location.hash = `#/search?q=${enc(q)}${s ? '&s=' + s : ''}`;
      };
      form.addEventListener('submit', go);
      $('#bq').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(e); });
      $('#bs').addEventListener('change', () => { if ($('#bq').value.trim()) go(); });
    }
    if (r.name === 'exam') {
      const ex = examById[r.id];
      if (!ex) return;
      const qs = examQs(ex);
      const list = $('.exam-qs');
      const hideBtn = $('#hideAns');
      const setHide = on => {
        list.classList.toggle('hide-ans', on);
        list.querySelectorAll('.exam-q.shown').forEach(li => li.classList.remove('shown'));
        hideBtn.textContent = on ? '정답 모두 보기' : '정답 가리고 풀어 보기';
        try { localStorage.setItem('co.hideAns', on ? '1' : ''); } catch (e) { /* ignore */ }
      };
      let hidden = false;
      try { hidden = localStorage.getItem('co.hideAns') === '1'; } catch (e) { /* ignore */ }
      setHide(hidden);
      hideBtn.addEventListener('click', () => setHide(!list.classList.contains('hide-ans')));
      document.querySelectorAll('.q-show').forEach(b => b.addEventListener('click', () => b.closest('.exam-q').classList.add('shown')));
      document.querySelectorAll('.q-btn').forEach(b => b.addEventListener('click', () => {
        const n = +b.dataset.n;
        const box = b.nextElementSibling;
        if (!box.hidden) { box.hidden = true; return; }
        if (!box.innerHTML) {
          box.innerHTML = '<p class="muted">찾는 중…</p>';
          box.hidden = false;
          setTimeout(() => solveExamQuestion(ex, qs[n], box), 10);
        } else box.hidden = false;
      }));
    }
  }

  /* ---------- 전역 이벤트 ---------- */
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#q').value;
    if (q.trim()) location.hash = `#/search?q=${enc(q)}`;
  });

  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault();
      ($('#bq') || $('#q')).focus();
    }
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('.copy');
    if (!b) return;
    const raw = b.closest('.code').querySelector('textarea.raw').value;
    navigator.clipboard.writeText(raw).then(() => {
      b.textContent = '복사됨';
      setTimeout(() => { b.textContent = '복사'; }, 1200);
    }).catch(() => {});
  });

  function closeSide() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }
  $('#menuBtn').addEventListener('click', () => {
    const open = $('#side').classList.toggle('open');
    $('#scrim').hidden = !open;
  });
  $('#scrim').addEventListener('click', closeSide);

  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('co.theme', root.dataset.theme); } catch (e) { /* ignore */ }
  });

  window.addEventListener('hashchange', render);
  render();
})();
