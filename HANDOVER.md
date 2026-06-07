# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 **먼저 읽고** 시작하세요.
> 마지막 업데이트: 2026-06-07

---

## 프로젝트 한 줄 요약

**주식·환율·물가 등 경제를 전혀 모르는 사람들을 위해, 매일 한국 경제 뉴스를 쉬운 언어로 정리해주는 웹사이트**

---

## 현재 상태

| 항목 | 내용 |
|------|------|
| 실서비스 주소 | **https://economy-translator.vercel.app** |
| GitHub | https://github.com/mondwald93-creator/economy-translator |
| 자동 업데이트 | 매일 한국시간 **오전 9시** (Vercel Cron, UTC 00:00) |
| 로컬 개발 | `npm run dev` → http://localhost:3000 |
| 배포 방식 | git push → Vercel 자동 재배포 |

---

## 다음 세션 시작점 ← 여기서 시작

**✅ 버그 수정 완료 (2026-06-07) — 리뉴얼 작업 예정**

오늘 세션에서 버그 수정을 모두 마쳤어요. 다음 세션에서는 **UI/기능 리뉴얼** 작업을 이어가면 돼요. 리뉴얼 범위는 아직 미정이므로 사용자에게 먼저 물어보고 시작할 것.

### 시작 방법

```bash
cd /Users/ninaj/Documents/claude-code-test/economy-translator
npm run dev
# http://localhost:3000 열어서 확인
# 디자인 비교 시 color-preview.html 나란히 열기
open color-preview.html
```

---

## 2026-06-07 버그 수정 이력

### 원래 있던 버그 7개 수정

| 순위 | 파일 | 내용 |
|------|------|------|
| 1 | `generate-briefing/route.ts` | `dailyTerm?.term ?? ''` 옵셔널 체이닝으로 크래시 방지 |
| 2 | `HeadlineBanner.tsx` | 날짜 표시 UTC → KST (`timeZone: 'Asia/Seoul'` 적용) |
| 3 | `TopBar.tsx` + `layout.tsx` | `updatedAt` prop 전달, 브리핑 없으면 "준비 중" 표시 |
| 4 | `generate-briefing/route.ts` + `page.tsx` | 날짜 조회 전체 KST 통일 (`Date.now() + 9h`) |
| 5 | `naverNews.ts` | HTML 엔티티(`&amp;` 등) 올바른 문자로 변환 |
| 6 | `naverNews.ts` | 순차 삽입 → upsert 배치 처리로 변경 |
| 7 | `naverNews.ts` | 제목 앞 20자 기준 중복 제거 추가 |

### 추가로 발생해서 수정한 버그

- **HeadlineBanner 날짜 이중 적용**: `+9h` 수동 계산 + `timeZone` 동시 적용으로 날짜가 하루 앞으로 밀리는 문제 → `+9h` 제거, `timeZone`만 사용
- **naverNews upsert 타임아웃**: `.in()` 500개 URL 쿼리가 HTTP 길이 초과 → `upsert(ignoreDuplicates: true)`로 교체
- **TOP3 기사 항상 빈 배열**: GPT가 UUID 반환 시 매칭 실패 → 프롬프트에서 UUID 제거, **인덱스 번호** 방식으로 교체 (`top3Indices`)
- **briefings 중복 행**: `upsert`에 unique constraint 없어서 insert 반복 → **delete → insert** 방식으로 교체
- **page.tsx `.single()` 오동작**: 중복 행 있을 때 엉뚱한 브리핑 반환 → `order(created_at desc).limit(1).single()`으로 변경
- **GNB 메뉴 중앙 정렬 깨짐**: `flex-1` 래퍼 방식은 로고/칩 너비에 따라 틀어짐 → `grid-cols-[1fr_auto_1fr]`로 교체해 항상 정중앙 고정

### DB 작업 (Supabase에서 직접 실행 완료)

```sql
-- 중복 행 정리 후 unique constraint 추가 (2026-06-07 완료)
DELETE FROM briefings
WHERE id NOT IN (
  SELECT DISTINCT ON (date) id FROM briefings ORDER BY date, created_at DESC
);
ALTER TABLE briefings ADD CONSTRAINT briefings_date_unique UNIQUE (date);
```

---

## 전체 완료 이력

### MVP (초기 구축)
- ✅ Next.js 14 + Supabase + OpenAI 기본 구조
- ✅ 뉴스 수집 → AI 브리핑 생성 → Supabase 저장 파이프라인
- ✅ Vercel Cron 자동화
- ✅ 홈 화면, 뉴스 상세, 링크 분석기, 경제용어 사전, 경제 달력, 북마크 — 6개 페이지

### 기능 추가
- ✅ 경제용어 사전 200개 데이터 삽입
- ✅ SEO 최적화 (sitemap, robots, OG 태그)
- ✅ 북마크 (localStorage 기반)

### 뉴스 수집 전면 개편
- ✅ RSS 4개 + 네이버 경제탭 랭킹 스크래핑 + 키워드 3개 → 500개+ 수집

### 브리핑 품질 개선
- ✅ TOP3 뉴스 한국 경제 중심으로 수정 (외신 배제)
- ✅ 크론 오전 8시 → 오전 9시 변경

### UX/UI 리뉴얼 (Phase 1~5 전체 완료)
- ✅ Phase 1~5 완료 (디자인 시스템 + GNB + 홈 7개 컴포넌트 + 서브페이지 5개 + 마무리)

### 버그 수정 (2026-06-07)
- ✅ 위 버그 수정 이력 참고

---

## 아키텍처

### 뉴스 수집 → 브리핑 생성 흐름

```
[매일 오전 9시 KST] Vercel Cron → GET /api/cron
    │
    ├─ 1단계: POST /api/collect-news
    │         collectAndSaveNews()
    │         ├── fetchRSSFeeds()          # RSS 4개 언론사
    │         ├── fetchNaverRankingNews()  # 네이버 경제탭 랭킹 스크래핑
    │         └── fetchNaverKeywordNews()  # 키워드 3개 검색
    │         → URL + 제목 앞 20자 기준 중복 제거
    │         → upsert(ignoreDuplicates) 배치 저장
    │
    └─ 2단계: POST /api/generate-briefing
              오늘 날짜(KST) 기사 로드 → 외신 뒤로 정렬 → 상위 30개 선택
              → GPT-4o-mini에 인덱스 번호 형식으로 전달
              → 헤드라인·요약·TOP3(인덱스)·건강진단·연결관계·경제용어 생성
              → 오늘 날짜 기존 행 DELETE 후 INSERT (중복 방지)
```

### 홈 화면 렌더링 흐름

```
page.tsx (Server Component, force-dynamic)
    │
    ├─ Supabase: briefings WHERE date = 오늘(KST) ORDER BY created_at DESC LIMIT 1
    └─ Supabase: news_articles WHERE date = 오늘(KST) LIMIT 5
    
    렌더링 순서:
    HeadlineBanner → KeyIndicators → EconomyHealthCheck
    → Top3NewsSection → ConnectionDiagram → NewsCardList → EconomyStudy

layout.tsx (async Server Component)
    └─ Supabase: briefings WHERE date = 오늘(KST) ORDER BY created_at DESC LIMIT 1
       → TopBar + GNB에 updatedAt prop 전달
```

---

## 화면 구성

| 페이지 | 주소 | 주요 내용 |
|--------|------|-----------|
| 홈 | `/` | 헤드라인 + 지표(4개) + 건강진단(6개) + TOP3 + 연결관계 + 뉴스목록(5개) + 경제공부 |
| 뉴스 상세 | `/news/[id]` | 기사 제목 + AI 쉬운 설명 + 원본 링크 |
| 링크 분석기 | `/analyze` | URL 입력 → AI 4단계 분석 |
| 경제용어 사전 | `/dictionary` | 검색 + 카테고리 필터 + 용어 카드 200개 |
| 경제 달력 | `/calendar` | 2026년 연간 경제 일정 |
| 북마크 | `/bookmarks` | 저장한 뉴스 목록 (localStorage) |

---

## 파일 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # async 서버컴포넌트, TopBar+GNB에 updatedAt 전달
│   │   ├── page.tsx                       # force-dynamic, KST 날짜 기준 브리핑+기사 SSR
│   │   ├── analyze/page.tsx
│   │   ├── dictionary/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── bookmarks/page.tsx
│   │   ├── news/[id]/page.tsx
│   │   └── api/
│   │       ├── cron/route.ts              # Cron 진입점 (collect → briefing 순서)
│   │       ├── collect-news/route.ts      # 뉴스 수집 API
│   │       ├── generate-briefing/route.ts # 브리핑 생성 (delete→insert, 인덱스 기반 TOP3)
│   │       ├── analyze-link/route.ts      # 링크 분석
│   │       └── terms/route.ts             # 경제용어 검색
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx                 # updatedAt prop, 브리핑 없으면 "준비 중"
│   │   │   └── GNB.tsx                    # grid-cols-[1fr_auto_1fr], 메뉴 항상 정중앙
│   │   ├── home/
│   │   │   ├── HeadlineBanner.tsx         # 날짜 KST 기준 (timeZone: 'Asia/Seoul')
│   │   │   ├── KeyIndicators.tsx
│   │   │   ├── EconomyHealthCheck.tsx
│   │   │   ├── Top3NewsSection.tsx
│   │   │   ├── ConnectionDiagram.tsx
│   │   │   ├── NewsCardList.tsx
│   │   │   └── EconomyStudy.tsx
│   │   └── BookmarkButton.tsx
│   ├── lib/
│   │   ├── naverNews.ts                   # upsert 배치, 제목 20자 중복 제거, 엔티티 디코딩
│   │   ├── generateBriefing.ts            # top3Indices 인덱스 방식, candidateArticles 반환
│   │   ├── marketData.ts
│   │   └── supabase.ts
│   ├── types/index.ts
│   └── styles/globals.css
├── vercel.json                            # cron: "0 0 * * *" (KST 09:00)
├── tailwind.config.ts
├── color-preview.html                     # ⭐ 레퍼런스 디자인 (브라우저로 비교 필수)
└── .env.local
```

---

## API 엔드포인트

| 엔드포인트 | 메서드 | 역할 |
|-----------|--------|------|
| `/api/cron` | GET | Cron 진입점 (collect → briefing 순서 실행) |
| `/api/collect-news` | POST | 뉴스 수집 및 저장 |
| `/api/collect-news` | GET | 오늘 수집된 기사 목록 반환 |
| `/api/generate-briefing` | POST | AI 브리핑 생성 |
| `/api/generate-briefing` | GET | 오늘 브리핑 조회 |
| `/api/analyze-link` | POST | URL → GPT 4단계 분석 |
| `/api/terms` | GET | 경제용어 검색 |

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase PostgreSQL (테이블: briefings, news_articles, terms) |
| 뉴스 | RSS 4개 + 네이버 경제탭 랭킹 스크래핑 + 네이버 검색 API |
| 자동화 | Vercel Cron Jobs (매일 UTC 00:00 = 한국 오전 9시) |
| 배포 | Vercel (git push → 자동 재배포) |
| 폰트 | Noto Sans KR (Google Fonts) |

---

## 레퍼런스 디자인 핵심 스펙

| 항목 | 값 |
|------|------|
| 배경 | `#F9FAFB` |
| 본문 텍스트 | `#111827` |
| 포인트 초록 | `#22C55E` |
| 상승 초록 | `#16A34A` |
| 하락 빨강 | `#DC2626` |
| 카드 배경 | `#FFFFFF` |
| 카드 보더 | `#F3F4F6` |
| 카드 radius | `14px` |
| TopBar 배경 | `#111827` |
| GNB 높이 | `60px` |
| GNB padding | `0 48px` (데스크탑) / `0 16px` (모바일) |
| GNB 레이아웃 | `grid-cols-[1fr_auto_1fr]` — 메뉴 항상 정중앙 |
| GNB 활성 메뉴 | `bg-[#F0FDF4] text-[#16A34A] font-bold` |
| 헤드라인 h1 | `36px / font-weight:900 / line-height:1.25 / letter-spacing:-1.2px` |
| 콘텐츠 max-width | `900px` |

**디자인 컨셉: "미니멀 에디토리얼 + 젊은 층 참여 요소"**
⚠️ 디자인 수정 시 color-preview.html과 반드시 브라우저에서 눈으로 비교할 것.

---

## 주의사항

| 상황 | 주의 |
|------|------|
| 코드 수정 후 | **반드시 git push** — 로컬 저장만으로는 Vercel 배포 안 됨 |
| OpenAI 여러 번 호출 | Vercel 10초 타임아웃 → 반드시 **로컬**에서 실행 |
| 디자인 확인 | 코드만 보면 안 됨 — **브라우저에서 눈으로 직접** 비교 |
| 날짜 처리 | 전체 KST 기준으로 통일 (`Date.now() + 9h` 또는 `timeZone: 'Asia/Seoul'`) |
| briefings 저장 | delete → insert 방식. DB에 unique constraint 있으므로 upsert 복귀 가능 |
| TOP3 선정 | 인덱스 번호 방식 (`top3Indices`). UUID 방식으로 되돌리지 말 것 |
| 뉴스 수동 수집 | `curl -X POST https://economy-translator.vercel.app/api/collect-news` |
| 브리핑 수동 생성 | `curl -X POST https://economy-translator.vercel.app/api/generate-briefing` |

---

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
CRON_SECRET=...
```

---

## 사용자 정보

- 비개발자 (코드 설명 불필요, 결과만 전달)
- 한국어로만 소통
- 세션 완료 후 실서비스 링크 반드시 전달: **https://economy-translator.vercel.app**
- 디자인 변경 시 반드시 color-preview.html 레퍼런스와 브라우저 비교 확인
