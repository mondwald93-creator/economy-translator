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
| 로컬 개발 | `npm run dev` → http://localhost:3000 |

---

## 다음 세션 시작점 ← 여기서 시작

### ✅ 이번 세션 완료 (2026-06-05)

**레퍼런스(color-preview.html) 브라우저 직접 비교 + 홈 화면 디자인 전체 맞춤.**

#### 1. TopBar 확인 ✅
- Playwright로 localhost vs color-preview.html 스크린샷 직접 비교
- 높이 33px vs 33.5px (0.5px 차이 — 폰트 렌더링 오차, 시각적 동일)
- `leading-none` 정상 작동 확인

#### 2. NewsCardList 디자인 수정 ✅
- 섹션 타이틀: `text-[11px] uppercase gray` → `text-[13px] font-bold text-ink`
- 진행 표시: 동그란 점(8px circle) → 직사각형 바(`w-5 h-1 rounded-sm`) — 레퍼런스 동일
- 카드 패딩: `p-5`(20px) → `py-[22px] px-6`(22×24px) — 레퍼런스 동일
- 파일: `src/components/home/NewsCardList.tsx`

#### 3. EconomyStudy 디자인 수정 ✅
- 레이아웃: 세로 스택 → flex row (용어 설명 왼쪽, 버튼 오른쪽)
- 패딩: `p-5` → `py-6 px-7`(24×28px)
- 카드 radius: `rounded-card`(14px) → `rounded-[16px]`
- 레이블 색상: `text-white/50` → `text-[#6B7280]`
- 용어 폰트: `font-bold` → `font-black`
- "용어 더 보기 →" 초록 버튼 추가 (링크: `/dictionary`)
- 파일: `src/components/home/EconomyStudy.tsx`

#### 4. 지표 카드 데이터 수정 ✅
- DB 헤드라인 18자 이내로 직접 수정 (Supabase 직접 업데이트)
- 지표 변화값 절대값 → 퍼센트 + 화살표 형식 (`▼ -5.54%`, `▲ +0.43%`)
- **기준금리 3.50% — 동결** 카드 추가 (4번째 자리)
- 파일: `src/lib/marketData.ts` (향후 브리핑도 동일 형식 자동 적용)

---

### ⬜ 다음 할 일 — 여기서 바로 시작

#### ⬜ Phase 5 — 마무리 & 배포
1. 전체 페이지 통합 테스트
   - 홈(/) → 뉴스 상세(/news/[id]) → 링크분석기(/analyze) → 용어사전(/dictionary) → 달력(/calendar) → 북마크(/bookmarks)
   - 각 페이지 레퍼런스 색상·레이아웃 최종 확인
2. 모바일 반응형 확인 (375px 기준)
3. `git push` → Vercel 자동 재배포

> **시작 방법**: `npm run dev` 실행 후 http://localhost:3000 과 `color-preview.html` 나란히 열고 서브 페이지부터 하나씩 확인

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

## 전체 진행 상태

- ✅ MVP Phase 1~6 — 완료
- ✅ 리뉴얼 Phase 1~4 — 완료
- ✅ 추가: 뉴스 링크 분석기 / 경제용어 사전 / SEO / 경제 달력 / 북마크
- ✅ UX/UI 리뉴얼 Phase 1 — 디자인 시스템
- ✅ UX/UI 리뉴얼 Phase 2 — GNB + TopBar + 레이아웃
- ✅ UX/UI 리뉴얼 Phase 3 — 홈 화면 컴포넌트 7개
- ✅ 레이아웃 세부 조정 (GNB full-width, 헤드라인 길이, TopBar)
- ✅ UX/UI 리뉴얼 Phase 4 — 서브 페이지 5개
- ✅ TopBar 브라우저 비교 확인
- ✅ 홈 화면 레퍼런스 전체 맞춤 (NewsCardList, EconomyStudy, 지표 형식)
- ⬜ UX/UI 리뉴얼 Phase 5 — 마무리 & 배포

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
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx                 # leading-none, subpixel-antialiased, 7px dot ✅ 확인완료
│   │   │   └── GNB.tsx                    # full-width 완료 ✅
│   │   └── home/
│   │       ├── HeadlineBanner.tsx         # 18자 이내 헤드라인 ✅
│   │       ├── EconomyHealthCheck.tsx
│   │       ├── KeyIndicators.tsx
│   │       ├── Top3NewsSection.tsx
│   │       ├── ConnectionDiagram.tsx
│   │       ├── NewsCardList.tsx           # ✅ 이번 세션 수정 (타이틀·바·패딩)
│   │       └── EconomyStudy.tsx           # ✅ 이번 세션 수정 (flex row·버튼·스타일)
│   └── lib/
│       ├── generateBriefing.ts            # 헤드라인 첫 줄 18자 이내 제한
│       └── marketData.ts                  # ✅ 이번 세션 수정 (▲▼% 형식 + 기준금리 동결 자동 추가)
├── tailwind.config.ts
├── color-preview.html                     # ⭐ 레퍼런스 디자인 파일 (브라우저로 열어서 비교)
└── .env.local
```

---

## API 엔드포인트

| 엔드포인트 | 역할 |
|-----------|------|
| `POST /api/collect-news` | 네이버 API로 오늘 뉴스 수집 |
| `POST /api/generate-briefing` | AI 브리핑 생성 |
| `GET /api/cron` | 뉴스수집 + 브리핑생성 (Vercel 자동 호출) |
| `POST /api/analyze-link` | URL → GPT 4단계 분석 |
| `GET /api/terms` | 경제용어 검색 |

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 + TypeScript + Tailwind CSS |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase (테이블: briefings, news_articles, terms) |
| 뉴스 | 네이버 뉴스 검색 API |
| 자동화 | Vercel Cron Jobs (매일 UTC 23:00) |
| 배포 | Vercel (git push 하면 자동 재배포) |

**OpenAI 여러 번 호출하는 작업은 Vercel 10초 타임아웃 때문에 반드시 로컬에서 실행.**

---

## 사용자 정보

- 비개발자 (코드 설명 불필요)
- 한국어로만 소통
- 기술 용어 대신 쉬운 말로 설명 필요
