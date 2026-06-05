# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 먼저 읽고 시작하세요.
> 마지막 업데이트: 2026-06-05 (전체 완료 — 실서비스 운영 중)

---

## 프로젝트 한 줄 요약

**주식·환율·물가 등 경제를 전혀 모르는 사람들을 위해, 매일 한국 경제 뉴스를 쉬운 언어로 정리해주는 웹사이트**

---

## 현재 상태: 완전 완료 ✅ 운영 중

| 항목 | 내용 |
|------|------|
| 실서비스 주소 | **https://economy-translator.vercel.app** |
| GitHub | https://github.com/mondwald93-creator/economy-translator |
| 자동 업데이트 | 매일 한국시간 오전 8시 (Vercel Cron) |
| 로컬 개발 | `npm run dev` → http://localhost:3001 (포트 상황에 따라 3002~3003) |

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

- ✅ Phase 1 — 기반 세팅
- ✅ Phase 2 — 뉴스 수집 (처음엔 RSS 5곳 → 네이버 API로 전환 완료)
- ✅ Phase 3 — AI 브리핑 생성 (gpt-4o-mini + Yahoo Finance 지표)
- ✅ Phase 4 — 화면 제작 (실제 데이터 연결, 동작 확인 완료)
- ✅ Phase 5 — 자동화 연결 (Vercel Cron + 네이버 API 전환)
- ✅ Phase 6 — 테스트 및 배포 (2026-06-05 완료)

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
│   │   ├── layout.tsx                    # 전체 레이아웃 (헤더·푸터)
│   │   ├── page.tsx                      # 홈 화면 (.limit(5)로 뉴스 5개만 표시)
│   │   ├── news/[id]/page.tsx            # 뉴스 상세 페이지
│   │   └── api/
│   │       ├── health/route.ts           # 연결 상태 확인
│   │       ├── collect-news/route.ts     # 뉴스 수집 API
│   │       ├── generate-briefing/route.ts # 브리핑 생성 API
│   │       └── cron/route.ts             # 자동화 엔드포인트 (Vercel Cron 진입점)
│   ├── components/home/
│   │   ├── DailyBriefing.tsx
│   │   ├── KeyIndicators.tsx
│   │   ├── NewsCardList.tsx
│   │   └── DailyTerm.tsx
│   ├── lib/
│   │   ├── naverNews.ts                  # 네이버 뉴스 API 수집 + Supabase 저장
│   │   ├── generateBriefing.ts           # OpenAI 브리핑 생성
│   │   ├── marketData.ts                 # Yahoo Finance 지표 수집
│   │   ├── openai.ts
│   │   └── supabase.ts
│   └── types/index.ts
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
| `daily_term` | text | 오늘의 경제 용어 — **JSON.parse() 필요** |
| `indicators` | jsonb | 핵심 지표 배열 |

**news_articles** (뉴스 기사)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `date` | text | 날짜 |
| `title` | text | 기사 제목 |
| `summary` | text | AI 쉬운 설명 |
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
