# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 먼저 읽고 시작하세요.
> 마지막 업데이트: 2026-06-04 (Phase 4 완료, Phase 5 시작 전)

---

## 프로젝트 한 줄 요약

**주식·환율·물가 등 경제를 전혀 모르는 사람들을 위해, 매일 한국 경제 뉴스를 쉬운 언어로 정리해주는 웹사이트**

---

## 결정된 사항 (변경 금지)

| 항목 | 결정 내용 |
|------|-----------|
| 서비스 형태 | 웹사이트 |
| 뉴스 출처 | 주요 신문사 5곳 RSS (네이버 RSS는 서비스 종료됨) |
| 화면 구성 | 홈 페이지 + 뉴스 상세 페이지 |
| 브리핑 내용 | 전체 요약 글 + 핵심 지표(환율·코스피 등) + 뉴스별 쉬운 설명 + 오늘의 경제 용어 |
| 업데이트 주기 | 매일 자동 (Phase 5에서 구현) |
| AI | OpenAI (GPT) — 사용자가 이미 크레딧 보유 |
| DB | Supabase — 기존 프로젝트 연결 완료 |
| 프레임워크 | Next.js 14 + TypeScript + Tailwind CSS |
| 자동화 방법 | Vercel Cron Jobs (배포와 함께 설정, GitHub Actions보다 간단) |

---

## 로드맵 진행 상태

- ✅ Phase 1 — 기반 세팅
- ✅ Phase 2 — 뉴스 수집 (5개 RSS 소스, 하루 최대 50개)
- ✅ Phase 3 — AI 브리핑 생성 (gpt-4o-mini + Yahoo Finance 지표)
- ✅ Phase 4 — 화면 제작 (실제 데이터 연결, 동작 확인 완료)
- 🔲 **Phase 5 — 자동화 연결 ← 다음에 여기서 시작**
- 🔲 Phase 6 — 테스트 및 배포

---

## 현재 작동 중인 것 (Phase 1~4 완료 내용)

### 화면

개발 서버: `npm run dev` → `http://localhost:3001`

| 페이지 | 주소 | 내용 |
|--------|------|------|
| 홈 | `/` | 브리핑 + 지표 + 뉴스 카드 + 오늘의 용어 |
| 뉴스 상세 | `/news/[id]` | 기사 제목 + 쉬운 설명 + 원본 링크 |

### API (수동 호출용)

| 엔드포인트 | 방법 | 역할 |
|-----------|------|------|
| `POST /api/collect-news` | curl 또는 브라우저 fetch | 오늘 뉴스 수집 → Supabase 저장 |
| `GET /api/collect-news` | 브라우저 주소창 | 오늘 저장된 기사 목록 확인 |
| `POST /api/generate-briefing` | curl 또는 브라우저 fetch | AI 브리핑 생성 → Supabase 저장 |
| `GET /api/generate-briefing` | 브라우저 주소창 | 오늘 브리핑 내용 확인 |

**중요:** 지금은 위 API를 손으로 호출해야 데이터가 들어옴. 자동화는 Phase 5에서 해결.

### 환경변수 (.env.local — 이미 설정 완료)
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 파일 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 전체 레이아웃 (헤더·푸터)
│   │   ├── page.tsx                      # 홈 화면 (서버 컴포넌트, Supabase 직접 조회)
│   │   ├── news/[id]/page.tsx            # 뉴스 상세 페이지
│   │   └── api/
│   │       ├── health/route.ts           # 연결 상태 확인
│   │       ├── collect-news/route.ts     # 뉴스 수집 API
│   │       ├── generate-briefing/route.ts # 브리핑 생성 API
│   │       └── cron/route.ts             # ← Phase 5에서 새로 만들 파일
│   ├── components/home/
│   │   ├── DailyBriefing.tsx             # 오늘의 경제 브리핑 섹션
│   │   ├── KeyIndicators.tsx             # 핵심 지표 (코스피·환율·코스닥)
│   │   ├── NewsCardList.tsx              # 오늘의 헤드라인 카드 목록
│   │   └── DailyTerm.tsx                 # 오늘의 경제 용어
│   ├── lib/
│   │   ├── openai.ts                     # OpenAI 클라이언트
│   │   ├── supabase.ts                   # Supabase 클라이언트
│   │   ├── naverNews.ts                  # RSS 수집 + 저장 로직
│   │   ├── marketData.ts                 # Yahoo Finance 지표 수집
│   │   └── generateBriefing.ts           # 브리핑 생성 로직
│   └── types/index.ts                    # 타입 정의
├── supabase/schema.sql                   # DB 테이블 정의 (이미 적용 완료)
├── vercel.json                           # ← Phase 5에서 새로 만들 파일
└── .env.local                            # API 키 (설정 완료)
```

---

## Supabase 테이블 구조

**briefings** (일별 브리핑)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `id` | uuid | 고유 번호 |
| `date` | text | 날짜 (YYYY-MM-DD) |
| `summary` | text | AI가 쓴 오늘의 경제 요약 글 |
| `daily_term` | text | 오늘의 경제 용어 — **문자열로 저장됨, 사용 시 JSON.parse() 필요** |
| `indicators` | jsonb | 핵심 지표 배열 — 그대로 사용 가능 |
| `created_at` | timestamp | 생성 시각 |

**news_articles** (뉴스 기사)

| 컬럼 | 타입 | 내용 |
|------|------|------|
| `id` | uuid | 고유 번호 |
| `date` | text | 날짜 (YYYY-MM-DD) |
| `title` | text | 기사 제목 (원문) |
| `summary` | text | AI가 쓴 쉬운 설명 |
| `original_url` | text | 원본 기사 링크 |
| `source` | text | 출처 (한국경제, 매일경제 등) |
| `created_at` | timestamp | 저장 시각 |

---

## Phase 5 — 자동화 연결 (다음 작업)

### 목표

매일 아침 8시, 사람이 아무것도 안 해도 자동으로:
1. 뉴스 5개 소스에서 기사 수집
2. OpenAI로 브리핑 + 기사 요약 생성
3. Supabase에 저장 → 홈 화면에 자동 반영

### 방법: Vercel Cron Jobs

배포(Vercel)와 자동화를 한 번에 해결하는 가장 간단한 방법.
별도 서버 없이 Vercel이 정해진 시간에 API를 자동 호출해줌.

### 만들어야 할 것 2가지

---

#### ① `src/app/api/cron/route.ts` — 자동화용 API 엔드포인트 (새 파일)

뉴스 수집 → 브리핑 생성을 순서대로 실행하는 엔드포인트.
Vercel이 매일 아침 이 주소를 자동으로 호출함.

```ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Vercel Cron이 보내는 인증 헤더 확인 (보안)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'

  // 1단계: 뉴스 수집
  const collectRes = await fetch(`${baseUrl}/api/collect-news`, { method: 'POST' })
  const collectData = await collectRes.json()

  // 2단계: 브리핑 생성
  const briefingRes = await fetch(`${baseUrl}/api/generate-briefing`, { method: 'POST' })
  const briefingData = await briefingRes.json()

  return NextResponse.json({
    success: true,
    collect: collectData,
    briefing: briefingData,
  })
}
```

---

#### ② `vercel.json` — Vercel Cron 스케줄 설정 (새 파일, 프로젝트 루트에 생성)

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 23 * * *"
    }
  ]
}
```

> `0 23 * * *` = 매일 UTC 23:00 = 한국시간 오전 8:00

---

#### ③ 환경변수 2개 추가 (`.env.local`에 추가 + Vercel 대시보드에도 등록)

```
CRON_SECRET=아무_랜덤_문자열_넣기  # 예: my-secret-cron-key-2024
NEXT_PUBLIC_BASE_URL=https://배포된주소.vercel.app
```

---

### Phase 5 작업 순서

1. `src/app/api/cron/route.ts` 파일 생성 (위 코드 그대로)
2. `vercel.json` 파일 생성 (위 코드 그대로)
3. `.env.local`에 `CRON_SECRET`와 `NEXT_PUBLIC_BASE_URL` 추가
4. 로컬에서 수동 테스트: `GET /api/cron` 호출 후 뉴스 + 브리핑 정상 생성 확인
5. → 이후 Phase 6(배포)에서 Vercel에 올리면 자동화 완성

---

## Phase 6 — 테스트 및 배포 (Phase 5 이후)

### 배포 방법: Vercel (무료)

1. GitHub에 코드 올리기 (`git init` → `git push`)
2. [vercel.com](https://vercel.com) → "New Project" → GitHub 저장소 연결
3. 환경변수 4개 Vercel 대시보드에 입력:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_BASE_URL` (배포 후 생성되는 주소 입력)
4. 배포 완료 → `vercel.json`의 Cron 자동 활성화

### 배포 전 체크리스트

- [ ] `.env.local`이 `.gitignore`에 포함돼 있는지 확인 (API 키 유출 방지)
- [ ] `GET /api/cron` 수동 호출로 전체 흐름 한 번 더 확인
- [ ] 브리핑 없을 때 홈 화면 "준비 중" 안내 표시 확인

---

## 사용자 정보

- 비개발자 (코드 설명 불필요)
- 한국어로만 소통
- 기술 용어 대신 쉬운 말로 설명 필요
