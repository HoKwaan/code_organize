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
