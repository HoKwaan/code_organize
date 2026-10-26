// 평가 양식 정답 확인: 모든 빈칸 · TODO 에 정답이 하나씩 붙는지, 남는 정답이 없는지 본다.
//   node tools/check_answers.js            확인만
//   node tools/check_answers.js OUT_DIR    정답을 채운 양식을 OUT_DIR 에 써서 컴파일해 볼 수 있게 한다
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
['data/index.js', 'data/exam_answers.js', 'assets/exam.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const { CODE_INDEX, EXAM_ANSWERS, ExamKit } = ctx.window;

const out = process.argv[2];
let bad = 0;
for (const ex of CODE_INDEX.exams) {
  const qs = ExamKit.attach(ex.id, ExamKit.questions(ex.code));
  const missing = qs.filter(q => !q.ans);
  const unused = (EXAM_ANSWERS[ex.id] || []).filter(a => !qs.some(q => q.ans === a));
  missing.forEach(q => console.log(`${ex.id}: ${q.line + 1}행 정답 없음: ${q.text.split('\n')[0].trim()}`));
  unused.forEach(a => console.log(`${ex.id}: 맞는 문제가 없는 정답: ${a.find}`));
  bad += missing.length + unused.length;
  const s = ExamKit.solved(ex.code, qs);
  if (/_{4,}/.test(s.code.replace(/빈칸\s+_{3,}/g, ''))) { console.log(`${ex.id}: 채운 코드에 빈칸이 남음`); bad++; }
  console.log(`${ex.id}: 빈칸 ${qs.filter(q => !q.todo).length} · TODO ${qs.filter(q => q.todo).length} · 정답 ${qs.filter(q => q.ans).length}`);
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, ex.source), s.code + '\n');
  }
}
if (bad) { console.log(`문제 ${bad}개`); process.exit(1); }
console.log('OK');
