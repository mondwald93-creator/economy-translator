# 경제번역기 — Claude 작업 가이드

매일 한국 경제 뉴스를 초보자 언어로 정리해주는 웹사이트.

- 실서비스: https://economy-translator.vercel.app
- GitHub: https://github.com/mondwald93-creator/economy-translator
- 배포: git push → Vercel 자동 재배포
- 자동 업데이트: 매일 한국시간 오전 9시 (Vercel Cron)

---

## 현재 상태

모든 기능 완료, 실서비스 운영 중. 알려진 버그 없음.

**완료 이력**
- MVP: Next.js 14 + Supabase + OpenAI 기본 구조, 6개 페이지
- 기능 추가: 경제용어 사전(200개), SEO, 북마크, 링크 분석기, 경제 달력
- 뉴스 수집 개편: RSS 4개 + 네이버 경제탭 스크래핑 + 키워드 검색 → 500개+
- UX/UI 리뉴얼: Phase 1~5 전체 완료
- 버그 수정 (2026-06-07): 13개 수정
- 안정성 패치 (2026-06-07): 타임아웃 방지, 수집 실패 감지, 기준금리 자동화, upsert 전환
- 뉴스 하루 4회 수집 (2026-06-07): 오전 9시 브리핑 + 오후 1시·5시·10시 뉴스 전용 크론 추가
- 업데이트 시각 표시 (2026-06-07): 지표 브리핑 기준 시각, 뉴스 마지막 업데이트 시각
- UI 카드 배경 통일 (2026-06-07): 연결관계·TOP3·헤드라인 카드 bg-white 적용
- 뉴스 수집 DB constraint 버그 수정 (2026-06-08): upsert → insert 전환, constraint 의존성 제거
- 뉴스 목록 캐시 버그 수정 (2026-06-08): page.tsx Supabase 클라이언트에 cache: no-store 명시
- 오늘의 경제용어 중복 방지 (2026-06-08): 최근 7일 사용 용어 AI 프롬프트에 전달

**6개 페이지**
- `/` 홈: 헤드라인 + 지표 + 건강진단 + TOP3 + 연결관계 + 뉴스목록 + 경제공부
- `/news/[id]` 뉴스 상세
- `/analyze` 링크 분석기
- `/dictionary` 경제용어 사전
- `/calendar` 경제 달력
- `/bookmarks` 북마크

---

## 자동화 흐름

```
[매일 오전 9시 KST] Vercel Cron → GET /api/cron
  → POST /api/collect-news   (RSS + 네이버 랭킹 + 키워드 검색)
  → POST /api/generate-briefing  (OpenAI GPT-4o-mini × 3회)
  → Supabase upsert 저장

[오후 1시·5시·10시 KST] Vercel Cron → GET /api/cron-news
  → POST /api/collect-news   (뉴스 수집만, 브리핑 생성 없음)
```

수집 실패 또는 0건 시 브리핑 생성을 건너뜀 (실패 감지 로직 있음).

---

## 절대 건드리지 말 것

과거에 수정했다가 버그가 생겼던 항목들. 아래 방식이 현재 정상 작동 중이므로 되돌리지 말 것.

| 항목 | 현재 방식 | 되돌리면 생기는 버그 |
|------|-----------|---------------------|
| TOP3 선정 | 인덱스 번호 기반 (`top3Indices`) | UUID 방식 복귀 시 항상 빈 배열 |
| 날짜 처리 | `+9h` 또는 `timeZone: 'Asia/Seoul'` 중 하나만 사용 | 둘 다 쓰면 날짜가 하루 앞으로 밀림 |
| briefings 저장 | `upsert({ onConflict: 'date' })` | delete+insert 복귀 시 저장 실패 → 당일 브리핑 유실 |
| GNB 레이아웃 | `grid-cols-[1fr_auto_1fr]` | flex-1 방식 복귀 시 메뉴 중앙 정렬 깨짐 |
| 뉴스 중복 제거 | URL + 제목 앞 20자 기준 (코드 레벨) | DB constraint에 의존하면 upsert 에러로 전체 수집 실패 |
| 뉴스 저장 방식 | `naverNews.ts` — 기존 URL 선조회 후 `insert` | upsert 복귀 시 DB constraint 없으면 전체 에러 |
| 기준금리 | 네이버 금융 자동 수집 | 하드코딩 금지 |
| vercel.json maxDuration | cron 300s, generate-briefing 300s | 삭제 시 타임아웃으로 크론 매일 실패 |
| Supabase briefings.date | unique constraint 적용됨 | 삭제 시 중복 행 문제 재발 |
| page.tsx Supabase 클라이언트 | 매 렌더마다 `createClient` + `cache: 'no-store'` | 싱글톤 or no-store 제거 시 뉴스 목록 캐시로 빈 채 굳음 |

---

## 수정 시 반드시 따를 규칙

1. **코드 수정 후 반드시 `git push`** — 로컬 저장만으로는 Vercel 배포 안 됨
2. **디자인 수정 시 `color-preview.html` 브라우저에서 눈으로 비교 필수** — 코드만 보면 실제 화면과 다를 수 있음
3. **OpenAI 여러 번 호출하는 작업은 로컬에서 실행** — Vercel에서 직접 호출하면 타임아웃
4. **날짜 로직 수정 시 KST 이중 적용 여부 확인** — `+9h`와 `timeZone` 동시 사용 금지

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase PostgreSQL (테이블: briefings, news_articles, terms) |
| 뉴스 | RSS 4개 + 네이버 경제탭 스크래핑 + 네이버 검색 API |
| 자동화 | Vercel Cron (매일 UTC 00:00 = KST 09:00) |
| 배포 | Vercel (git push → 자동 재배포) |

---

## 레퍼런스 디자인

`color-preview.html` — 브라우저로 열어서 디자인 비교 시 사용.

| 항목 | 값 |
|------|-----|
| 배경 | `#F9FAFB` |
| 포인트 초록 | `#22C55E` |
| 상승 | `#16A34A` / 하락 `#DC2626` |
| 카드 radius | `14px` |
| 콘텐츠 max-width | `900px` |
| GNB 레이아웃 | `grid-cols-[1fr_auto_1fr]` |

디자인 컨셉: **미니멀 에디토리얼 + 젊은 층 참여 요소**

---

## 로컬 실행

```bash
npm run dev
# http://localhost:3000

# 디자인 비교 시
open color-preview.html
```

## 수동 실행 (필요 시)

```bash
# 뉴스 수집
curl -X POST https://economy-translator.vercel.app/api/collect-news

# 브리핑 생성
curl -X POST https://economy-translator.vercel.app/api/generate-briefing
```
