(function () {
  'use strict';

  const DATA = window.CODE_INDEX || { subjects: [], snippets: [], exams: [] };
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const subjById = Object.fromEntries(DATA.subjects.map(s => [s.id, s]));
  const snById = Object.fromEntries(DATA.snippets.map(s => [s.id, s]));
  const examById = Object.fromEntries((DATA.exams || []).map(s => [s.id, s]));

  window.CodeSearch.build(DATA);

  /* ---------- 공통 ---------- */
  function hl(code, lang) {
    if (window.hljs && lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch (e) { /* fallthrough */ }
    }
    return esc(code);
  }

  // 줄 번호 + 강조 줄이 있는 코드 블록. 하이라이트 결과를 줄 단위로 나눈다.
  function codeBlock(sn, marks = new Set(), opts = {}) {
    const lang = sn.lang || (subjById[sn.subject] || {}).lang;
    const html = hl(String(sn.code || ''), lang);
    const lines = splitHighlighted(html);
    const rows = lines.map((h, i) =>
      `<div class="ln${marks.has(i) ? ' mark' : ''}" data-l="${i}"><span class="no">${i + 1}</span><span class="tx">${h || ' '}</span></div>`
    ).join('');
    return `<div class="code${opts.compact ? ' compact' : ''}"><div class="code-h"><span>${esc(lang || '')}</span><button type="button" class="copy" data-copy="${esc(sn.id)}">복사</button></div><pre><code class="hljs">${rows}</code></pre></div>`;
  }

  // hljs 출력의 <span> 이 줄을 넘어가도 깨지지 않게 줄마다 열린 태그를 다시 연다
  function splitHighlighted(html) {
    const out = [];
    let open = [];
    for (const line of html.split('\n')) {
      let s = open.join('') + line;
      const re = /<span[^>]*>|<\/span>/g;
      let m;
      const stack = [...open];
      while ((m = re.exec(line))) {
        if (m[0] === '</span>') stack.pop(); else stack.push(m[0]);
      }
      s += '</span>'.repeat(stack.length);
      open = stack;
      out.push(s);
    }
    return out;
  }

  function snippetsOf(subject) {
    return DATA.snippets.filter(s => s.subject === subject);
  }

  function groupByTopic(list) {
    const g = new Map();
    list.forEach(s => {
      const k = s.topic || '기타';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(s);
    });
    return g;
  }

  function crumbs(parts) {
    return `<div class="crumbs">${parts.map(([href, t]) => href ? `<a href="${href}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join('<span class="sep">/</span>')}</div>`;
  }

  /* ---------- 사이드바 ---------- */
  function renderSide(route) {
    const cur = route.id || '';
    $('#side').innerHTML = `
      <div class="side-sec"><a href="#/search" class="side-link${route.name === 'search' ? ' on' : ''}">🔎 빈칸 검색</a>
      <a href="#/exams" class="side-link${route.name === 'exams' || route.name === 'exam' ? ' on' : ''}">📝 시험 양식 <span class="cnt">${(DATA.exams || []).length}</span></a></div>
      ${DATA.subjects.map(sub => {
        const list = snippetsOf(sub.id);
        const open = route.subject === sub.id;
        return `<details class="side-sec" ${open ? 'open' : ''}>
          <summary><a href="#/s/${sub.id}">${esc(sub.full)}</a><span class="cnt">${list.length}</span></summary>
          ${[...groupByTopic(list)].map(([topic, items]) => `
            <div class="side-topic">${esc(topic)}</div>
            ${items.map(s => `<a class="side-item${s.id === cur ? ' on' : ''}" href="#/c/${encodeURIComponent(s.id)}">${esc(s.title)}</a>`).join('')}
          `).join('') || '<div class="side-empty">아직 정리된 코드 없음</div>'}
        </details>`;
      }).join('')}`;
  }

  /* ---------- 페이지 ---------- */
  function pageHome() {
    const total = DATA.snippets.length;
    return `
      <section class="hero">
        <h1>코드 정리</h1>
        <p>시험 문제의 빈칸 줄이나 TODO 를 그대로 붙여넣으면 정리본에서 관련 코드와 빈칸 정답 후보를 찾아줍니다.</p>
        ${searchBox('', '')}
      </section>
      <section class="cards">
        ${DATA.subjects.map(s => `
          <a class="card" href="#/s/${s.id}">
            <div class="card-t">${esc(s.full)}</div>
            <div class="card-n">${snippetsOf(s.id).length}개 코드</div>
          </a>`).join('')}
        <a class="card" href="#/exams"><div class="card-t">시험 양식</div><div class="card-n">${(DATA.exams || []).length}개</div></a>
      </section>
      ${total ? '' : '<p class="empty">아직 정리된 코드가 없습니다. 자료를 받으면 채워집니다.</p>'}
      ${helpBox()}`;
  }

  function helpBox() {
    return `<details class="help"><summary>검색 방법</summary>
      <ul>
        <li>빈칸은 <code>____</code>, <code>□</code>, <code>( ㉠ )</code>, <code>①</code>, <code>???</code>, <code>...</code>, <code>/* TODO */</code>, <code>// TODO: 설명</code> 처럼 적으면 됩니다.</li>
        <li>여러 줄을 한 번에 붙여넣어도 됩니다. 앞뒤 코드 줄이 문맥이 되어 같은 코드에서 정답을 우선 찾습니다.</li>
        <li>함수명이나 파라미터가 빠져 있어도, 남은 단어(변수·상수·함수)로 비슷한 줄을 찾고 빈칸 자리에 해당하는 부분을 <mark>노란색</mark>으로 보여줍니다.</li>
      </ul></details>`;
  }

  function searchBox(q, subj) {
    return `<form class="bigsearch" id="bigSearch">
      <textarea id="bq" rows="6" spellcheck="false" placeholder="예)  digitalWrite(LED_PIN, ____);\n      // TODO: 버튼 값을 읽어 저장">${esc(q)}</textarea>
      <div class="bs-row">
        <select id="bs">
          <option value="">전체 과목</option>
          ${DATA.subjects.map(s => `<option value="${s.id}"${s.id === subj ? ' selected' : ''}>${esc(s.full)}</option>`).join('')}
        </select>
        <button type="submit" class="btn">검색 (Ctrl+Enter)</button>
      </div>
    </form>`;
  }

  function pageSubject(id) {
    const sub = subjById[id];
    if (!sub) return notFound();
    const list = snippetsOf(id);
    return `${crumbs([['#/', '홈'], [null, sub.full]])}
      <h1>${esc(sub.full)}</h1>
      ${list.length ? [...groupByTopic(list)].map(([topic, items]) => `
        <h2>${esc(topic)}</h2>
        <ul class="list">${items.map(s => `<li><a href="#/c/${encodeURIComponent(s.id)}">${esc(s.title)}</a>${s.source ? `<span class="src">${esc(s.source)}</span>` : ''}</li>`).join('')}</ul>
      `).join('') : '<p class="empty">아직 정리된 코드가 없습니다.</p>'}`;
  }

  function pageSnippet(id, params, isExam) {
    const sn = isExam ? examById[id] : snById[id];
    if (!sn) return notFound();
    const sub = subjById[sn.subject] || { full: sn.subject };
    const marks = new Set((params.get('l') || '').split(',').filter(Boolean).map(Number));
    return `${crumbs([['#/', '홈'], isExam ? ['#/exams', '시험 양식'] : [`#/s/${sn.subject}`, sub.full], [null, sn.title]])}
      <h1>${esc(sn.title)}</h1>
      <div class="meta">${sn.topic ? `<span class="tag">${esc(sn.topic)}</span>` : ''}${sn.source ? `<span class="src">출처: ${esc(sn.source)}</span>` : ''}</div>
      ${sn.desc ? `<div class="desc">${esc(sn.desc).replace(/\n/g, '<br>')}</div>` : ''}
      ${codeBlock(sn, marks)}
      ${sn.tags && sn.tags.length ? `<div class="tags">${sn.tags.map(t => `<a class="tag" href="#/search?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
      ${isExam ? `<p><a class="btn" href="#/search?q=${encodeURIComponent(sn.code)}&s=${sn.subject}">이 문제 전체로 검색</a></p>` : ''}`;
  }

  function pageExams() {
    const list = DATA.exams || [];
    return `${crumbs([['#/', '홈'], [null, '시험 양식']])}
      <h1>시험 양식</h1>
      ${list.length ? DATA.subjects.map(sub => {
        const items = list.filter(e => e.subject === sub.id);
        return items.length ? `<h2>${esc(sub.full)}</h2><ul class="list">${items.map(e => `<li><a href="#/e/${encodeURIComponent(e.id)}">${esc(e.title)}</a>${e.source ? `<span class="src">${esc(e.source)}</span>` : ''}</li>`).join('')}</ul>` : '';
      }).join('') : '<p class="empty">아직 시험 양식이 없습니다.</p>'}`;
  }

  function pageSearch(params) {
    const q = params.get('q') || '';
    const subj = params.get('s') || '';
    let body = '';
    if (q.trim()) {
      const r = window.CodeSearch.search(q, { subject: subj });
      body = renderResults(r);
    }
    return `${crumbs([['#/', '홈'], [null, '빈칸 검색']])}
      <h1>빈칸 검색</h1>
      ${searchBox(q, subj)}
      ${q.trim() ? '' : helpBox()}
      ${body}`;
  }

  function renderFillLine(raw, fills) {
    if (!fills || !fills.some(Boolean)) return esc(raw);
    // 정답 후보 조각을 원문 줄에서 찾아 강조
    let html = esc(raw);
    fills.filter(Boolean).forEach(f => {
      const e = esc(f);
      const i = html.indexOf(e);
      if (i >= 0) html = html.slice(0, i) + `<mark>${e}</mark>` + html.slice(i + e.length);
    });
    return html;
  }

  function renderResults(r) {
    if (!r.lines.length) return '<p class="empty">검색할 내용이 없습니다.</p>';
    const interesting = r.lines.filter(x => x.q.blanks || x.q.todo);
    const show = interesting.length ? interesting : r.lines;
    const lineHtml = show.map(({ q, top }) => `
      <div class="qline">
        <div class="qline-q"><code>${esc(q.raw.trim())}</code></div>
        ${top.length ? `<ol class="cands">${top.map(c => `
          <li>
            ${c.fills.some(Boolean) ? `<div class="fill">빈칸 → ${c.fills.map(f => f ? `<code class="ans">${esc(f)}</code>` : '<span class="na">?</span>').join(' , ')}</div>` : ''}
            <a class="cand" href="#/c/${encodeURIComponent(c.sn.id)}?l=${c.li}"><code>${renderFillLine(c.raw.trim(), c.fills)}</code></a>
            ${c.after && c.after.some(l => l.trim()) ? `<pre class="after"><code>${esc(c.after.join('\n').replace(/\s+$/, ''))}</code></pre>` : ''}
            <div class="cand-m">${esc((subjById[c.sn.subject] || {}).name || '')} · ${esc(c.sn.title)} · ${Math.round(c.s * 100)}%</div>
          </li>`).join('')}</ol>` : '<div class="empty sm">비슷한 줄을 찾지 못했습니다.</div>'}
      </div>`).join('');

    const snHtml = r.snippets.slice(0, 10).map(x => `
      <div class="hit">
        <div class="hit-h"><a href="#/c/${encodeURIComponent(x.sn.id)}?l=${[...x.lines].join(',')}">${esc(x.sn.title)}</a>
          <span class="cand-m">${esc((subjById[x.sn.subject] || {}).name || '')}${x.sn.topic ? ' · ' + esc(x.sn.topic) : ''} · ${Math.round(Math.min(1, x.score) * 100)}%</span></div>
        ${codeBlock(x.sn, x.lines, { compact: true })}
      </div>`).join('');

    return `<h2>${interesting.length ? '빈칸 · TODO 줄별 후보' : '줄별 후보'}</h2>${lineHtml}
      <h2>관련 코드 전체</h2>${snHtml || '<p class="empty">관련 코드가 없습니다.</p>'}`;
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
    if (!seg.length) return { name: 'home', params };
    if (seg[0] === 's') return { name: 'subject', subject: seg[1], params };
    if (seg[0] === 'c') return { name: 'snippet', id: seg[1], subject: (snById[seg[1]] || {}).subject, params };
    if (seg[0] === 'e') return { name: 'exam', id: seg[1], params };
    if (seg[0] === 'exams') return { name: 'exams', params };
    if (seg[0] === 'search') return { name: 'search', params };
    return { name: '404', params };
  }

  function render() {
    const r = parse();
    let html;
    switch (r.name) {
      case 'home': html = pageHome(); break;
      case 'subject': html = pageSubject(r.subject); break;
      case 'snippet': html = pageSnippet(r.id, r.params, false); break;
      case 'exam': html = pageSnippet(r.id, r.params, true); break;
      case 'exams': html = pageExams(); break;
      case 'search': html = pageSearch(r.params); break;
      default: html = notFound();
    }
    const main = $('#main');
    main.innerHTML = html;
    renderSide(r);
    closeSide();
    const mark = main.querySelector('.ln.mark');
    if (mark && r.name === 'snippet') mark.scrollIntoView({ block: 'center' });
    else window.scrollTo(0, 0);
    bindPage();
  }

  function bindPage() {
    const form = $('#bigSearch');
    if (form) {
      const go = e => {
        if (e) e.preventDefault();
        const q = $('#bq').value;
        const s = $('#bs').value;
        location.hash = `#/search?q=${encodeURIComponent(q)}${s ? '&s=' + s : ''}`;
      };
      form.addEventListener('submit', go);
      $('#bq').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(e); });
      $('#bs').addEventListener('change', () => { if ($('#bq').value.trim()) go(); });
    }
  }

  /* ---------- 전역 이벤트 ---------- */
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#q').value;
    if (q.trim()) location.hash = `#/search?q=${encodeURIComponent(q)}`;
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
    const sn = snById[b.dataset.copy] || examById[b.dataset.copy];
    if (!sn) return;
    navigator.clipboard.writeText(sn.code).then(() => {
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
