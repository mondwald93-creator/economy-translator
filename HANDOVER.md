# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 **먼저 읽고** 시작하세요.
> 마지막 업데이트: 2026-06-06

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

**✅ 모든 Phase 완료 — 실서비스 정상 운영 중**

남은 작업 없음. 다음에 할 수 있는 일:
- 뉴스 중복 기사 제거 개선 (아래 알려진 이슈 참고)
- 새 기능 추가 (예: 뉴스 검색, 알림 등)
- 사용자 피드백 반영

### 알려진 이슈 (수정 가능하면 수정)

**뉴스 목록 중복 기사 문제**
- 증상: "오늘의 헤드라인" 5개 중 같은 기사가 2번 보임
- 원인: RSS·네이버 랭킹·키워드 세 소스가 같은 기사를 **다른 URL**로 수집 → URL 기준 중복 제거를 통과
- 수정 방향: URL 비교 대신 제목 유사도(예: 첫 20자 일치 시 중복) 기준으로 바꾸면 됨
- 관련 파일: `src/lib/naverNews.ts` — `collectAndSaveNews()` 함수의 중복 제거 로직

### 시작 방법

```bash
cd /Users/ninaj/Documents/claude-code-test/economy-translator
npm run dev
# http://localhost:3000 열어서 확인
# 디자인 비교 시 color-preview.html 나란히 열기
open color-preview.html
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
- ✅ **기존**: 키워드 검색만 → 2개 수집 (핫이슈 누락)
- ✅ **현재**: RSS 4개 + 네이버 경제탭 랭킹 스크래핑 + 키워드 3개 → **500개+ 수집**
  - RSS: 연합뉴스·한국경제·매일경제·서울경제
  - 네이버 랭킹: news.naver.com 경제탭 많이본 기사 (EUC-KR 디코딩 처리)
  - 키워드: 한국경제 / 코스피코스닥 / 환율금리
- ✅ URL 기준 중복 제거 후 Supabase 저장

### 브리핑 품질 개선
- ✅ TOP3 뉴스 **한국 경제 중심**으로 수정
  - 외신 키워드(미국·美·중국·연준·나스닥 등) 포함 기사 뒤로 정렬
  - AI 프롬프트: "해외 경제 뉴스 TOP3 선정 금지, 국내 경제만"
  - TOP3 선정 방식: 인덱스 기반 → ID 기반 (정렬 후 인덱스 불일치 버그 수정)
- ✅ 크론 오전 8시 → **오전 9시** (코스피·환율 9시 개장 맞춤)

### 실서비스 배포 버그 수정
- ✅ Cron URL 버그: `NEXT_PUBLIC_APP_URL` 없을 때 localhost 호출 → `VERCEL_URL` 폴백 추가
- ✅ 날짜 UTC/KST 불일치: 오전에 "어제 날짜"로 인식하던 문제 → 전체 KST 기준으로 통일

### UX/UI 리뉴얼 (Phase 1~5 전체 완료)
- ✅ Phase 1: 디자인 시스템 (색상·타이포·카드 스펙 확정)
- ✅ Phase 2: GNB full-width + TopBar + 레이아웃
- ✅ Phase 3: 홈 화면 컴포넌트 7개 (헤드라인·지표·건강진단·TOP3·연결관계·뉴스목록·경제공부)
- ✅ Phase 4: 서브 페이지 5개 리뉴얼 (analyze·dictionary·calendar·bookmarks·news/[id])
- ✅ Phase 5: 마무리 & 배포
  - 전체 페이지 통합 테스트 (데스크탑 + 모바일 375px)
  - 모바일 지표 카드 2열 레이아웃 수정 (기존 4열 → 375px에서 숫자 잘림 해결)
  - GNB 모바일 패딩 축소 + 우측 그라데이션 페이드 (달력·북마크 스크롤 힌트)
  - GNB 업데이트 칩 동적 시간 표시 (DB 브리핑 created_at 기반, layout.tsx에서 조회)
  - '오전 8시' → '오전 9시' 전체 통일 — TopBar, HeadlineBanner(2곳), page.tsx 5곳

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
    │         → URL 기준 중복 제거 → Supabase news_articles 저장
    │
    └─ 2단계: POST /api/generate-briefing
              오늘 날짜(KST) 기사 로드 → 외신 뒤로 정렬 → 상위 30개 선택
              → GPT-4o-mini에 [ID:xxxx] 형식으로 전달
              → 헤드라인·요약·TOP3·건강진단·연결관계·경제용어 생성
              → Supabase briefings 저장 (upsert)
```

### 홈 화면 렌더링 흐름

```
page.tsx (Server Component, force-dynamic)
    │
    ├─ Supabase: briefings WHERE date = 오늘(UTC)  → briefing 데이터
    └─ Supabase: news_articles WHERE date = 오늘(UTC) LIMIT 5 → 기사 목록
    
    렌더링 순서:
    HeadlineBanner → KeyIndicators → EconomyHealthCheck
    → Top3NewsSection → ConnectionDiagram → NewsCardList → EconomyStudy

layout.tsx (async Server Component)
    └─ Supabase: briefings WHERE date = 오늘(KST) → created_at
       → GNB에 updatedAt prop으로 전달 → "오늘 09:23 업데이트" 표시
```

---

## 화면 구성

| 페이지 | 주소 | 주요 내용 |
|--------|------|-----------|
| 홈 | `/` | 헤드라인 + 지표(4개) + 건강진단(6개) + TOP3 + 연결관계 + 뉴스목록(5개) + 경제공부 |
| 뉴스 상세 | `/news/[id]` | 기사 제목 + AI 쉬운 설명 + 원본 링크 |
| 링크 분석기 | `/analyze` | URL 입력 → AI 4단계 분석 (한 마디로·무슨 일·왜·나한테 영향) |
| 경제용어 사전 | `/dictionary` | 검색 + 카테고리 필터 + 용어 카드 200개 |
| 경제 달력 | `/calendar` | 2026년 연간 경제 일정 (금리·지표·무역·★중요) |
| 북마크 | `/bookmarks` | 저장한 뉴스 목록 (localStorage) |

---

## 파일 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # async 서버컴포넌트, GNB에 updatedAt 전달
│   │   ├── page.tsx                       # force-dynamic, 브리핑+기사 SSR
│   │   ├── analyze/page.tsx
│   │   ├── dictionary/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── bookmarks/page.tsx
│   │   ├── news/[id]/page.tsx
│   │   └── api/
│   │       ├── cron/route.ts              # Cron 진입점 (collect → briefing 순서)
│   │       ├── collect-news/route.ts      # 뉴스 수집 API
│   │       ├── generate-briefing/route.ts # 브리핑 생성 API
│   │       ├── analyze-link/route.ts      # 링크 분석
│   │       └── terms/route.ts             # 경제용어 검색
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx                 # 다크 상단바, "오전 9시" 텍스트
│   │   │   └── GNB.tsx                    # full-width, 모바일 스크롤+페이드, 동적 칩
│   │   ├── home/
│   │   │   ├── HeadlineBanner.tsx         # h1 + lead + D-day 배너
│   │   │   ├── KeyIndicators.tsx          # 컨디션 카드 + 지표 4개 (모바일 2열)
│   │   │   ├── EconomyHealthCheck.tsx     # 건강진단 6개 항목
│   │   │   ├── Top3NewsSection.tsx        # AI 분석 TOP3 기사
│   │   │   ├── ConnectionDiagram.tsx      # 경제 연결관계 화살표
│   │   │   ├── NewsCardList.tsx           # 오늘의 헤드라인 5개 (읽음 추적)
│   │   │   └── EconomyStudy.tsx           # 오늘의 경제용어 다크 카드
│   │   └── BookmarkButton.tsx
│   ├── lib/
│   │   ├── naverNews.ts                   # 뉴스 수집 (RSS+랭킹+키워드), KST 날짜 처리
│   │   ├── generateBriefing.ts            # GPT 브리핑 생성, 한국 경제 중심 정렬
│   │   ├── marketData.ts                  # 지표 수집 (▲▼— 형식)
│   │   └── supabase.ts                    # Supabase 클라이언트
│   ├── types/index.ts
│   └── styles/globals.css
├── vercel.json                            # cron: "0 0 * * *" (KST 09:00)
├── tailwind.config.ts
├── color-preview.html                     # ⭐ 레퍼런스 디자인 (브라우저로 비교)
└── .env.local                             # SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY 등
```

---

## API 엔드포인트

| 엔드포인트 | 메서드 | 역할 |
|-----------|--------|------|
| `/api/cron` | GET | Cron 진입점 (collect → briefing 순서 실행) |
| `/api/collect-news` | POST | 뉴스 수집 및 저장 |
| `/api/collect-news` | GET | 오늘 수집된 기사 목록 반환 |
| `/api/generate-briefing` | POST | AI 브리핑 생성 |
| `/api/analyze-link` | POST | URL → GPT 4단계 분석 |
| `/api/terms` | GET | 경제용어 검색 (`?q=환율&category=환율`) |

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
| TopBar 앞 텍스트 | `#F9FAFB` bold 12px |
| TopBar 뒤 텍스트 | `#9CA3AF` 12px |
| GNB 높이 | `60px` |
| GNB 너비 | full-width (max-width 없음) |
| GNB padding | `0 48px` (데스크탑) / `0 16px` (모바일) |
| GNB 활성 메뉴 | `bg-[#F0FDF4] text-[#16A34A] font-bold` |
| GNB 업데이트 칩 | `bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A] radius-20px 5px 12px` |
| 헤드라인 h1 | `36px / font-weight:900 / line-height:1.25 / letter-spacing:-1.2px` |
| 헤드라인 줄 1 | `#111827` (검정) / 18자 이내 |
| 헤드라인 줄 2 | `#16A34A` (초록) |
| lead 문단 | `15px / line-height:1.8 / border-left:3px #22C55E / max-width:640px` |
| 긴박감 배너 | `bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]` + D-day 오른쪽 |
| 컨디션 카드 | `from-[#ECFDF5] to-[#D1FAE5] border-[#A7F3D0]` radius 16px |
| 지표 숫자 | `22px font-black #111827` |
| 지표 변화값 | `▲ +X.XX%` / `▼ -X.XX%` / `— 동결` 형식 |
| 경제용어 카드 | `bg-#111827 / radius-16px` + 초록 버튼 오른쪽 |
| 콘텐츠 max-width | `900px` |

**디자인 컨셉: "미니멀 에디토리얼 + 젊은 층 참여 요소"**
⚠️ 디자인 방향 다시 묻지 말 것. 확정된 스펙에서 수정 시 color-preview.html과 반드시 비교.

---

## 주의사항

| 상황 | 주의 |
|------|------|
| 코드 수정 후 | **반드시 git push** — 로컬 저장만으로는 Vercel 배포 안 됨 |
| OpenAI 여러 번 호출 | Vercel 10초 타임아웃 → 반드시 **로컬**에서 실행 |
| 디자인 확인 | 코드만 보면 안 됨 — **브라우저에서 눈으로 직접** 비교 |
| 네이버 랭킹 스크래핑 | EUC-KR 인코딩 처리 필요 (TextDecoder 사용 중) |
| 날짜 처리 | 뉴스 수집은 KST 기준, page.tsx 쿼리는 UTC 기준 — 현재 오전에는 동일하지만 자정 전후 주의 |

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
