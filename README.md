# 경제번역기 (Economy Translator)

경제 초보자를 위한 AI 기반 경제 뉴스 해설 서비스

## 🎯 프로젝트 개요

복잡한 경제 뉴스를 이해하지 못하는 일반인을 위해 AI가 경제 선생님처럼 설명해주는 서비스입니다.

### 핵심 기능

1. **📰 오늘의 경제 브리핑** - 매일 경제 헤드라인 분석 및 브리핑
2. **🔍 뉴스 링크 분석기** - URL 입력 시 AI 분석
3. **📚 경제용어 사전** - 검색 기능이 있는 경제용어 설명

### 차별점

- 뉴스 **요약** 서비스가 아닌 **경제 과외** 서비스
- 중학생도 이해할 수 있는 수준의 설명
- 경제 선생님 페르소나의 정구조화된 설명 (무엇 → 쉬움 → 왜중요 → 영향 → 용어 → 핵심)

## 🏗️ 기술 스택

### Frontend
- **Next.js 14** - React 프레임워크
- **TypeScript** - 타입 안정성
- **TailwindCSS** - 스타일링
- **Zustand** - 상태 관리 (선택)

### Backend
- **Next.js API Routes** - 백엔드
- **OpenAI API** - AI 분석 (gpt-4o-mini, 품질 채점의 사실 항목만 gpt-4o)
- **Supabase** - 데이터베이스 (PostgreSQL, RLS 적용)

### 배포
- **Vercel** - Next.js 최적화 호스팅

## 📁 프로젝트 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 홈 (오늘의 브리핑)
│   │   ├── briefing/             # 지난 브리핑 목록 + 날짜별 개별 페이지
│   │   ├── news/[id]/            # 뉴스 상세
│   │   ├── analyze/page.tsx      # 뉴스 분석 페이지
│   │   ├── dictionary/           # 용어사전 + 용어별 개별 페이지
│   │   ├── calendar/page.tsx     # 경제 달력
│   │   ├── bookmarks/page.tsx    # 북마크
│   │   └── api/                  # API 라우트 15개
│   ├── components/               # 리액트 컴포넌트
│   ├── lib/                      # 수집·생성·채점 로직 (naverNews, runBriefing, gradeBriefing 등)
│   ├── types/                    # TypeScript 타입
│   └── styles/                   # 글로벌 스타일
├── public/                       # 정적 파일
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── .env.example
```

## 🚀 시작하기

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/mondwald93-creator/economy-translator.git
cd economy-translator

# 의존성 설치
npm install
# 또는
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 개발 서버 실행

```bash
npm run dev
# 또는
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 앱이 실행됩니다.

## 🧪 테스트

```bash
# 타입 체크
npm run type-check

# Lint 실행
npm run lint

# 빌드
npm run build
```

## 📡 API 엔드포인트 (주요)

### 자동 발행 파이프라인
- `GET /api/cron` - 보험용 통합 크론 (수집 + 브리핑, 멱등)
- `GET /api/cron-news` / `GET /api/cron-briefing` - 뉴스 수집 / 브리핑 생성 크론
- `POST /api/collect-news` - 뉴스 수집
- `POST /api/generate-briefing` - 브리핑 생성 (`regenerate:true`로만 강제 재생성)

### 품질·구독
- `POST /api/grade-briefing` - 발행분 자동 채점 (LLM-as-judge)
- `POST /api/subscribe` / `POST /api/unsubscribe` - 뉴스레터 구독/해지

### 조회·분석
- `POST /api/analyze-link` - 뉴스 링크 분석
- `GET /api/terms` - 경제용어 검색

전체 라우트는 `src/app/api/` 15개 참조.

## 🤖 OpenAI 프롬프트

### 시스템 프롬프트

```
당신은 경제 초보자를 위한 경제 선생님입니다.

목표: 복잡한 경제 뉴스를 중학생도 이해할 수 있게 설명하세요.

항상 다음 순서로 설명합니다:
1. 무슨 기사인가? - 기사의 핵심을 한두 문장으로
2. 쉽게 설명하면? - 일상적인 예시를 들어 설명
3. 왜 중요한가? - 이 뉴스가 중요한 이유
4. 한국 경제에 미치는 영향 - 구체적인 영향 분석
5. 핵심 포인트 - 초보자가 꼭 알아야 할 내용
```

## 📊 데이터베이스 스키마

실제 테이블 5개 (전부 RLS 적용):
- `briefings` - 매일 발행되는 경제 브리핑 (date unique, 하루 1건)
- `news_articles` - 수집된 뉴스 기사
- `terms` - 경제용어 사전
- `subscribers` - 뉴스레터 구독자 (외부 접근 완전 차단)
- `briefing_scores` - 자동 채점 결과 (외부 접근 완전 차단)

스키마 SQL은 `supabase/` 폴더 참고

## 🛡️ 품질 관리

AI 출력을 그대로 내보내지 않는다. 3층으로 검증한다.

| 층 | 방식 | 예 |
|----|------|-----|
| 1. 프롬프트 | 생성 규칙을 AI에게 지시 | 해외 단독 뉴스·단순 지수 시황 선정 금지 |
| 2. 코드 검문 | AI 결과를 코드가 재검사하고 교체 | `enforceTop3Rules`: TOP3가 중복이거나 시황이면 다른 기사로 자동 교체 |
| 3. 자동 채점 | 매일 발행분을 채점해 기록 | `gradeBriefing.ts` (기준표 v3.1) |

**채점기 (`src/lib/gradeBriefing.ts`)**

- 발행 경로와 완전 분리. 채점이 실패해도 발행은 막히지 않는다
- 형식 검사는 코드로 (글자 수·개수 세기를 AI에게 시키지 않음), hard/soft 2단계
- AI 채점은 항목별로 호출을 분리 (한 항목의 감점이 다른 항목을 오염시키는 것을 구조로 차단)
- 감점하려면 근거를 지목해야 하고, 그 지목이 실제 대조 자료에 있는지 코드가 검증한다. 지목 실패는 만점이 아니라 '판정 불가'로 기록
- 채점기 자체의 신뢰도를 사람 채점 13일치와 대조해 실측. 사람과 맞는 항목(이해도·사실)만 점수로 쓰고, 안 맞는 항목(선정·다양성)은 관측 전용으로 강등
- 자동 경보는 코드로 확실히 검증되는 것(하드 형식 탈락·실격)만 낸다. LLM 점수는 경보 권한 없음 (v3.1)

## 🗓️ 개발 로드맵

### Phase 1: MVP (1-2개월)
- ✅ 경제용어 검색
- ✅ 뉴스 URL 분석
- ✅ 오늘의 브리핑 (고정 데이터)
- ✅ 경제 건강진단
- ⏸️ 사용자 인증 (계정 없이 운영하는 구조로 확정, 보류)

### Phase 2: 확장 ✅ 완료
- ✅ 실시간 뉴스 수집 (RSS 4개 + 네이버 경제탭 스크래핑 + 검색 API, 하루 500건 이상)
- ✅ 매일 자동 발행 (9:00 수집 → 9:07 브리핑 생성, cron-job.org + Vercel Cron 이중화)
- ✅ 뉴스레터 자동 발송 (구독자 대상 하루 1회, 실제 생성된 날만)
- ✅ 품질 자동 채점 (아래 품질 관리 참고)
- [ ] 사용자 맞춤 브리핑
- [ ] 분석 이력 조회

### Phase 3: 고도화
- [ ] 경제 전문가 검증
- [ ] 모바일 앱
- [ ] 다국어 지원

## 📝 라이선스

MIT

## 🤝 기여

Pull Request는 언제나 환영합니다!

## 📧 문의

문제가 있으시면 Issue를 등록해주세요.
