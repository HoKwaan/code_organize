# 코드 정리

MCU(아두이노) · Linux(shell, C) · Embedded_IO(C) 강의 자료의 코드를 모아 정리하고,
시험 문제의 빈칸 줄이나 TODO 를 붙여넣으면 관련 코드와 빈칸 정답 후보를 찾아주는 정적 사이트.

- `index.html`: SPA 진입점 (해시 라우팅 `#/`, `#/s/<과목>`, `#/c/<코드id>`, `#/search?q=`, `#/exams`)
- `data/index.js`: 정리된 코드 데이터 (`window.CODE_INDEX`). 형식은 파일 상단 주석 참고
- `assets/search.js`: 빈칸 검색 엔진 (빈칸을 와일드카드로 보고 IDF 가중 LCS 로 줄 단위 매칭)
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
- 시험 양식: `materials/exams/`
- 보충 사전(`tools/supplement.py`): 강의 자료에 없지만 빈칸에 나올 수 있는 표준 API (errno 이름, open 플래그 등)
