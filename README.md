# 오늘도 해냄 (godsaeng)

친구들과 같이 쓰는 갓생 다이어리. 데일리 루틴 · 투두 · 하루 일기 · 미니홈피 · 친구 순위 · 내기.

```
저장소   github.com/mygameworld400/godsaeng
사이트   https://mygameworld400.github.io/godsaeng/
스택     React 19 · Vite 8 · Supabase · 순수 CSS (라이브러리 최소화)
```

## 구조

- `src/hooks/useStore.jsx` — 전역 상태와 모든 동작. 화면 먼저 바꾸고 저장은 뒤에서(450ms 디바운스).
- `src/services/*.js` — Supabase 호출은 여기서만. 컴포넌트는 Supabase 를 직접 부르지 않는다.
- `src/components/` — 탭별 화면(오늘 / 미니홈피 / 친구 / 내기)과 공용 조각(`common.jsx`).
- 탭 전환은 `location.hash` 로만 한다 (라우터 없음, Pages 하위 경로에서 새로고침 OK).

## Supabase

메롱(`cc_`) · 미니홈(`mh_`) · 패션아카이브(`fa_`)와 **같은 프로젝트**를 공유한다.
이 앱은 테이블·함수·정책 전부 **`gs_` 접두사**만 쓴다.

1. SQL Editor 에서 `supabase/migrations/001_schema.sql` 실행
2. `.env.local` 에 URL / publishable 키 (`.env.example` 참고)
3. GitHub 저장소 Secrets 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

auth.users 가 다른 앱과 공유되므로 "로그인했다"만으로는 아무것도 못 본다.
`gs_profiles` 에 행이 있는 사람(닉네임을 정한 사람)끼리만 서로의 기록을 본다.
일기 원문(`gs_diaries`)은 본인만, 공개 체크한 날만 `gs_days.diary` 로 복사돼 친구에게 보인다.
내기 참가·인증은 `gs_bet_set_member` / `gs_bet_check` 함수로만 바뀐다 (자기 키만 수정 가능).

## 개발

```
npm install
npm run dev      # 키가 없으면 저장 없는 미리보기 모드로 뜬다
npm run check    # oxlint + build. 커밋 전에 돌린다
```

main 에 푸시하면 GitHub Actions 가 Pages 로 배포한다.
