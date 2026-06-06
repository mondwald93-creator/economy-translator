# 경제번역기 — 인수인계 문서

> 다음 세션에서 이 파일을 먼저 읽고 시작하세요.
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
| 자동 업데이트 | 매일 한국시간 **오전 9시** (Vercel Cron) |
| 로컬 개발 | `npm run dev` → http://localhost:3000 |

---

## 다음 세션 시작점 ← 여기서 시작

### ⬜ Phase 5 — 마무리 & 배포
1. 전체 페이지 통합 테스트
   - 홈(/) → 뉴스 상세(/news/[id]) → 링크분석기(/analyze) → 용어사전(/dictionary) → 달력(/calendar) → 북마크(/bookmarks)
   - 각 페이지 레퍼런스(color-preview.html) 색상·레이아웃 최종 확인
2. 모바일 반응형 확인 (375px 기준)
3. 완료 후 HANDOVER.md 업데이트

> **시작 방법**: `npm run dev` 켜고 localhost:3000 과 `color-preview.html` 나란히 열고 서브 페이지부터 확인

---

## 이번 세션 완료 (2026-06-06)

### 1. 실서비스 배포 문제 전체 수정 ✅

**문제 1 — UI 리뉴얼 코드 배포 안 됨**
- Phase 1~4 디자인 작업(24개 파일)이 git push 없이 로컬에만 있었음
- 이번 세션에 처음 push → 실서비스 반영됨

**문제 2 — Cron URL 버그**
- `NEXT_PUBLIC_APP_URL=http://localhost:3001`이 Vercel 환경에서 없으면 localhost:3001 호출 → 매일 실패
- 수정: `VERCEL_URL` 환경변수 폴백 추가
- 파일: `src/app/api/cron/route.ts`

**문제 3 — 날짜 UTC/KST 불일치**
- 뉴스 pubDate(KST)를 UTC로 변환해서 "오늘" 판단 → 오전엔 전날로 인식
- 수정: 전체 날짜 계산을 KST 기준으로 통일
- 파일: `src/lib/naverNews.ts`

---

### 2. 크론 시간 변경 ✅
- 오전 8시 → **오전 9시 (KST)**
- 이유: 코스피·코스닥·환율이 9시에 개장하므로 9시 이후 수집해야 당일 지표 반영
- 파일: `vercel.json` — `"schedule": "0 0 * * *"`

---

### 3. 뉴스 수집 전면 개편 ✅

**기존 문제**: 키워드 검색만 하다 보니 젠슨황 방한 같은 핫이슈 기사가 하나도 안 들어옴 (2개 수집)

**새 방식 — 3개 소스 병렬 수집**:

| 소스 | 내용 | 역할 |
|------|------|------|
| RSS 4개 | 연합뉴스·한국경제·매일경제·서울경제 | 편집자 선별 주요 기사 |
| 네이버 많이본 기사 | news.naver.com 경제탭 랭킹 스크래핑 | 실제로 많이 읽힌 기사 |
| 키워드 검색 3개 | 한국 경제·코스피 코스닥·환율 금리 | 지표 관련 기사 보완 |

- 결과: 2개 → **516개** (젠슨황 관련 58개 포함)
- 파일: `src/lib/naverNews.ts`

---

### 4. 브리핑 한국 경제 중심으로 수정 ✅

**기존 문제**: TOP3에 "미 취업자수 급증", "美 반도체 충격" 같은 미국 뉴스가 선정됨

**수정 내용**:
1. 기사 정렬: 외신 키워드 포함 기사(미국·美·중국·연준·나스닥 등) 뒤로 밀고 한국 뉴스 우선 노출
2. AI 프롬프트: "해외 경제 뉴스는 TOP3 절대 선정 금지, 한국 국내 경제 기사만" 명시
3. TOP3 선정 방식: 인덱스 기반 → **ID 기반**으로 변경 (정렬 후 인덱스 불일치 버그 수정)
- 파일: `src/lib/generateBriefing.ts`, `src/app/api/generate-briefing/route.ts`

---

## 전체 진행 상태

- ✅ MVP Phase 1~6 — 완료
- ✅ 리뉴얼 Phase 1~4 — 완료
- ✅ 추가: 뉴스 링크 분석기 / 경제용어 사전 / SEO / 경제 달력 / 북마크
- ✅ UX/UI 리뉴얼 Phase 1 — 디자인 시스템
- ✅ UX/UI 리뉴얼 Phase 2 — GNB + TopBar + 레이아웃
- ✅ UX/UI 리뉴얼 Phase 3 — 홈 화면 컴포넌트 7개
- ✅ 레이아웃 세부 조정 (GNB full-width, 헤드라인 길이, TopBar)
- ✅ UX/UI 리뉴얼 Phase 4 — 서브 페이지 5개
- ✅ 홈 화면 레퍼런스 전체 맞춤 (NewsCardList, EconomyStudy, 지표 형식)
- ✅ 실서비스 배포 문제 수정 (Cron URL 버그, 날짜 UTC/KST 불일치)
- ✅ 크론 오전 8시 → 9시 변경
- ✅ 뉴스 수집 전면 개편 (RSS + 네이버 랭킹 + 키워드)
- ✅ 브리핑 한국 경제 중심 수정 (TOP3 ID 기반, 해외뉴스 배제)
- ⬜ UX/UI 리뉴얼 Phase 5 — 마무리 & 배포 ← **다음 세션 시작점**

---

## 레퍼런스 디자인 핵심 스펙

| 항목 | 값 |
|------|------|
| 배경 | `#F9FAFB` |
| 본문 텍스트 | `#111827` |
| 포인트 초록 | `#22C55E` |
| 상승 초록 | `#16A34A` |
| 하락 빨강 | `#DC2626` |
| 카드 배경 | `#ffffff` |
| 카드 보더 | `#F3F4F6` |
| 카드 radius | `14px` |
| TopBar 배경 | `#111827` |
| TopBar padding | `8px 0` |
| TopBar 앞 텍스트 | `#F9FAFB` bold 12px |
| TopBar 뒤 텍스트 | `#9CA3AF` 12px |
| TopBar 구분자 | `#374151` |
| GNB 높이 | `60px` |
| **GNB 너비** | **full-width (max-width 없음)** |
| **GNB padding** | **`0 48px` (px-12)** |
| GNB 활성 메뉴 | `bg-[#F0FDF4] text-[#16A34A] font-bold` |
| GNB 업데이트 칩 | `bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A] 11px 5px 12px radius-20px` |
| 헤드라인 h1 | `36px / font-weight:900 / line-height:1.25 / letter-spacing:-1.2px` |
| 헤드라인 줄 1 | `#111827` (검정) / **18자 이내** |
| 헤드라인 줄 2 | `#16A34A` (초록) |
| lead 문단 | `15px / line-height:1.8 / border-left:3px #22C55E / max-width:640px` |
| 긴박감 배너 | `bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]` + D-day 오른쪽 |
| 컨디션 카드 | `from-[#ECFDF5] to-[#D1FAE5] border-[#A7F3D0]` radius 16px |
| 지표 숫자 | `22px font-black #111827` |
| 지표 변화값 | `▲ +X.XX%` / `▼ -X.XX%` / `— 동결` 형식 |
| 뉴스 카드 패딩 | `22px 24px` |
| 뉴스 섹션 타이틀 | `13px font-bold #111827` + 직사각형 진행바 |
| 경제용어 카드 | `bg-#111827 / radius-16px / py-6 px-7 / flex row` + 초록 버튼 오른쪽 |
| 콘텐츠 max-width | `900px` |

---

## 확정된 디자인 방향 (변경 금지)

**디자인 컨셉: "미니멀 에디토리얼 + 젊은 층 참여 요소"**
- ⚠️ 디자인 방향 다시 묻지 말 것
- ⚠️ 디자인 확인 시 반드시 브라우저에서 눈으로 직접 비교할 것 (코드만 보면 안 됨)

---

## 뉴스 수집 구조 (현재)

```
collectAndSaveNews()
├── fetchRSSFeeds()          # 연합뉴스·한국경제·매일경제·서울경제 RSS
├── fetchNaverRankingNews()  # 네이버 경제탭 많이본 기사 스크래핑 (EUC-KR 디코딩)
└── fetchNaverKeywordNews()  # 키워드 3개: 한국경제 / 코스피코스닥 / 환율금리
→ URL 기준 중복 제거 후 Supabase 저장
```

## 브리핑 생성 구조 (현재)

```
generateMainBriefing(articles, indicators)
├── 기사 정렬: 외신 키워드(미국·美·연준·나스닥 등) 포함 기사 뒤로
├── 상위 30개 → AI에 [ID:xxxx] 형식으로 전달
└── AI 반환: top3Ids (ID 배열) → route에서 ID로 기사 매핑
```

---

## 화면 구성 (현재)

| 페이지 | 주소 | 내용 |
|--------|------|------|
| 홈 | `/` | 헤드라인 + 지표(4개) + 건강진단 + TOP3 + 연결관계 + 뉴스목록 + 경제공부 |
| 뉴스 상세 | `/news/[id]` | 기사 제목 + 쉬운 설명 + 원본 링크 |
| 링크 분석기 | `/analyze` | URL 입력 → AI 4단계 분석 결과 카드 |
| 경제용어 사전 | `/dictionary` | 검색 + 카테고리 필터 + 용어 카드 |
| 경제 달력 | `/calendar` | 2026년 연간 경제 일정 |
| 북마크 | `/bookmarks` | 저장한 뉴스 목록 (localStorage) |

---

## 파일 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Google Fonts + max-w-[900px] 메인 레이아웃
│   │   ├── page.tsx                       # 컴포넌트 순서: Headline→KeyIndicators→HealthCheck→Top3→Connection→News→Study
│   │   ├── analyze/page.tsx               # ✅ 리뉴얼 완료
│   │   ├── dictionary/page.tsx            # ✅ 리뉴얼 완료
│   │   ├── calendar/page.tsx              # ✅ 리뉴얼 완료
│   │   ├── bookmarks/page.tsx             # ✅ 리뉴얼 완료
│   │   └── news/[id]/page.tsx             # ✅ 리뉴얼 완료
│   │   └── api/
│   │       ├── cron/route.ts              # VERCEL_URL 폴백 수정 완료
│   │       ├── collect-news/route.ts
│   │       └── generate-briefing/route.ts # TOP3 ID 기반 매핑으로 수정
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx                 # ✅ 확인완료
│   │   │   └── GNB.tsx                    # ✅ full-width 완료
│   │   └── home/
│   │       ├── HeadlineBanner.tsx
│   │       ├── EconomyHealthCheck.tsx
│   │       ├── KeyIndicators.tsx
│   │       ├── Top3NewsSection.tsx
│   │       ├── ConnectionDiagram.tsx
│   │       ├── NewsCardList.tsx
│   │       └── EconomyStudy.tsx
│   └── lib/
│       ├── naverNews.ts                   # 뉴스 수집 전면 개편 (RSS+랭킹+키워드)
│       ├── generateBriefing.ts            # 한국 경제 중심 TOP3 + ID 기반 선정
│       └── marketData.ts                  # ▲▼% 형식 + 기준금리 동결 자동 추가
├── vercel.json                            # cron: "0 0 * * *" (오전 9시 KST)
├── tailwind.config.ts
├── color-preview.html                     # ⭐ 레퍼런스 디자인 파일 (브라우저로 열어서 비교)
└── .env.local
```

---

## API 엔드포인트

| 엔드포인트 | 역할 |
|-----------|------|
| `POST /api/collect-news` | RSS+랭킹+키워드로 뉴스 수집 |
| `POST /api/generate-briefing` | AI 브리핑 생성 (한국 경제 중심) |
| `GET /api/cron` | 뉴스수집 + 브리핑생성 (Vercel 자동 호출, 오전 9시) |
| `POST /api/analyze-link` | URL → GPT 4단계 분석 |
| `GET /api/terms` | 경제용어 검색 |

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 + TypeScript + Tailwind CSS |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase (테이블: briefings, news_articles, terms) |
| 뉴스 | RSS 4개 + 네이버 경제탭 랭킹 + 네이버 검색 API |
| 자동화 | Vercel Cron Jobs (매일 UTC 00:00 = 한국 오전 9시) |
| 배포 | Vercel (git push 하면 자동 재배포) |

**OpenAI 여러 번 호출하는 작업은 Vercel 10초 타임아웃 때문에 반드시 로컬에서 실행.**

---

## 주의사항

- **작업 후 반드시 git push까지 해야 실서비스에 반영됨** — 로컬 저장만으로는 Vercel 배포 안 됨
- 디자인 확인은 코드 비교 말고 반드시 브라우저에서 눈으로 확인
- 네이버 랭킹 스크래핑은 EUC-KR 인코딩 처리 필요 (TextDecoder 사용 중)

---

## 사용자 정보

- 비개발자 (코드 설명 불필요)
- 한국어로만 소통
- 기술 용어 대신 쉬운 말로 설명 필요
