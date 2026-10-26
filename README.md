# 코드 정리

MCU(아두이노) · Linux(shell, C) · Embedded_IO(C) 강의 자료의 코드를 모아 정리하고,
시험 문제의 빈칸 줄이나 TODO 를 붙여넣으면 관련 코드와 빈칸 정답 후보를 찾아주는 정적 사이트.

- `index.html`: SPA 진입점 (해시 라우팅 `#/`, `#/s/<과목>`, `#/c/<코드id>`, `#/search?q=`, `#/exams`)
- `data/index.js`: 정리된 코드 데이터 (`window.CODE_INDEX`). 형식은 파일 상단 주석 참고
- `assets/search.js`: 빈칸 검색 엔진 (빈칸을 와일드카드로 보고 IDF 가중 LCS 로 줄 단위 매칭)
- `data/exam_answers.js`: 평가 양식 3개의 빈칸 · TODO 정답 (손으로 정리, 문제마다 정답 하나 + 설명)
- `assets/exam.js`: 양식에서 문제를 뽑고 정답을 붙이고, 정답을 채운 전체 코드를 만든다
- `assets/app.js`, `assets/style.css`: 화면

## 배포

빌드 과정 없이 그대로 GitHub Pages 에 올린다.
저장소 Settings → Pages → Build and deployment → Source: Deploy from a branch, 브랜치 선택, 폴더 `/ (root)`.

로컬 확인: `python3 -m http.server` 후 http://localhost:8000

## 데이터

`data/index.js` 는 `tools/build.sh` 로 만든다 (직접 고치지 않는다).

- 강의 페이지 14개(MCU 1~4, Linux 1~5, EmbeddedIO 1~5)의 모든 코드 블록 — `tools/check.py` 로 빠진 블록이 없는지 확인
- 빈칸 채우기는 강의 정답으로 채운 완성본 + 빈칸 원본 + 정답 원문, 괄호 넣기는 정답을 [ ] 로 채운 문장
- 강의가 쓰는 `src/` 소스 파일, MCU PDF 슬라이드에만 있는 코드
- 시험 양식: `materials/exams/`. 정답은 `data/exam_answers.js` 에 따로 두고 빌드와 상관없이 고친다.
  `node tools/check_answers.js [OUT_DIR]` 로 모든 문제에 정답이 하나씩 붙는지 확인한다 (OUT_DIR 을 주면 정답을 채운 양식을 써 준다).
  Linux 양식은 채운 코드를 빌드 · 실행해 6단계 모두 기대값과 같음을 확인했고, Embedded_IO 는 libgpiod v2 헤더로 컴파일 확인, MCU 는 Arduino 함수 흉내로 6단계 출력을 확인했다.
- 보충 사전(`tools/supplement.py`): 강의 자료에 없지만 빈칸에 나올 수 있는 표준 API (errno 이름, open 플래그 등)
