/* 평가 양식 도우미
 *  - questions(code): 양식에서 빈칸 줄과 TODO 설명 묶음을 문제 단위로 뽑는다.
 *  - attach(id, qs): data/exam_answers.js 의 정답을 문제에 하나씩 붙인다 (q.ans).
 *  - solved(code, qs): 빈칸을 정답으로 채우고 TODO 설명 아래에 정답 코드를 넣은 전체 코드와,
 *    채운 줄 번호(marks)를 돌려준다.
 */
(function (root) {
  'use strict';

  const BLANK = /_{4,}/;

  function questions(code) {
    const L = code.split('\n');
    const qs = [];
    for (let i = 0; i < L.length; i++) {
      if (BLANK.test(L[i]) && !/빈칸\s+_{3,}/.test(L[i])) qs.push({ line: i, end: i, text: L[i], label: (L[i].match(/[①-⑳]/) || [''])[0] });
      if (/TODO\s*\d+\s*:/.test(L[i]) && /^\s*(\/\/|\/\*|\*)/.test(L[i])) {
        let j = i;
        while (j + 1 < L.length && /^\s*(\/\/|\*)/.test(L[j + 1]) && !/^\s*\*\/\s*$/.test(L[j + 1])) j++;
        qs.push({ line: i, end: j, text: L.slice(i, j + 1).join('\n'), label: (L[i].match(/TODO\s*\d+/) || ['TODO'])[0], todo: true });
        i = j;
      }
    }
    return qs;
  }


  // 정답마다 find 글자가 들어 있는 문제를 찾는다. TODO 는 첫 줄만 본다.
  function attach(id, qs) {
    const list = ((root.EXAM_ANSWERS || {})[id]) || [];
    const used = new Set();
    list.forEach(a => {
      const n = qs.findIndex((q, k) => !used.has(k) && (q.todo ? q.text.split('\n')[0] : q.text).includes(a.find) && !!q.todo === !!a.code);
      if (n >= 0) { used.add(n); qs[n].ans = a; }
    });
    return qs;
  }

  function solved(code, qs) {
    const L = code.split('\n');
    const out = [];
    const marks = new Set();
    const byLine = {};
    qs.forEach(q => { if (q.ans) byLine[q.todo ? q.end : q.line] = q; });
    L.forEach((line, i) => {
      const q = byLine[i];
      if (q && !q.todo) {
        marks.add(out.length);
        out.push(line.replace(BLANK, q.ans.answer));
        return;
      }
      out.push(line);
      if (q && q.todo) {
        const ind = (L[q.line].match(/^\s*/) || [''])[0].replace(/\*$/, '');
        q.ans.code.split('\n').forEach(c => { marks.add(out.length); out.push(c ? ind + c : ''); });
      }
    });
    return { code: out.join('\n'), marks };
  }

  root.ExamKit = { questions, attach, solved };
})(typeof window !== 'undefined' ? window : globalThis);
