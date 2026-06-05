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
- **OpenAI API** - AI 분석
- **Supabase** - 데이터베이스 & 인증

### 배포
- **Vercel** - Next.js 최적화 호스팅

## 📁 프로젝트 구조

```
economy-translator/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 홈 (오늘의 브리핑)
│   │   ├── analyze/page.tsx      # 뉴스 분석 페이지
│   │   ├── dictionary/page.tsx   # 용어사전 페이지
│   │   └── api/                  # API 라우트
│   ├── components/               # 리액트 컴포넌트
│   ├── lib/                      # 유틸리티 함수
│   ├── hooks/                    # Custom hooks
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
git clone https://github.com/your-repo/economy-translator.git
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

## 📡 API 엔드포인트

### 브리핑
- `GET /api/briefing` - 오늘의 브리핑 조회

### 분석
- `POST /api/analyze` - 뉴스 URL 또는 텍스트 분석 (SSE 스트리밍)
- `POST /api/analyze/save` - 분석 결과 저장

### 경제용어
- `GET /api/dictionary/search?q=환율` - 용어 검색

### 경제 건강진단
- `GET /api/health/current` - 현재 경제 건강진단

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

주요 테이블:
- `users` - 사용자 정보
- `news_articles` - 뉴스 기사
- `article_analyses` - 기사 분석 결과
- `briefings` - 경제 브리핑
- `economic_terms` - 경제용어 사전
- `economy_health` - 경제 건강진단

자세한 스키마는 [DATABASE.md](./DATABASE.md) 참고

## 🗓️ 개발 로드맵

### Phase 1: MVP (1-2개월)
- ✅ 경제용어 검색
- ✅ 뉴스 URL 분석
- ✅ 오늘의 브리핑 (고정 데이터)
- ✅ 경제 건강진단
- 🔄 사용자 인증

### Phase 2: 확장 (2-3개월)
- [ ] 실시간 뉴스 크롤링
- [ ] 배치 작업 (매일 아침)
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
