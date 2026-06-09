# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 **먼저 읽고** 시작하세요.
> 마지막 업데이트: 2026-06-09 (Phase 2 모바일 최적화 완료 + 공유 버튼 추가. 다음: Phase 3)

---

## 프로젝트 한 줄 요약

**경제 지식이 0인 2030 여성, 투자 입문 희망자를 위한 매일 5분 경제 입문 브리핑 사이트**

> 2026-06-09 서비스 리뉴얼 방향 확정. 타겟과 목표가 이번에 처음 명확히 정의됨.

---

## 현재 상태

| 항목 | 내용 |
|------|------|
| 실서비스 주소 | **https://economy-translator.vercel.app** |
| GitHub | https://github.com/mondwald93-creator/economy-translator |
| 자동 업데이트 | 매일 한국시간 **오전 9:00** 뉴스 수집 + **오전 9:10** 브리핑 생성 + **오후 1시·5시·10시** 뉴스 수집 |
| 로컬 개발 | `npm run dev` → http://localhost:3000 |
| 배포 방식 | git push → Vercel 자동 재배포 |

---

## 다음 세션 시작점 ← 여기서 시작

**✅ 2026-06-09 — Phase 1(GA) 완료. Phase 2(모바일) 전체 완료. Phase 3(첫인상·톤) 완료. 다음: Phase 4(재방문 유도 기능)**

### 서비스 리뉴얼 배경
외부 피드백 3가지를 수용해서 리뉴얼 결정:
1. 모바일 최적화 시급
2. 타겟 방문자 명확히 정의
3. 운영 목표를 수치로 설정

### 확정된 타겟 & 목표

| 항목 | 내용 |
|------|------|
| 타겟 | 경제 지식이 0인 2030 여성, 투자를 시작하고 싶지만 어디서부터 시작할지 모르는 사람 |
| 포지셔닝 | "매일 5분 경제 입문 브리핑" |
| 목표 (3개월) | 재방문율 30% / 일일 방문자 100명 / 평균 체류시간 3분 이상 |

### 서비스 리뉴얼 로드맵

| 단계 | 내용 | 시기 | 상태 |
|------|------|------|------|
| Phase 0 | 타겟·목표·포지셔닝 정의 | 2026-06-09 | ✅ 완료 |
| Phase 1 | GA(방문자 추적) 설치 | 6월 3주차 | ✅ 완료 (2026-06-09) |
| Phase 2 | 모바일 최적화 전체 | 6월 3~4주차 | ✅ 완료 (2026-06-09) |
| Phase 3 | 첫인상·사이트 톤 타겟 맞게 조정 | 6월 3주차 | ✅ 완료 (2026-06-09) |
| Phase 4 | 재방문 유도 기능 추가 | 7월 1주차 | ⬜ 대기 |
| Phase 5 | 케이스스터디 작성 | 8월 1~2주차 | ⬜ 대기 (데이터 쌓인 후) |

### 다음 세션 시작 멘트
> "경제번역기 리뉴얼 이어서 해줘" → Phase 4 (재방문 유도 기능) 바로 시작

---

### Phase 1 세부 과업 (GA 설치) ✅ 완료 (2026-06-09)
- [x] 구글 애널리틱스 계정 만들기 (측정 ID: G-4EX6PHFTLB)
- [x] 사이트에 추적 코드 심기 (layout.tsx — next/script afterInteractive 방식)
- [x] 실시간 방문자 수 1 확인 완료
- [ ] 리뉴얼 전 기준값 기록 → 1~2일 후 GA 대시보드에서 확인 후 기록

---

### Phase 2 세부 과업 (모바일 최적화) ✅ 전체 완료 (2026-06-09)

#### ✅ 완료된 수정 (2026-06-09)

| 파일 | 수정 내용 |
|------|----------|
| `layout.tsx` | 좌우 여백 `px-6` → `px-4 sm:px-6`, 상하 `py-10` → `py-8 sm:py-10` |
| `HeadlineBanner.tsx` | 헤드라인 폰트 `36px 고정` → `22px/30px/36px` 반응형, 리드 문단 `text-sm sm:text-[15px]`, 날짜 줄바꿈 `flex-wrap`, "9시 업데이트" 문구 모바일 숨김, D-day 모바일 숨김 |
| `EconomyStudy.tsx` | 하단 경제용어 카드 `flex-col sm:flex-row` (모바일 세로 배치), 버튼 `text-center` |
| `NewsCardList.tsx` | 업데이트 시각 텍스트 모바일 숨김 `hidden sm:inline` |
| `GNB.tsx` | 모바일 2열(`auto+1fr`) / 데스크탑 3열(`1fr+auto+1fr`) 분리, 로고 `whitespace-nowrap` 추가, UpdateChip 모바일 숨김 |

#### ✅ Phase 2 전체 완료 (2026-06-09)
- [x] 카카오톡·링크 공유 버튼 추가 → ShareButtons.tsx 신규 생성 (Web Share API + 링크 복사)
- [x] 모바일 최종 전체 화면 점검 — 서브 페이지 이상 없음, 달력 셀 높이 반응형 조정

---

### Phase 3 세부 과업 (첫인상 개선) ✅ 완료 (2026-06-09)

**목표:** 처음 방문한 2030 여성이 3초 안에 "이거 나 위한 거네"라고 느끼게 만들기

| 파일 | 수정 내용 | 상태 |
|------|----------|------|
| `HeadlineBanner.tsx` | 포지셔닝 문구 추가("📰 매일 아침 5분 · 경제 초보를 위한 브리핑") + 응원 배너 | ✅ |
| `layout.tsx` | title "5분으로 끝내는 경제 입문", description 타겟 맞게, keywords 보강 | ✅ |
| `GNB.tsx` | UpdateChip "오늘 브리핑 완료 ✓" / "매일 아침 9시 브리핑" | ✅ |
| `EconomyStudy.tsx` | "오늘 알면 좋은 경제 단어", "단어 더 보기 →" | ✅ |
| `EconomyHealthCheck.tsx` | "지금 한국 경제, 어떤 상태일까?" | ✅ |
| `ConnectionDiagram.tsx` | "오늘 뉴스, 어떻게 연결되어 있을까?" | ✅ |
| `page.tsx` | 브리핑 준비중 문구 친근하게 | ✅ |

### Phase 4 세부 과업 (재방문 유도)
- [ ] 오늘의 한 문장 카드 (인스타·카카오 공유용)
- [ ] 이메일 구독 기능 검토 및 구현
- [ ] "매일 브리핑" 강조 UI 조정

---

### 시작 방법

```bash
cd /Users/ninaj/Documents/claude-code-test/2축-개인포트폴리오/economy-translator
npm run dev
# http://localhost:3000 열어서 확인
# 디자인 비교 시 color-preview.html 나란히 열기
open color-preview.html
```

---

## 2026-06-08 작업 이력

### 버그 1: 뉴스 수집 전면 실패 (크론 자체가 매일 실패하던 문제)

**원인**: Supabase `news_articles` 테이블의 `original_url` unique constraint가 언젠가 사라짐.
`upsert(onConflict: 'original_url')`이 전부 에러 반환 → 뉴스 0건 → 브리핑 생성 중단 → "준비중" 화면.

**수정**: `src/lib/naverNews.ts`

| 이전 방식 | 수정 후 방식 |
|-----------|-------------|
| `upsert(chunk, { onConflict: 'original_url', ignoreDuplicates: true })` | DB에서 기존 URL 선조회 → 새 URL만 `insert` |

DB constraint 유무와 무관하게 작동. 중복 방지는 코드 레벨에서 처리.

**추가 조치**: 오늘 크론이 실패했으므로 수동으로 브리핑 생성 실행.
```bash
curl -X POST https://economy-translator.vercel.app/api/collect-news
curl -X POST https://economy-translator.vercel.app/api/generate-briefing
```

---

### 버그 2: "오늘의 헤드라인" 뉴스 목록 항상 빈 상태

**원인**: Next.js 14 Server Component 안에서 Supabase가 `fetch`를 호출할 때, Next.js가 자동으로 fetch 결과를 캐시함.
오전 크론 실패로 뉴스가 없던 시점의 "0건" 결과가 캐시되어, 이후 뉴스를 채워도 캐시된 빈 결과를 계속 반환.

`force-dynamic`을 설정해도 개별 fetch 레벨 캐시는 별도로 막아야 함.

**수정**: `src/app/page.tsx`

```ts
// 수정 전: 싱글톤 사용 + Promise.all 병렬
import { supabase } from '@/lib/supabase'
const [{ data: briefing }, { data: articles }] = await Promise.all([...])

// 수정 후: 매 렌더마다 새 클라이언트 + cache: no-store + 순차 await
const db = createClient(url, key, {
  global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) }
})
const { data: briefing } = await db.from('briefings')...
const { data: articles } = await db.from('news_articles')...
```

⚠️ **이 패턴 절대 되돌리지 말 것**: `cache: 'no-store'` 없으면 Next.js가 fetch 결과를 캐시해서 뉴스 목록이 빈 채로 굳어버림.

---

### 기능 추가: 오늘의 경제용어 매일 다른 용어 선택

**문제**: AI 프롬프트가 "오늘 뉴스에서 가장 중요한 용어"를 고르도록 되어 있어서, 환율 뉴스가 많은 날엔 매일 "환율"만 반복.

**수정**:
- `src/app/api/generate-briefing/route.ts` — 브리핑 생성 전, 최근 7일치 `daily_term`을 조회해서 `recentTerms` 배열 생성
- `src/lib/generateBriefing.ts` — `generateMainBriefing()`에 `recentTerms` 파라미터 추가, AI 프롬프트에 "이 용어들은 피하세요: 환율, 기준금리, ..." 전달

내일 오전 9시 크론부터 자동 적용.

---

### 기능 추가: 지표 실시간화 (코스피·코스닥·환율)

**문제**: 지표 숫자가 오전 9시 브리핑 생성 시점에 DB에 저장되고, 이후 장 중에 값이 바뀌어도 계속 9시 스냅샷을 보여줌. Naver와 크게 달라 보이는 이유.

**수정**:
- `src/app/page.tsx` — `getMarketIndicators()` 직접 호출해서 페이지 로드 시마다 Yahoo Finance 실시간값 취득
- 숫자(value, change, direction)는 실시간, AI 설명(easyExplanation)은 브리핑 저장값 유지
- 야후파이낸스 실패 시 브리핑 저장값으로 자동 폴백
- `src/components/home/KeyIndicators.tsx` — 하단 문구 "브리핑 기준 · 실시간 반영 아님" → "실시간 지표 · AI 설명은 오전 9시 브리핑 기준"

⚠️ **주의**: `getMarketIndicators()`가 page.tsx에 직접 들어간 구조. 야후파이낸스 응답이 느리면 페이지 로드가 느려질 수 있음. 필요 시 별도 API 라우트로 분리 가능.

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
- ✅ 디자인 시스템 + GNB + 홈 7개 컴포넌트 + 서브페이지 5개 + 마무리

### 버그 수정 (2026-06-07 1차)
- ✅ 총 13개 버그 수정 (크래시 방지, KST 날짜 버그, TOP3 빈 배열, 중복 저장, GNB 정렬 등)

### 자동화 안정성 패치 + UI 개선 (2026-06-07 2차)
- ✅ `vercel.json` maxDuration (타임아웃 방지)
- ✅ collect-news 실패 시 브리핑 생성 중단
- ✅ 기준금리 네이버 금융 자동 스크래핑
- ✅ briefings 저장 upsert 전환
- ✅ 뉴스 하루 4회 수집 크론 추가
- ✅ 업데이트 시각 표시
- ✅ 카드 배경 흰색 통일

### 버그 수정 + 기능 추가 (2026-06-08)
- ✅ 뉴스 수집 실패 수정 (upsert → insert, constraint 의존성 제거)
- ✅ 뉴스 목록 빈 상태 수정 (Next.js fetch 캐시 우회, cache: no-store)
- ✅ 오늘의 경제용어 중복 방지 (최근 7일 피하기)
- ✅ 지표 실시간화 (페이지 로드마다 Yahoo Finance 실시간값, AI 설명은 브리핑 기준 유지)

### 서비스 리뉴얼 Phase 2 완료 (2026-06-09 — 이번 세션)

- ✅ `ShareButtons.tsx` 신규 생성 — "📤 친구에게 공유" (Web Share API, 모바일에서 카카오톡 등 기기 공유창 뜸) + "🔗 링크 복사" (클립보드 복사, 2초 후 원래대로)
- ✅ `HeadlineBanner.tsx` — ShareButtons 삽입, D-day 배너 하단 여백 32px → 16px로 조정
- ✅ `calendar/page.tsx` — 달력 셀 높이 `min-h-[64px]` → `min-h-[48px] sm:min-h-[64px]` 반응형
- ✅ 서브 페이지 모바일 점검 — 용어사전·링크분석기·북마크 이상 없음 확인
- ✅ git push → Vercel 자동 배포 완료

**ShareButtons 작동 방식 (기술 용어 없이):**
- 📤 버튼: 휴대폰에서 누르면 → 카카오톡·문자·메일 등 내 폰에 깔린 앱 선택창이 뜸. 컴퓨터에서 누르면 → 링크 자동 복사.
- 🔗 버튼: 어디서든 누르면 → 링크 복사. "복사됨!" 메시지 2초 뜨고 사라짐.
- 공유되는 내용: URL(https://economy-translator.vercel.app) + 제목 + 한 줄 소개

---

### 자동화 타임아웃 근본 수정 (2026-06-09)
- ✅ 원인 분석: 단일 크론(300초 제한)에서 뉴스수집(60초) + 브리핑생성(250초) 연속 실행 → 타임아웃 간헐적 실패
- ✅ 크론 분리: 9:00 뉴스수집 전용 / 9:10 브리핑생성 전용 (각자 독립 300초)
- ✅ `src/lib/runBriefing.ts` 신규 생성 — 브리핑 생성 오케스트레이션 공유 lib
- ✅ `src/app/api/cron-briefing/route.ts` 신규 생성 — 브리핑 전용 크론 라우트
- ✅ `cron/route.ts` 개선 — HTTP fetch 제거, collectAndSaveNews() 직접 호출
- ✅ `generate-briefing/route.ts` 간소화 — runDailyBriefing() 사용
- ✅ `vercel.json` 업데이트 — cron-briefing 추가, maxDuration 분리 적용

---

## 절대 건드리지 말 것

| 항목 | 현재 방식 | 되돌리면 생기는 버그 |
|------|-----------|---------------------|
| TOP3 선정 | 인덱스 번호 기반 (`top3Indices`) | UUID 방식 복귀 시 항상 빈 배열 |
| 날짜 처리 | `+9h` 또는 `timeZone: 'Asia/Seoul'` 중 **하나만** 사용 | 둘 다 쓰면 날짜 하루 앞으로 밀림 |
| briefings 저장 | `upsert({ onConflict: 'date' })` | delete+insert 복귀 시 저장 실패 → 당일 브리핑 유실 |
| GNB 레이아웃 | `grid-cols-[1fr_auto_1fr]` | flex-1 방식 복귀 시 메뉴 중앙 정렬 깨짐 |
| 뉴스 중복 제거 | URL + 제목 앞 20자 기준 (코드 레벨) | DB constraint에 의존하면 upsert 에러로 전체 수집 실패 |
| 기준금리 | 네이버 금융 자동 스크래핑 | 하드코딩 절대 금지 |
| vercel.json maxDuration | cron·브리핑 300s, 뉴스 60s | 삭제 시 타임아웃으로 크론 매일 실패 |
| Supabase briefings.date | unique constraint 적용됨 | 삭제 시 중복 행 문제 재발 |
| page.tsx Supabase 클라이언트 | 매 렌더마다 `createClient` + `cache: 'no-store'` | 싱글톤으로 되돌리거나 no-store 빼면 뉴스 목록 캐시로 빈 채로 굳음 |
| page.tsx 지표 | `getMarketIndicators()` 실시간 호출 후 브리핑 AI 설명 병합 | briefing.indicators 단독 사용 복귀 시 9시 스냅샷만 보임 |

---

## 자동화 흐름

```
[매일 오전 9:00 KST] Vercel Cron → GET /api/cron
    └─ collectAndSaveNews() 직접 호출 (HTTP fetch 없이, 60초 제한)

[매일 오전 9:10 KST] Vercel Cron → GET /api/cron-briefing
    └─ runDailyBriefing() 직접 호출 (OpenAI GPT-4o-mini × 3회 → Supabase upsert, 300초 제한)
           └─ 최근 7일 daily_term 조회 → AI 프롬프트에 "이 용어 피하세요" 전달

[오후 1시·5시·10시 KST] Vercel Cron → GET /api/cron-news
    └─ POST /api/collect-news   (뉴스 수집만, 브리핑 생성 없음)
```

> ⚠️ 뉴스 수집(9:00)과 브리핑 생성(9:10)은 반드시 분리 운영. 합치면 300초 제한 초과로 실패함.

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
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # force-dynamic, createClient+cache:no-store, 순차 await
│   │   ├── analyze/page.tsx
│   │   ├── dictionary/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── bookmarks/page.tsx
│   │   ├── news/[id]/page.tsx
│   │   └── api/
│   │       ├── cron/route.ts              # ⭐ 9:00 뉴스 수집 전용 크론 (collectAndSaveNews 직접 호출, 60s)
│   │       ├── cron-briefing/route.ts     # ⭐ 9:10 브리핑 생성 전용 크론 (runDailyBriefing 직접 호출, 300s)
│   │       ├── cron-news/route.ts         # 뉴스 전용 크론 (오후 1시·5시·10시)
│   │       ├── collect-news/route.ts      # 뉴스 수집 API
│   │       ├── generate-briefing/route.ts # 브리핑 생성 API (runDailyBriefing 호출, 300s)
│   │       ├── analyze-link/route.ts      # 링크 분석
│   │       └── terms/route.ts             # 경제용어 검색
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx
│   │   │   └── GNB.tsx                    # grid-cols-[1fr_auto_1fr], 메뉴 항상 정중앙
│   │   ├── home/
│   │   │   ├── HeadlineBanner.tsx         # D-day 배너 + ShareButtons 포함
│   │   │   ├── ShareButtons.tsx           # ⭐ 공유 버튼 (Web Share API + 링크 복사) — 2026-06-09 추가
│   │   │   ├── KeyIndicators.tsx
│   │   │   ├── EconomyHealthCheck.tsx
│   │   │   ├── Top3NewsSection.tsx
│   │   │   ├── ConnectionDiagram.tsx
│   │   │   ├── NewsCardList.tsx
│   │   │   └── EconomyStudy.tsx
│   │   └── BookmarkButton.tsx
│   ├── lib/
│   │   ├── runBriefing.ts                 # ⭐ 브리핑 생성 오케스트레이션 (cron-briefing + generate-briefing 공유)
│   │   ├── naverNews.ts                   # insert 방식 (upsert 아님), URL 선조회로 중복 제거
│   │   ├── generateBriefing.ts            # recentTerms 파라미터 추가, top3Indices 인덱스 방식
│   │   ├── marketData.ts                  # 기준금리 네이버 금융 스크래핑, 실패 시 3.50% 폴백
│   │   └── supabase.ts                    # 싱글톤 (API 라우트용) — page.tsx는 직접 createClient
│   ├── types/index.ts
│   └── styles/globals.css
├── CLAUDE.md                              # ⭐ Claude 자동 로드 파일 (세션 시작 시 항상 읽힘)
├── vercel.json                            # cron 5개 (9:00 수집 + 9:10 브리핑 + 오후 3개), maxDuration 분리
├── tailwind.config.ts
├── color-preview.html                     # ⭐ 레퍼런스 디자인 (브라우저로 비교 필수)
└── .env.local
```

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase PostgreSQL (테이블: briefings, news_articles, terms) |
| 뉴스 | RSS 4개 + 네이버 경제탭 랭킹 스크래핑 + 네이버 검색 API |
| 자동화 | Vercel Cron Jobs (오전 9시 브리핑 + 오후 1시·5시·10시 뉴스) |
| 배포 | Vercel (git push → 자동 재배포) |
| 폰트 | Noto Sans KR (Google Fonts) |

---

## 레퍼런스 디자인 핵심 스펙

| 항목 | 값 |
|------|------|
| 배경 | `#F9FAFB` |
| 카드 배경 | `#FFFFFF` (모든 카드 흰색 통일) |
| 포인트 초록 | `#22C55E` |
| 상승 | `#16A34A` / 하락 `#DC2626` |
| 카드 radius | `14px` |
| TopBar 배경 | `#111827` |
| GNB 레이아웃 | `grid-cols-[1fr_auto_1fr]` |
| 콘텐츠 max-width | `900px` |

⚠️ 디자인 수정 시 color-preview.html과 반드시 브라우저에서 눈으로 비교할 것.

---

## 주의사항

| 상황 | 주의 |
|------|------|
| 코드 수정 후 | **반드시 git push** — 로컬 저장만으로는 Vercel 배포 안 됨 |
| OpenAI 여러 번 호출 | Vercel 타임아웃 → 반드시 **로컬**에서 실행 |
| 디자인 확인 | 코드만 보면 안 됨 — **브라우저에서 눈으로 직접** 비교 |
| 날짜 처리 | 전체 KST 기준으로 통일 (`+9h` 또는 `timeZone` 중 하나만) |
| briefings 저장 | upsert 방식. delete+insert로 되돌리지 말 것 |
| TOP3 선정 | 인덱스 번호 방식 (`top3Indices`). UUID 방식 복귀 금지 |
| 기준금리 | 네이버 금융 자동 수집. 하드코딩 금지 |
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
