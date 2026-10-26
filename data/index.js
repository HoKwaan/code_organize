// 코드 정리 데이터. 자료를 받으면 snippets / exams 에 채운다.
//
// snippet 형식:
// {
//   id: 'mcu-led-blink',          // 고유 id (URL에 사용)
//   subject: 'mcu',               // subjects[].id
//   topic: 'GPIO',                // 단원/주제 (목차 그룹)
//   title: 'LED 깜빡이기',
//   lang: 'cpp' | 'c' | 'bash',
//   source: '3주차 실습.pdf p.12', // 출처 자료
//   desc: '설명 (선택)',
//   tags: ['digitalWrite', 'delay'],
//   code: `...`
// }
//
// exam 형식 (시험 양식):
// { id, subject, title, source, desc, code }   // 빈칸은 ____ 또는 TODO 로 표기
window.CODE_INDEX = {
  subjects: [
    { id: 'mcu', name: 'MCU', full: 'MCU (Arduino)', lang: 'cpp' },
    { id: 'linux', name: 'Linux', full: 'Linux (shell · C)', lang: 'bash' },
    { id: 'eio', name: 'Embedded_IO', full: 'Embedded_IO (C)', lang: 'c' }
  ],
  snippets: [],
  exams: []
};
