// 코드 설명: explain/*.txt (손으로 쓴 설명) → data/explain.js 로 묶고, 빠진 설명이 없는지 확인한다.
//   node tools/explain.js           묶고 확인 (빠진 것이 있으면 목록을 찍고 실패)
//   node tools/explain.js --check   확인만
// explain/*.txt 형식: '@@ <코드 id>' 줄 다음부터 다음 '@@' 까지가 그 코드의 설명.
//   빈 줄로 문단을 나누고, '- ' 로 시작하면 글머리 목록, 'N. ' 로 시작하면 번호 목록, `…` 는 코드 글자.
//   본문 코드(inline) 는 줄마다 '- `그 줄`: 설명', 괄호 넣기(quiz) 는 문항마다 'N. 설명' 을 쓴다.
// 평가(exam) 는 설명 없이 원래 모습 그대로 두므로 확인에서 뺀다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/index.js'), 'utf8'), ctx);
const { CODE_INDEX } = ctx.window;
const items = CODE_INDEX.snippets;
const byId = Object.fromEntries(items.map(x => [x.id, x]));

const ex = {};
const errs = [];
const dir = path.join(ROOT, 'explain');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
  let id = null;
  fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r/g, '').split('\n').forEach(l => {
    const m = l.match(/^@@\s+(\S+)\s*$/);
    if (m) {
      id = m[1];
      if (id in ex) errs.push(`${f}: 같은 id 가 두 번 나옴: ${id}`);
      if (!byId[id]) errs.push(`${f}: 없는 코드 id: ${id}`);
      ex[id] = [];
    } else if (id) ex[id].push(l);
  });
}
for (const k of Object.keys(ex)) ex[k] = ex[k].join('\n').trim();

const lines = s => s.split('\n');
let missing = 0;
for (const x of items) {
  const t = ex[x.id];
  if (!t) { errs.push(`설명 없음: ${x.id} (${x.title})`); missing++; continue; }
  if (x.kind === 'inline') {
    // 줄마다 '- `토큰`: 설명' 이 있어야 한다
    const have = new Set(lines(t).map(l => (l.match(/^- `(.*?)`\s*[:：]/) || [])[1]).filter(Boolean));
    for (const tok of lines(x.code)) if (!have.has(tok)) errs.push(`${x.id}: 본문 코드 '${tok}' 설명 없음`);
  }
  if (x.kind === 'quiz') {
    const n = lines(x.code).filter(l => /^\d+\./.test(l)).length;
    for (let i = 1; i <= n; i++) if (!new RegExp(`^${i}\\. \\S`, 'm').test(t)) errs.push(`${x.id}: 괄호 넣기 ${i}번 설명 없음`);
  }
}

const done = items.filter(x => ex[x.id]).length;
const kinds = {};
items.forEach(x => { const k = x.kind || 'code'; kinds[k] = kinds[k] || [0, 0]; kinds[k][1]++; if (ex[x.id]) kinds[k][0]++; });
errs.slice(0, 60).forEach(e => console.log(e));
if (errs.length > 60) console.log(`… 외 ${errs.length - 60}건`);
console.log(`설명 ${done}/${items.length} · ` + Object.entries(kinds).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(' · '));

if (!process.argv.includes('--check')) {
  const out = {};
  items.forEach(x => { if (ex[x.id]) out[x.id] = ex[x.id]; });
  fs.writeFileSync(path.join(ROOT, 'data/explain.js'),
    '// 코드마다 붙는 설명 — explain/*.txt 에서 tools/explain.js 로 만든다. 직접 고치지 말고 explain/ 을 고친다.\n' +
    'window.CODE_EXPLAIN = ' + JSON.stringify(out, null, 0) + ';\n');
}
process.exit(errs.length ? 1 : 0);
