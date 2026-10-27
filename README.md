# 코드 정리

MCU(아두이노) · Linux(shell, C) · Embedded_IO(C) 강의 자료의 코드를 모아 정리하고,
시험 문제의 빈칸 줄이나 TODO 를 붙여넣으면 관련 코드와 빈칸 정답 후보를 찾아주는 정적 사이트.

- `index.html`: SPA 진입점 (해시 라우팅 `#/`, `#/s/<과목>`, `#/c/<코드id>`, `#/search?q=`, `#/exams`)
- `data/index.js`: 정리된 코드 데이터 (`window.CODE_INDEX`). 형식은 파일 상단 주석 참고
- `assets/search.js`: 빈칸 검색 엔진 (빈칸을 와일드카드로 보고 IDF 가중 LCS 로 줄 단위 매칭)
- `data/exam_answers.js`: 평가 양식 3개의 빈칸 · TODO 정답 (손으로 정리, 문제마다 정답 하나 + 설명)
- `assets/exam.js`: 양식에서 문제를 뽑고 정답을 붙이고, 정답을 채운 전체 코드를 만든다
- `explain/*.txt` → `data/explain.js`: 코드마다 붙는 설명 (강의 본문 기준으로 손으로 씀, 평가 양식은 설명 없음)
- `assets/app.js`, `assets/style.css`: 화면

## 배포

빌드 과정 없이 그대로 GitHub Pages 에 올린다.
저장소 Settings → Pages → Build and deployment → Source: Deploy from a branch, 브랜치 선택, 폴더 `/ (root)`.

로컬 확인: `python3 -m http.server` 후 http://localhost:8000

## 데이터

`data/index.js` 는 `tools/build.sh` 로 만든다 (직접 고치지 않는다).

- 강의 페이지 14개(MCU 1~4, Linux 1~5, EmbeddedIO 1~5)의 모든 코드 블록 — `tools/check.py` 로 빠진 블록이 없는지 확인
- 빈칸 채우기는 강의 정답으로 채운 완성본 + 빈칸 원본 + 정답 원문, 괄호 넣기는 정답을 [ ] 로 채운 문장
- 강의 본문의 표(교시마다 `표 · …`, 한 행을 ` | ` 로 이어 한 줄), 코드 태그 없이 본문 · 그림에만 나온 함수 이름 · 상수 · 경로
- 강의가 쓰는 `src/` 소스 파일, PDF 슬라이드(MCU_Day1~4.pdf, Linux · EmbeddedIO 슬라이드)에만 있는 코드 · 명령어
- MCU 강의 md(`MCU_DayN_lecture.md`, HTML 보다 이전 판)에만 있는 코드 · 빈칸 · 괄호 넣기 · 표 — 제목 끝에 `md 판에만 있음`
- 시험 양식: `materials/exams/`. 정답은 `data/exam_answers.js` 에 따로 두고 빌드와 상관없이 고친다.
  `node tools/check_answers.js [OUT_DIR]` 로 모든 문제에 정답이 하나씩 붙는지 확인한다 (OUT_DIR 을 주면 정답을 채운 양식을 써 준다).
  Linux 양식은 채운 코드를 빌드 · 실행해 6단계 모두 기대값과 같음을 확인했고, Embedded_IO 는 libgpiod v2 헤더로 컴파일 확인, MCU 는 Arduino 함수 흉내로 6단계 출력을 확인했다.
- 코드 설명: `explain/*.txt` 에 `@@ <코드 id>` 줄 다음부터 그 코드의 설명을 쓰고 `node tools/explain.js` 로 `data/explain.js` 를 만든다.
  빠진 설명, 본문 코드(inline)의 줄별 설명, 괄호 넣기 문항별 설명이 하나라도 없으면 실패한다 (`--check` 는 확인만).
- API 모음(`tools/supplement.py` → `tools/refs.py`): 빈칸에 나올 수 있는 표준 API 목록을 줄마다 강의 코드에서 찾아,
  강의에 있으면 그 강의 줄(줄마다 출처 링크)로 보여 주고 14개 강의 페이지 · src · PDF 슬라이드 · md 어디에도 없는 것만 '보충' 으로 남긴다.
