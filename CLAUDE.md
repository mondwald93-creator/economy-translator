# 경제번역기 — Claude 작업 가이드

매일 한국 경제 뉴스를 초보자 언어로 정리해주는 웹사이트.

- 실서비스: **https://economytranslator.com** (2026-08-18 도메인 구매·연결. Vercel에서 구매, 연 $11.25, 만료 2027-08-18, 자동갱신)
  - 옛 주소 https://economy-translator.vercel.app 은 `vercel.json` redirects로 새 주소에 **308 영구 이동**. 단 **`/api/*`는 제외**(cron-job.org가 옛 주소로 9:00/9:07을 호출하므로 리다이렉트하면 Authorization 헤더가 떨어질 수 있음)
  - www.economytranslator.com → 본 주소 308 (Vercel 대시보드 Domains에서 설정)
- GitHub: https://github.com/mondwald93-creator/economy-translator
- 배포: git push → Vercel 자동 재배포
- 자동 업데이트(2026-07-02 구조 개편 — 하루 한 번 발행 보장):
  - **브리핑 생성은 하루 딱 한 번, 9시 뉴스 수집 이후.** `runDailyBriefing`이 멱등(오늘 브리핑이 이미 있으면 재생성 안 하고 그대로 둠) → 아침에 여러 번 돌아도 내용이 안 바뀜. 수동 재생성(`/api/generate-briefing` POST)만 `regenerate:true`로 강제.
  - **실질 주 생성자 = cron-job.org** 9:00 수집 / 9:07 브리핑. 시각이 정확하고 이 무렵 재료(뉴스)가 꽉 차서 품질이 좋음. **폐기하지 말 것(유지).**
  - **보험 = Vercel Cron** `/api/cron` = `20 0`(UTC) = **KST 9:20** (수집+브리핑 통합, 멱등). 무료 플랜이라 시각이 늦을 수 있으나 "9:07이 죽은 날만 대신 생성"하는 보험이라 무방. (`/api/cron`이 죽는 날은 9:07이 커버 = 양방향 이중화)
  - 뉴스레터(구독 메일)는 **실제로 브리핑을 새로 만든 실행만 발송** → 하루 한 번.
  - 목적 = "9시 무렵 재료 꽉 찬 브리핑이 완성돼, 하루 종일 안 바뀌게." (품질 우선 → 완성 ≈9:10, 8:30 얇은 재료로 만들던 옛 방식 폐기)
  - **왜 바꿨나(2026-07-02):** 옛 주력(8:30)이 재료 절반(그날 434건 vs 9시 870건)으로 만들어 비경제 기사가 섞였고, 9:07 백업이 좋은 재료로 다시 만들어 **덮어써서 같은 날 내용이 바뀌고 메일이 두 번 나갔음.** 원인=수집 로그로 규명, 커밋 `4155c76`.
  - (옛 기록의 "주력=Vercel 8:30 / 8시 정각·9시 폐기 예정"은 폐기된 계획임)

---

## 현재 상태

모든 기능 완료, 실서비스 운영 중. 서버 실행 지역 = **서울(icn1)**(2026-08-17, `vercel.json` regions).

**알고 있는 데이터 흠 (고치지 않기로 한 것, 분석할 때만 주의)**
- **6/6 ~ 8/18 00:20 저장분 중 매경·한경·SBS 기사 2,201건(16,566행)은 `original_url`이 `<![CDATA[https://…]]>` 껍데기째이고 `source`가 전부 '뉴스'로 잘못 붙어 있다.** 파서 버그(8/18 수정). 실사용자 영향이 거의 없어(방문자 3달 66명·검색 유입 0) **그대로 두기로 결정(2026-08-18)**. 언론사별 집계를 할 땐 이 구간의 '뉴스'가 대부분 매일경제(2,047건)임을 감안한다. 벗기려면 `original_url like '<![CDATA[%'` 행만 UPDATE하면 되고, 벗긴 뒤 91건은 이미 깨끗하게 저장된 행과 URL이 겹친다.
- **6/4 ~ 8/17 밤 저장분은 같은 URL이 여러 행이다**(회차마다 다시 저장하던 버그, 중복률 41~75%, 8/17 수정). 브리핑 풀·채점은 URL 기준으로 한 행만 쓰므로 영향 없음. 옛 행 정리는 미결.
- **8/17 23:30 ~ 8/18 00:24 저장분(배포 확인용 수동 회차)의 네이버뉴스 109건은 `published_at`이 null이다.** 정규 회차는 정상(회차당 시각 없음 5~10건 = 헤드라인). 원인 미확정.

**2026-08-14 · 08-17 · 08-18 수집 개편 요약** (상세 = 각 코드 주석)
- 랭킹 페이지(`popularDay.naver`) 제거 → 네이버 **경제 섹션**(`/section/101`, 헤드라인 10 + 추천 36) + RSS 10곳 + 검색 API 3키워드
- 브리핑 재료 = **발행 시각 기준 지난 24시간 창**(`briefingPool.ts`, 발행·채점 공용)
- 기존 URL 조회 100개씩 + 1,000행 상한 감지(`fetchExistingUrls`) → 회차마다 다시 저장하던 중복 종료
- RSS `<link>`·`<pubDate>` CDATA 벗기기(`stripCdata`) · 시간대 없는 pubDate는 +09:00(`normalizePubDate`, 헤럴드) · 0건 소스는 이유 표기(`reasons`)

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
- 지표 실시간화 (2026-06-08): page.tsx에서 Yahoo Finance 실시간 호출, AI 설명만 브리핑 병합

**페이지**
- `/` 홈: 헤드라인 + 지표 + 건강진단 + TOP3 + 연결관계 + 뉴스목록 + 경제공부
- `/news/[id]` 뉴스 상세
- `/briefing` 지난 브리핑 목록 · `/briefing/[date]` 날짜별 개별 페이지 (검색 유입용 개별 주소)
- `/dictionary` 경제용어 사전 · `/dictionary/[slug]` 용어별 개별 페이지 (검색 유입용 개별 주소)
- `/analyze` 링크 분석기
- `/calendar` 경제 달력
- `/bookmarks` 북마크
- `/unsubscribe` 구독 취소

---

## 자동화 흐름

```
[실질 주 생성 · 매일 9:00/9:07 KST] cron-job.org → /api/cron-news, /api/cron-briefing
  → 9:00 뉴스 수집(재료 꽉 참) → 9:07 브리핑 생성(멱등: 이미 있으면 skip)
  → 새로 만들었으면 뉴스레터 1회 발송

[보험 · 매일 9:20 KST 언저리] Vercel Cron → GET /api/cron
  → POST /api/collect-news → runDailyBriefing(멱등) → Supabase upsert 저장
  → 평소엔 9:07이 이미 만들어 skip. 9:07이 죽은 날만 대신 생성(+메일).

[오후 1시·5시·10시 KST] Vercel Cron → GET /api/cron-news
  → POST /api/collect-news   (뉴스 수집만, 브리핑 생성 없음)

[매일 10:00 KST] Vercel Cron → GET /api/grade-briefing (`0 1` UTC)
  → 오늘 브리핑 자동 채점 → briefing_scores 저장 (점수 조회 = 같은 경로 `?recent=N`, Bearer CRON_SECRET)
```

- ⚠️ **Vercel 무료 플랜 크론은 정각이 아니라 그 시간대 안 아무 때나 돈다.** 실측 = 보험 9:31~9:36 · 오후 13:24 · 17:28 · 22:10. **재배포 직후 그 시간대 회차가 통째로 빠질 수 있다**(2026-08-18 13:11 배포 → 1시 회차 미실행, 16:23 수동 1회로 메움).
- 회차별 저장 시각은 `news_articles.created_at`(KST +9h)으로 본다. 수집 로그 자체는 DB에 없다(Vercel 함수 로그에만).

- 멱등성: 오늘 briefings에 headline 있으면 `runDailyBriefing`이 재생성 없이 반환 → 같은 날 내용 안 바뀜. 저장은 그대로 `upsert(onConflict:date)`.
- 수집 실패 또는 0건 시 브리핑 생성을 건너뜀 (실패 감지 로직 있음).
- ⚠️ 8:30 Vercel 수집을 뺐으므로, 아주 드물게 9:00 수집까지 실패하면 브리핑이 9:20 보험까지 지연될 수 있음(복구는 됨). 더 튼튼히 하려면 8:30 수집전용 크론 추가 검토(무료 플랜 크론 개수 확인 필요).

---

## 절대 건드리지 말 것

과거에 수정했다가 버그가 생겼던 항목들. 아래 방식이 현재 정상 작동 중이므로 되돌리지 말 것.

| 항목 | 현재 방식 | 되돌리면 생기는 버그 |
|------|-----------|---------------------|
| TOP3 선정 | 인덱스 번호 기반 (`top3Indices`) | UUID 방식 복귀 시 항상 빈 배열 |
| 날짜 처리 | `+9h` 또는 `timeZone: 'Asia/Seoul'` 중 하나만 사용 | 둘 다 쓰면 날짜가 하루 앞으로 밀림 |
| briefings 저장 | `upsert({ onConflict: 'date' })` | delete+insert 복귀 시 저장 실패 → 당일 브리핑 유실 |
| 브리핑 하루 1회 발행 | `runDailyBriefing`이 멱등(오늘 headline 있으면 재생성 skip), 수동 POST만 `regenerate:true` | 멱등성 제거 시 아침에 두 번 돌아 같은 날 내용이 바뀌고 메일 2회 발송(2026-07-02 수정) |
| 뉴스레터 발송 | cron·cron-briefing에서 `briefingResult.generated`일 때만 `sendDailyNewsletter` | 무조건 발송 복귀 시 주력·백업이 각각 보내 구독자에게 하루 2회 발송 |
| GNB 레이아웃 | `grid-cols-[1fr_auto_1fr]` | flex-1 방식 복귀 시 메뉴 중앙 정렬 깨짐 |
| 뉴스 중복 제거 | URL + 제목 앞 20자 기준 (코드 레벨) | DB constraint에 의존하면 upsert 에러로 전체 수집 실패 |
| 뉴스 저장 방식 | `naverNews.ts` — 기존 URL 선조회 후 `insert` | upsert 복귀 시 DB constraint 없으면 전체 에러 |
| 기준금리 | 네이버 금융 자동 수집 | 하드코딩 금지 |
| vercel.json maxDuration | cron 300s, generate-briefing 300s | 삭제 시 타임아웃으로 크론 매일 실패 |
| Vercel `/api/cron` 시각 | `20 0`(UTC)=KST 9:20, 보험용 | 8:30으로 되돌리면 재료 절반으로 브리핑 만들어 비경제 기사 혼입(2026-07-02 개편으로 옮김) |
| cron-job.org 9시 | 9:00 수집 / 9:07 브리핑 = **실질 주 생성자**, 유지 | 폐기 시 브리핑 통째 유실(이제 Vercel은 9:20 보험이라 주 생성이 여기임 — 2026-07-02 역할 재정의) |
| 외부 호출 기다림 한도 | OpenAI 60초+재시도 1회(요약만 100초), 시세 fetch 10초 (openai.ts·generateBriefing.ts·marketData.ts) | 제거 시 외부 지연 1건이 5분 예산 전체 소진 → 브리핑 미생성 (2026-06-12 장애 원인) |
| Supabase briefings.date | unique constraint 적용됨 | 삭제 시 중복 행 문제 재발 |
| cron-briefing 응답 방식 | 즉시 `accepted` 응답 + `waitUntil` 백그라운드 실행 | 동기 대기로 복귀 시 cron-job.org 30초 timeout이 매일 실패로 기록 → 연속 25회면 크론잡 자동 비활성화(2026-06-12 발견) |
| page.tsx Supabase 클라이언트 | 매 렌더마다 `createClient` + `cache: 'no-store'` | 싱글톤 or no-store 제거 시 뉴스 목록 캐시로 빈 채 굳음 |
| page.tsx 지표 | `getMarketIndicators()` 실시간 호출 + 브리핑 AI 설명 병합 | `briefing.indicators` 단독 사용 복귀 시 9시 스냅샷만 표시 |
| **RLS(행 수준 보안)** | 5개 테이블 모두 RLS on. 공개 콘텐츠(briefings·news_articles·terms)만 `public read` SELECT 정책. subscribers·briefing_scores는 정책 없음(외부 완전 차단). SQL=`supabase/enable_rls.sql`. **2026-07-22 적용** | RLS 끄면 공개 anon 키로 누구나 구독자 이메일 읽기·전체 삭제 가능(Supabase 보안 경고 원인) |
| **DB 쓰기·구독자·채점 접근 키** | **서버는 `supabaseAdmin`(service_role 키, `src/lib/supabaseAdmin.ts`)로만.** 모든 write + subscribers + briefing_scores가 여기 의존. 공개 콘텐츠 '읽기'만 anon(`supabase.ts`). env=`SUPABASE_SERVICE_ROLE_KEY`(Vercel Production) | anon 키로 되돌리면 RLS에 막혀 발행·수집·채점·구독이 전부 실패. 새 서버 쓰기 코드도 반드시 `supabaseAdmin` import |
| **news_articles.published_at** | 기사 발행일 원본(RSS·검색 API pubDate). 파싱 실패 시 **null**(오늘로 추측 금지). 랭킹 스크래핑은 발행일이 없어 null. `date` 열(수집일)과 별개. 2026-07-24 신설 | 오늘 날짜로 채우면 오래된 기사가 '오늘 기사'로 둔갑(2026-07-23 7/16 발행 금리기사 재혼입 원인) |
| **후보 풀 관문(`articleGate.ts`)** | `runBriefing`의 `articleInputs` **상류 1곳**에서 신선도·연성·의견글 기사 제거. 헤드라인·TOP3·분야별 선정 공통 입구. 통과분<30이면 원본 사용(빈 브리핑 방지). 2026-07-24 신설 | 제거·우회 시 연성기사(건조기시트)·과거기사 재혼입, 분야별 목록까지 오염 |
| **뉴스 수집 소스(2026-08-14)** | RSS 10곳(`RSS_SOURCES`, 전부 경제 섹션 전용) + 네이버 **경제 섹션** `/section/101` + 검색 API 3키워드. **랭킹 페이지(`popularDay.naver`) 금지** | 랭킹 페이지는 언론사 83곳 인기 기사 모음이라 `sid1=101`을 붙여도 정치·연예가 그대로 들어옴(6/4~8/14 그랬음). 서울경제(AI학습 금지 명시)·머니투데이(피드 멈춤)·이데일리(TLS) 다시 넣지 말 것 |
| **서버 실행 지역 `icn1`(2026-08-17)** | `vercel.json` `"regions": ["icn1"]` | 기본(미국 iad1)으로 돌아가면 한국경제·뉴스1 RSS가 0건 |
| **브리핑 재료 창(2026-08-17)** | `briefingPool.ts` = 발행 시각 기준 **지난 24시간** + 시각 모르는 그날 수집분, URL 중복 제거, 1,000행 페이지네이션. **발행(`runBriefing`)·채점(`gradeBriefing`) 반드시 이 함수 하나** | `date = 그날`로 되돌리면 어제 오후 기사가 통째로 빠짐(풀 450→130건). 발행·채점이 다른 풀을 보면 심사위원이 브리핑이 못 본 기사로 채점(2026-07-09 실격 오판) |
| **기존 URL 조회(2026-08-17)** | `fetchExistingUrls` = 100개씩 `.in()` + 응답 1,000행이면 반분 재조회 + 조회 에러는 errors에 | 회차 URL 전부를 한 번에 물으면 414(URI Too Long)·1,000행 잘림 → 에러 삼키고 전부 재저장(6/4~8/17 중복률 41~75%의 원인) |
| **RSS 파서 CDATA·시간대(2026-08-17·18)** | `<link>`·`<pubDate>` 모두 `stripCdata()` · 시간대 없는 pubDate는 `normalizePubDate`가 +09:00 | 벗기지 않으면 매경·한경·SBS URL이 껍데기째 저장(source '뉴스'·원문 링크 깨짐), 뉴스1 발행 시각 전부 null. +09:00 없으면 헤럴드 밤 기사가 다음 날로 넘어감 |
| **배포 확인 방법** | GitHub 배포 API(`/repos/…/deployments` + statuses)·`x-vercel-id`·응답 필드 같은 **읽기 신호**. 라이브 데이터 확인은 다음 정규 회차 `created_at`으로 | **`POST /api/collect-news`를 폴링에 쓰지 말 것** — 옛 코드면 회차마다 수백 건 중복, 새 코드여도 시각 없는 네이버 행이 쌓였다(8/17 밤 109건). 수동 1회는 회차가 빠진 걸 메울 때만 |
| **화면 완료 기준(모바일, 2026-08-10 로드맵 P6-2)** | **새 페이지·화면 수정은 폰 실물(사용자 스크린샷)로 확인한 뒤 완료 선언.** 방문자 절반이 폰(GA 실측). 헤드리스 크롬은 폰 문제를 재현 못 함 | 데스크톱만 보고 끝내면 폰에서 깨진 채 배포됨(2026-08 모바일 최적화 P1~P5가 그걸 고친 작업) |

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
| 뉴스 | RSS 10곳(경제 섹션 전용) + 네이버 경제 섹션(헤드라인+추천) + 네이버 검색 API 3키워드 — 2026-08-14 개편 |
| 자동화 | 주 생성=cron-job.org 9:00 수집/9:07 브리핑, 보험=Vercel Cron(UTC 0:20=KST 9:20). 브리핑은 멱등이라 하루 1회 — 2026-07-02 개편. 채점=Vercel Cron KST 10:00 |
| 배포 | Vercel (git push → 자동 재배포). 실행 지역 서울(icn1). `git push`는 이 세션 도구에서 차단돼 있어 사용자가 `!` 접두사로 직접 실행 |

---

## 레퍼런스 디자인

`color-preview.html` — 브라우저로 열어서 디자인 비교 시 사용.

| 항목 | 값 |
|------|-----|
| 배경 | `#F9FAFB` |
| 포인트 초록 | `#22C55E` |
| 상승 | `#DC2626`(빨강) / 하락 `#2563EB`(파랑) — 한국 금융앱 관습, 2026-06-11 사용자 결정. 초록=상승으로 되돌리지 말 것 |
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
# 뉴스 수집 — ⚠️ 배포 확인용 폴링 금지(위 표 "배포 확인 방법"). 정규 회차가 빠졌을 때 1회만.
curl -X POST https://economytranslator.com/api/collect-news

# 브리핑 생성
curl -X POST https://economytranslator.com/api/generate-briefing
```
