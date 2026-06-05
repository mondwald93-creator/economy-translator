# 경제번역기 배포 가이드

## Vercel 배포

### 1단계: Vercel 계정 생성
- [vercel.com](https://vercel.com)에 접속
- GitHub 계정으로 로그인

### 2단계: GitHub 저장소 연동
- "New Project" 클릭
- GitHub 저장소 선택
- 기본 설정으로 배포 진행

### 3단계: 환경 변수 설정

Vercel 대시보드 → Settings → Environment Variables에서:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_role_key
OPENAI_API_KEY=your_api_key
```

### 4단계: 배포 확인

```bash
# 로컬에서 빌드 테스트
npm run build
npm run start
```

## Supabase 설정

### 1. 프로젝트 생성
- [supabase.com](https://supabase.com)에서 새 프로젝트 생성
- 데이터베이스 초기화 대기

### 2. 환경 변수 복사
- Project Settings → API에서:
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Service role secret → `SUPABASE_SERVICE_ROLE_KEY`

### 3. 테이블 생성

```sql
-- 경제용어 테이블
CREATE TABLE economic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_name VARCHAR(100) UNIQUE NOT NULL,
  definition TEXT NOT NULL,
  simple_explanation TEXT NOT NULL,
  real_life_example TEXT,
  category VARCHAR(100),
  difficulty_level VARCHAR(20) DEFAULT 'beginner',
  related_articles_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_economic_terms_name ON economic_terms(term_name);
CREATE INDEX idx_economic_terms_category ON economic_terms(category);

-- 뉴스 기사 테이블
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  summary TEXT,
  source_url VARCHAR(1000) UNIQUE NOT NULL,
  image_url TEXT,
  source VARCHAR(100),
  category VARCHAR(100),
  published_at TIMESTAMP NOT NULL,
  analysis_status VARCHAR(50) DEFAULT 'pending',
  analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_news_published_at ON news_articles(published_at DESC);
CREATE INDEX idx_news_category ON news_articles(category);
```

## OpenAI API 설정

### 1. API 키 생성
- [platform.openai.com](https://platform.openai.com)에서 API 키 생성
- 프로젝트 usage limits 설정 (월 $10 등)

### 2. 모델 선택
- 배치 작업: `gpt-4` (높은 품질)
- 실시간 분석: `gpt-4o` (빠른 속도)
- 용어 설명: `gpt-3.5-turbo` (비용 절감)

### 3. Rate limiting 설정
- 추후 배포 시에 구현 예정

## CI/CD 설정

### GitHub Actions (자동 배포)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 배치 작업 (Vercel Crons)

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/admin/sync/daily-briefing",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## 모니터링

### 1. 에러 추적 (Sentry)
```bash
npm install @sentry/nextjs
```

### 2. 성능 모니터링 (Vercel Analytics)
- Vercel 대시보시판에서 자동으로 활성화

### 3. 로그 확인
```bash
vercel logs
```

## 성능 최적화

### 1. 번들 크기 최적화
```bash
npm run build
# .next/static/ 확인
```

### 2. 이미지 최적화
```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={200}
/>
```

### 3. 캐싱 설정
```typescript
// next.config.js
images: {
  domains: ['news.naver.com'],
  deviceSizes: [640, 750, 828, 1080, 1200],
  imageSizes: [16, 32, 48, 64, 96],
}
```

## 보안

### 1. API 키 관리
- Supabase에서 RLS (Row Level Security) 활성화
- API 키는 환경 변수로만 관리

### 2. CORS 설정
```typescript
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL },
      ],
    },
  ];
}
```

### 3. Rate Limiting (향후)
```typescript
// lib/rateLimit.ts
import Ratelimit from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(100, '1 m'),
});

export async function checkRateLimit(identifier: string) {
  const result = await ratelimit.limit(identifier);
  return result.success;
}
```

## 트러블슈팅

### 빌드 오류
```bash
# 캐시 삭제 후 재빌드
rm -rf .next
npm run build
```

### 환경 변수 누락
```bash
# .env.local 확인
cat .env.local
```

### OpenAI API 오류
- API 키 확인
- 사용량 확인 (platform.openai.com)
- Rate limit 초과 확인

## 배포 체크리스트

- [ ] 환경 변수 설정 완료
- [ ] Supabase 테이블 생성 완료
- [ ] OpenAI API 키 생성 완료
- [ ] 로컬 빌드 성공
- [ ] GitHub 저장소 생성
- [ ] Vercel 연동 완료
- [ ] 배포 확인 완료
- [ ] 프로덕션 URL 테스트

## 문의

배포 관련 문의는 GitHub Issues를 통해 남겨주세요.
