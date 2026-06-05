# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 먼저 읽고 시작하세요.
> 마지막 업데이트: 2026-06-05

---

## 프로젝트 한 줄 요약

**주식·환율·물가 등 경제를 전혀 모르는 사람들을 위해, 매일 한국 경제 뉴스를 쉬운 언어로 정리해주는 웹사이트**

---

## 현재 상태

| 항목 | 내용 |
|------|------|
| 실서비스 주소 | **https://economy-translator.vercel.app** |
| GitHub | https://github.com/mondwald93-creator/economy-translator |
| 자동 업데이트 | 매일 한국시간 오전 8시 (Vercel Cron) |
| 로컬 개발 | `npm run dev` → http://localhost:3001 (포트 상황에 따라 3002~3004) |

---

## 다음 세션 시작점 ← 여기서 시작

### ✅ 최근 완료
1. **경제 달력** (`/calendar`) — 2026년 연간 경제 일정 (금통위·FOMC·CPI·GDP·무역수지), 국가 필터, 날짜 클릭 상세
2. **경제용어 사전 208개로 확장** — expand-terms API로 확장, cleanup-terms API로 중복 15개 제거 + 기타→정확한 카테고리 재분류
3. **북마크** (`/bookmarks`) — localStorage 기반, 뉴스카드·상세페이지 🔖 버튼, 저장 목록 페이지, 사이드바 링크

### ⬜ 다음 할 일 — 관심분야 설정

#### 관심분야 설정 (localStorage 기반, 로그인 불필요)
1. `lib/interests.ts` — 관심 카테고리 저장/조회 유틸
2. `/settings` 페이지 — 금리·환율·주식·부동산 등 카테고리 선택 UI
3. 홈 화면에서 관심분야 뉴스를 상단에 먼저 노출
4. 사이드바에 설정 링크 추가

> ⚠️ localStorage는 다른 기기에서는 안 보임 (로그인 없는 구조의 한계)

---

## 전체 진행 상태

### MVP (완료 2026-06-05)
- ✅ Phase 1~6 — 기본 기능 구현 + Vercel 배포

### 리뉴얼 (완료 2026-06-05)
- ✅ Phase 1 — DB 컬럼 추가 + 노션 스타일 사이드바 레이아웃
- ✅ Phase 2 — AI 엔진 교체 (6단계 과외 분석 + 건강진단 + 연결관계)
- ✅ Phase 3 — 신규 컴포넌트 5개 (HeadlineBanner 등)
- ✅ Phase 4 — 기존 컴포넌트 노션 스타일 통일 + 배포

### 추가 기능 (완료 2026-06-05)
- ✅ 뉴스 링크 분석기 — `/analyze`, URL → AI 6단계 과외 분석
- ✅ 경제용어 사전 — `/dictionary`, 검색 + 카테고리 필터, 208개, daily_term 자동 저장
- ✅ SEO 최적화 — 메타데이터, OG 태그, sitemap.xml, robots.txt
- ✅ 경제 달력 — `/calendar`, 2026년 연간 일정, 국가 필터, 날짜 클릭 상세 (2026-06-05)

---

## 화면 구성 (현재)

| 페이지 | 주소 | 내용 |
|--------|------|------|
| 홈 | `/` | 헤드라인 + 건강진단 + TOP3 분석 + 연결관계 + 핵심지표 + 뉴스목록 + 경제공부 |
| 뉴스 상세 | `/news/[id]` | 기사 제목 + 쉬운 설명 + 원본 링크 |
| 링크 분석기 | `/analyze` | URL 입력 → AI 6단계 분석 결과 카드 |
| 경제용어 사전 | `/dictionary` | 검색 + 카테고리 필터 + 용어 카드 |
| 북마크 | `/bookmarks` | 저장한 뉴스 목록 (localStorage) |

---

## API 엔드포인트 전체

| 엔드포인트 | 방법 | 역할 |
|-----------|------|------|
| `POST /api/collect-news` | curl | 네이버 API로 오늘 뉴스 수집 → Supabase 저장 |
| `GET /api/collect-news` | 브라우저 | 오늘 저장된 기사 목록 확인 |
| `POST /api/generate-briefing` | curl | AI 브리핑 생성 → Supabase 저장 (daily_term 사전 자동 저장 포함) |
| `GET /api/generate-briefing` | 브라우저 | 오늘 브리핑 내용 확인 |
| `GET /api/cron` | Authorization 헤더 필요 | 뉴스수집 + 브리핑생성 한 번에 (Vercel 매일 자동 호출) |
| `POST /api/analyze-link` | fetch | URL → 기사 스크레이핑 + GPT 6단계 분석 반환 |
| `GET /api/terms` | fetch | 경제용어 목록 (쿼리: `?q=검색어&category=금리`) |
| `POST /api/seed-terms` | curl (로컬) | 초기 용어 40개 생성 · 삽입 (이미 완료, 재실행 불필요) |

**cron 수동 테스트:**
```bash
curl -X GET "https://economy-translator.vercel.app/api/cron" \
  -H "Authorization: Bearer economy-translator-cron-2026"
```

---

## 파일 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # 전체 레이아웃 + SEO 메타데이터
│   │   ├── page.tsx                       # 홈 화면 — 컴포넌트 7개 조립
│   │   ├── sitemap.ts                     # sitemap.xml 자동 생성
│   │   ├── robots.ts                      # robots.txt
│   │   ├── analyze/
│   │   │   └── page.tsx                   # 링크 분석기 페이지
│   │   ├── dictionary/
│   │   │   └── page.tsx                   # 경제용어 사전 페이지
│   │   ├── news/[id]/
│   │   │   └── page.tsx                   # 뉴스 상세 페이지 + 동적 OG 메타
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── collect-news/route.ts
│   │       ├── generate-briefing/route.ts  # daily_term → terms 테이블 자동 저장
│   │       ├── cron/route.ts
│   │       ├── analyze-link/route.ts       # cheerio 스크레이핑 + GPT 분석
│   │       ├── terms/route.ts              # 용어 검색 API
│   │       └── seed-terms/route.ts         # 초기 데이터 생성 (이미 실행 완료)
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx                # 노션 사이드바 (메뉴 3개)
│   │   └── home/
│   │       ├── HeadlineBanner.tsx
│   │       ├── EconomyHealthCheck.tsx
│   │       ├── Top3NewsSection.tsx
│   │       ├── ConnectionDiagram.tsx
│   │       ├── EconomyStudy.tsx
│   │       ├── KeyIndicators.tsx
│   │       ├── NewsCardList.tsx
│   │       ├── DailyBriefing.tsx          # 미사용 (구버전)
│   │       └── DailyTerm.tsx              # 미사용 (EconomyStudy로 대체됨)
│   ├── lib/
│   │   ├── naverNews.ts
│   │   ├── generateBriefing.ts            # OpenAI 브리핑 생성 (4개 함수)
│   │   ├── marketData.ts
│   │   ├── openai.ts
│   │   └── supabase.ts
│   ├── styles/globals.css
│   └── types/index.ts
├── tailwind.config.ts                     # notion-* 색상
├── vercel.json                            # Cron: 매일 UTC 23:00
└── .env.local                             # API 키 (절대 커밋 금지)
```

---

## Supabase 테이블 구조

**briefings** (일별 브리핑)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `date` | text | 날짜 (YYYY-MM-DD) |
| `summary` | text | AI 요약 글 |
| `headline` | text | 오늘의 한 줄 경제 헤드라인 |
| `daily_term` | text | 오늘의 경제 용어 — **JSON.parse() 필요** |
| `indicators` | jsonb | 핵심 지표 배열 |
| `top3_analysis` | jsonb | TOP3 기사 6단계 분석 배열 |
| `health_check` | jsonb | 경제 건강진단 6항목 |
| `connections` | jsonb | 경제 연결관계 흐름 |

**news_articles** (뉴스 기사)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `date` | text | 날짜 |
| `title` | text | 기사 제목 |
| `summary` | text | AI 쉬운 설명 (2~3문장) |
| `full_analysis` | jsonb | 6단계 상세 분석 (TOP3 기사만) |
| `original_url` | text | 원본 링크 |
| `source` | text | 출처 |

**terms** (경제용어 사전)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `id` | uuid | PK |
| `term` | text | 용어명 (unique) |
| `category` | text | 금리·환율·주식·부동산·무역·경기·소비·통화·기타 |
| `explanation` | text | 초보자용 설명 |
| `example` | text | 실생활 예시 (nullable) |
| `created_at` | timestamp | 생성일 |

> ⚠️ terms 테이블 RLS 정책: select/insert/update 모두 허용 (anon key로 접근 가능)

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

## 결정된 사항 (변경 금지)

| 항목 | 결정 내용 |
|------|-----------|
| 서비스 형태 | 웹사이트 |
| 뉴스 출처 | 네이버 뉴스 검색 API (`"한국 경제"` 키워드, 최신순 20개) |
| 업데이트 주기 | 매일 자동 (Vercel Cron Jobs) |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase |
| 프레임워크 | Next.js 14 + TypeScript + Tailwind CSS |

---

## 배포

- **Vercel 계정:** mondwald93@gmail.com (GitHub 연동)
- **코드 수정 후 반영:**
  ```bash
  git add .
  git commit -m "수정 내용"
  git push
  ```
  → push하면 Vercel 자동 재배포

---

## 참고: Vercel 타임아웃 주의

Vercel 무료 플랜은 함수 실행 시간 **10초 제한**. OpenAI 호출이 여러 번 필요한 작업(용어 대량 생성 등)은 **반드시 로컬에서 실행**.

```bash
# 로컬 서버 먼저 켜고
npm run dev

# 별도 터미널에서 호출
curl -X POST http://localhost:3001/api/[엔드포인트]
```

---

## 사용자 정보

- 비개발자 (코드 설명 불필요)
- 한국어로만 소통
- 기술 용어 대신 쉬운 말로 설명 필요
