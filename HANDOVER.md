# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 먼저 읽고 시작하세요.
> 마지막 업데이트: 2026-06-05 (MVP 완료 → 리뉴얼 작업 진행 중)

---

## 프로젝트 한 줄 요약

**주식·환율·물가 등 경제를 전혀 모르는 사람들을 위해, 매일 한국 경제 뉴스를 쉬운 언어로 정리해주는 웹사이트**

---

## 현재 상태: 리뉴얼 Phase 1~4 전체 완료 ✅ → 추가 기능 개발 단계

| 항목 | 내용 |
|------|------|
| 실서비스 주소 | **https://economy-translator.vercel.app** |
| GitHub | https://github.com/mondwald93-creator/economy-translator |
| 자동 업데이트 | 매일 한국시간 오전 8시 (Vercel Cron) |
| 로컬 개발 | `npm run dev` → http://localhost:3001 (포트 상황에 따라 3002~3004) |

---

---

## 리뉴얼 로드맵 (2026-06-05 확정)

> MVP와 원래 기획안의 갭을 메우는 작업. 총 14개 과업, 4개 Phase.

### 현재 MVP vs 기획 갭 요약

| 항목 | 현재 MVP | 리뉴얼 목표 |
|------|----------|------------|
| 레이아웃 | 단순 세로 스크롤, 사이드바 없음 | 사이드바 + 메인 영역 |
| 브리핑 | 단순 요약 텍스트 1개 | 한 줄 헤드라인 + TOP3 상세 분석 |
| 기사 분석 | 2~3문장 요약 | 6단계 과외 스타일 분석 |
| 연결관계 | 없음 | 물가↑→소비↓→내수침체 흐름도 |
| 건강진단 | 없음 | 물가·소비·수출·고용·부동산·금융 상태 |
| 경제공부 | 없음 | 10살 버전 한 줄 요약 |

---

### Phase 1 — 기반 세팅 ✅ 완료

> DB 구조 변경 + 레이아웃 뼈대 교체

| 과업 | 내용 | 상태 |
|------|------|------|
| A1 | `briefings` 테이블에 컬럼 4개 추가: `headline`, `top3_analysis`, `connections`, `health_check` | ✅ |
| A2 | `news_articles` 테이블에 `full_analysis` 컬럼 추가 | ✅ |
| C1 | `layout.tsx` 사이드바 구조로 전환 | ✅ |
| C2 | 사이드바 컴포넌트 제작 (`src/components/layout/Sidebar.tsx`) | ✅ |
| C3 | 글로벌 스타일 노션 스타일로 업데이트 (`notion-*` 색상 추가) | ✅ |

---

### Phase 2 — AI 엔진 교체 ✅ 완료

> 기사 분석 품질을 "요약"에서 "과외"로 전환

| 과업 | 내용 | 상태 |
|------|------|------|
| B1 | `generateBriefing.ts` 프롬프트 전면 수정 (한 줄 헤드라인 + TOP3 선정) | ✅ |
| B2 | 기사별 분석 — 2~3문장 요약 → 6단계 구조로 업그레이드 (`generateTop3Analysis`) | ✅ |
| B3 | 한국경제 건강진단 생성 로직 추가 | ✅ |
| B4 | 기사 연결관계 생성 로직 추가 | ✅ |

---

### Phase 3 — 새 컴포넌트 제작 ✅ 완료

> Phase 2에서 만든 데이터를 화면에 표시

| 과업 | 내용 | 상태 |
|------|------|------|
| D1 | `HeadlineBanner` — 오늘의 한 줄 경제 (상단 배너) | ✅ |
| D2 | `Top3NewsSection` — TOP3 뉴스 6단계 분석 카드 | ✅ |
| D3 | `ConnectionDiagram` — 기사 연결관계 흐름도 | ✅ |
| D4 | `EconomyHealthCheck` — 물가·소비·수출 등 건강진단 | ✅ |
| D5 | `EconomyStudy` — 오늘의 경제공부 (10살 버전) | ✅ |

---

### Phase 4 — 마무리 & 배포 ✅ 완료 (2026-06-05)

> 기존 컴포넌트 정리 + 최종 배포

| 과업 | 내용 | 상태 |
|------|------|------|
| D6 | 기존 `KeyIndicators`, `NewsCardList` 스타일 노션 스타일로 개선 | ✅ |
| D7 | `page.tsx` 섹션 순서·간격 최종 점검 | ✅ |
| — | 로컬 테스트 → git push → Vercel 자동 배포 | ✅ |

**완료 기준:** 리뉴얼 완성본 실서비스 반영 ✅

---

### 이후 추가 예정 기능 (리뉴얼 완료 후)

| 기능 | 우선순위 |
|------|---------|
| 뉴스 링크 분석기 (URL 입력 → AI 6단계 해설) | ★★★ |
| 경제용어 사전 (검색 + 쉬운 설명) | ★★★ |
| SEO 최적화 | ★★★ |
| 경제 달력 (금리 발표일 등 주요 일정) | ★★ |
| 이메일 뉴스레터 | 추후 |
| SNS 공유 카드 | 추후 |
| 북마크 | 추후 |
| 관심 분야 설정 | 추후 |

---

## 결정된 사항 (변경 금지)

| 항목 | 결정 내용 |
|------|-----------|
| 서비스 형태 | 웹사이트 |
| 뉴스 출처 | 네이버 뉴스 검색 API (`"한국 경제"` 키워드, 최신순 20개 수집) |
| 화면 구성 | 홈 페이지 + 뉴스 상세 페이지 |
| 브리핑 내용 | 전체 요약 글 + 핵심 지표(환율·코스피 등) + 뉴스별 쉬운 설명 + 오늘의 경제 용어 |
| 홈 뉴스 표시 개수 | 5개 (`.limit(5)`) |
| 업데이트 주기 | 매일 자동 (Vercel Cron Jobs) |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase |
| 프레임워크 | Next.js 14 + TypeScript + Tailwind CSS |
| 자동화 방법 | Vercel Cron Jobs (`vercel.json`) |

---

## 로드맵 진행 상태

### MVP (완료)
- ✅ Phase 1~6 — MVP 완료 및 배포 (2026-06-05)

### 리뉴얼 (완료 2026-06-05)
- ✅ 리뉴얼 Phase 1 — 기반 세팅 (DB 컬럼 추가 + 사이드바 레이아웃)
- ✅ 리뉴얼 Phase 2 — AI 엔진 교체 (6단계 과외 분석 + 건강진단 + 연결관계)
- ✅ 리뉴얼 Phase 3 — 새 컴포넌트 제작 (HeadlineBanner 등 5개 신규)
- ✅ 리뉴얼 Phase 4 — 마무리 & 배포 완료

### 추가 기능 진행 상태

- ✅ 뉴스 링크 분석기 — `/analyze`, URL 입력 → AI 6단계 과외 분석
- ✅ 경제용어 사전 — `/dictionary`, 검색 + 카테고리 필터, daily_term 자동 저장
- ✅ SEO 최적화 — 메타데이터, 동적 OG, sitemap.xml, robots.txt
- ⬜ 경제 달력 ★★ — 금리 발표일 등 주요 일정 (다음 세션)

---

## 화면 구성

| 페이지 | 주소 | 내용 |
|--------|------|------|
| 홈 | `/` | 브리핑 + 지표 + 뉴스 카드 5개 + 오늘의 용어 |
| 뉴스 상세 | `/news/[id]` | 기사 제목 + 쉬운 설명 + 원본 링크 |

---

## API 엔드포인트

| 엔드포인트 | 방법 | 역할 |
|-----------|------|------|
| `POST /api/collect-news` | curl 또는 fetch | 네이버 API로 오늘 뉴스 수집 → Supabase 저장 |
| `GET /api/collect-news` | 브라우저 주소창 | 오늘 저장된 기사 목록 확인 |
| `POST /api/generate-briefing` | curl 또는 fetch | AI 브리핑 생성 → Supabase 저장 |
| `GET /api/generate-briefing` | 브라우저 주소창 | 오늘 브리핑 내용 확인 |
| `GET /api/cron` | Authorization 헤더 필요 | 뉴스수집 + 브리핑생성 한 번에 실행 (Vercel이 매일 자동 호출) |

**cron 수동 테스트:**
```bash
curl -X GET "https://economy-translator.vercel.app/api/cron" \
  -H "Authorization: Bearer economy-translator-cron-2026"
```

---

## 환경변수

### 로컬 `.env.local` (이미 설정 완료)
```
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://mfogieafucwcyufixpsy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3001
CRON_SECRET=economy-translator-cron-2026
NAVER_CLIENT_ID=qBk5Z2VoO31ly1tE4azy
NAVER_CLIENT_SECRET=rH5gH5q17L
```

### Vercel 대시보드 (이미 설정 완료)
위 7개 변수 모두 등록됨. `NEXT_PUBLIC_APP_URL`은 `https://economy-translator.vercel.app`으로 등록.

---

## 파일 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 전체 레이아웃 — 사이드바 + 메인 구조 (리뉴얼)
│   │   ├── page.tsx                      # 홈 화면 — 새 컴포넌트 7개 조립 (리뉴얼)
│   │   ├── news/[id]/page.tsx            # 뉴스 상세 페이지
│   │   └── api/
│   │       ├── health/route.ts           # 연결 상태 확인
│   │       ├── collect-news/route.ts     # 뉴스 수집 API
│   │       ├── generate-briefing/route.ts # 브리핑 생성 API (리뉴얼 — 새 필드 저장)
│   │       └── cron/route.ts             # 자동화 엔드포인트 (Vercel Cron 진입점)
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx               # 노션 스타일 사이드바 (리뉴얼 신규)
│   │   └── home/
│   │       ├── HeadlineBanner.tsx         # 오늘의 한 줄 경제 (리뉴얼 신규)
│   │       ├── EconomyHealthCheck.tsx     # 경제 건강진단 6항목 (리뉴얼 신규)
│   │       ├── Top3NewsSection.tsx        # TOP3 뉴스 6단계 분석 (리뉴얼 신규)
│   │       ├── ConnectionDiagram.tsx      # 경제 연결관계 흐름도 (리뉴얼 신규)
│   │       ├── EconomyStudy.tsx           # 오늘의 경제공부 (리뉴얼 신규)
│   │       ├── KeyIndicators.tsx          # 핵심 지표 (Phase 4에서 스타일 개선 예정)
│   │       ├── NewsCardList.tsx           # 뉴스 카드 목록 (Phase 4에서 스타일 개선 예정)
│   │       ├── DailyBriefing.tsx          # 미사용 (구버전, 추후 삭제)
│   │       └── DailyTerm.tsx              # 미사용 (EconomyStudy로 대체됨)
│   ├── lib/
│   │   ├── naverNews.ts                  # 네이버 뉴스 API 수집 + Supabase 저장
│   │   ├── generateBriefing.ts           # OpenAI 브리핑 생성 (리뉴얼 — 4개 함수)
│   │   ├── marketData.ts                 # Yahoo Finance 지표 수집
│   │   ├── openai.ts
│   │   └── supabase.ts
│   ├── styles/globals.css                # 노션 스타일 (리뉴얼)
│   └── types/index.ts                    # 새 타입 추가: Top3AnalysisItem 등 (리뉴얼)
├── tailwind.config.ts                    # notion-* 색상 추가 (리뉴얼)
├── vercel.json                           # Cron 스케줄: 매일 UTC 23:00 (한국 오전 8시)
└── .env.local                            # API 키 (gitignore 포함, 절대 커밋 금지)
```

---

## Supabase 테이블 구조

**briefings** (일별 브리핑)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `date` | text | 날짜 (YYYY-MM-DD) |
| `summary` | text | AI 요약 글 |
| `headline` | text | 오늘의 한 줄 경제 헤드라인 *(리뉴얼 추가)* |
| `daily_term` | text | 오늘의 경제 용어 — **JSON.parse() 필요** |
| `indicators` | jsonb | 핵심 지표 배열 |
| `top3_analysis` | jsonb | TOP3 기사 6단계 분석 배열 *(리뉴얼 추가)* |
| `health_check` | jsonb | 경제 건강진단 6항목 배열 *(리뉴얼 추가)* |
| `connections` | jsonb | 경제 연결관계 흐름 배열 *(리뉴얼 추가)* |

**news_articles** (뉴스 기사)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `date` | text | 날짜 |
| `title` | text | 기사 제목 |
| `summary` | text | AI 쉬운 설명 (2~3문장) |
| `full_analysis` | jsonb | 6단계 상세 분석 (TOP3 기사만) *(리뉴얼 추가)* |
| `original_url` | text | 원본 링크 |
| `source` | text | 출처 |

---

## 네이버 뉴스 API

- **등록 계정:** mondwald93@gmail.com (네이버 개발자 센터)
- **앱 이름:** 경제번역기
- **일일 한도:** 25,000건 (하루 한 번만 사용하므로 문제 없음)
- **검색 쿼리:** `"한국 경제"`, 최신순, 20개

---

## 배포 관련

- **Vercel 계정:** mondwald93@gmail.com (GitHub 연동)
- **GitHub 저장소:** https://github.com/mondwald93-creator/economy-translator
- **코드 수정 후 반영 방법:**
  ```bash
  git add .
  git commit -m "수정 내용"
  git push
  ```
  → push하면 Vercel이 자동으로 재배포

---

## 사용자 정보

- 비개발자 (코드 설명 불필요)
- 한국어로만 소통
- 기술 용어 대신 쉬운 말로 설명 필요
