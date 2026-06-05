# API 문서

## 기본 정보

- **Base URL**: `https://economy-translator.vercel.app/api`
- **응답 형식**: JSON
- **인증**: Supabase JWT Token (필요시)

## 응답 형식

모든 API는 다음과 같은 표준 응답 형식을 사용합니다:

```json
{
  "success": true,
  "data": { /* 응답 데이터 */ },
  "error": null
}
```

에러 발생 시:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## 엔드포인트

### 1. 브리핑 API

#### GET /briefing
오늘의 경제 브리핑을 조회합니다.

**응답:**
```json
{
  "briefing": {
    "id": "uuid",
    "briefing_date": "2024-06-02",
    "one_line_summary": "오늘의 한줄 요약",
    "daily_lesson": "10살도 이해하는 설명",
    "health_metrics": {
      "inflation": { "status": "good|normal|warning", "summary": "..." },
      "consumption": { ... },
      "employment": { ... },
      "export": { ... },
      "real_estate": { ... },
      "financial_market": { ... }
    }
  },
  "articles": [
    {
      "id": "uuid",
      "title": "기사 제목",
      "analysis": {
        "what_is_this": "무슨 기사인가?",
        "simple_explanation": "쉽게 설명하면?",
        "why_important": "왜 중요한가?",
        "korean_impact": "한국 경제 영향",
        "key_points": "핵심 포인트",
        "mentioned_terms": ["term_id1", "term_id2"],
        "importance_score": 0.85
      }
    }
  ]
}
```

---

### 2. 분석 API

#### POST /analyze
뉴스 URL 또는 텍스트를 분석합니다. **Server-Sent Events로 스트리밍됩니다.**

**요청:**
```json
{
  "sourceUrl": "https://n.news.naver.com/article/xxxxx",
  "sourceText": "기사 본문 (선택)",
  "sourceTitle": "기사 제목 (선택)"
}
```

**응답 (스트리밍):**
```
data: {
  "step": "analyzing",
  "whatIsThis": "무슨 기사인가?",
  "simpleExplanation": "쉽게 설명하면?",
  ...
}

data: {
  "step": "completed"
}
```

**클라이언트 구현 예:**
```typescript
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceUrl: 'https://...' })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.slice(6));
      console.log(json);
    }
  }
}
```

#### POST /analyze/save
분석 결과를 저장합니다. (인증 필요)

**요청:**
```json
{
  "sourceUrl": "https://...",
  "sourceTitle": "기사 제목",
  "analysisResult": { /* 분석 결과 */ }
}
```

**응답:**
```json
{
  "id": "uuid",
  "savedAt": "2024-06-02T10:30:00Z"
}
```

---

### 3. 경제용어 API

#### GET /dictionary/search
경제용어를 검색합니다.

**쿼리 파라미터:**
- `q` (string) - 검색 키워드
- `category` (string, 선택) - 카테고리 필터
- `page` (number, 선택) - 페이지 (기본값: 1)
- `limit` (number, 선택) - 페이지당 항목 수 (기본값: 20)

**응답:**
```json
{
  "items": [
    {
      "id": "uuid",
      "term_name": "환율",
      "definition": "정의",
      "simple_explanation": "쉬운 설명",
      "real_life_example": "실생활 예시",
      "category": "금융",
      "difficulty_level": "beginner|intermediate|advanced",
      "related_articles_count": 15
    }
  ],
  "total": 127,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

#### GET /dictionary/all
모든 경제용어를 조회합니다.

**쿼리 파라미터:**
- `page` (number, 선택)
- `limit` (number, 선택)
- `category` (string, 선택)

---

### 4. 경제 건강진단 API

#### GET /health/current
현재 경제 건강진단을 조회합니다.

**응답:**
```json
{
  "date": "2024-06-02",
  "metrics": {
    "inflation": {
      "status": "good|normal|warning",
      "summary": "물가 상황 설명"
    },
    "consumption": { ... },
    "employment": { ... },
    "export": { ... },
    "real_estate": { ... },
    "financial_market": { ... }
  },
  "overall_assessment": "종합 평가"
}
```

---

## 에러 코드

| 코드 | 설명 |
|------|------|
| INVALID_INPUT | 입력값이 유효하지 않음 |
| INVALID_URL | URL 형식이 잘못됨 |
| ANALYSIS_FAILED | 분석 실패 |
| NOT_FOUND | 데이터를 찾을 수 없음 |
| UNAUTHORIZED | 인증 필요 |
| FORBIDDEN | 권한 없음 |
| RATE_LIMITED | API 호출 제한 초과 |
| SERVER_ERROR | 서버 오류 |

---

## 예제

### JavaScript/TypeScript

```typescript
import { apiGet, apiPost, apiStreamPost } from '@/lib/api';

// 브리핑 조회
const briefing = await apiGet('/briefing');

// 뉴스 분석
await apiStreamPost(
  '/analyze',
  { sourceUrl: 'https://...' },
  (chunk) => {
    const data = JSON.parse(chunk);
    console.log(data);
  }
);

// 용어 검색
const terms = await apiGet('/dictionary/search', {
  searchParams: { q: '환율' }
});
```

### cURL

```bash
# 브리핑 조회
curl https://economy-translator.vercel.app/api/briefing

# 분석 요청 (SSE)
curl -X POST https://economy-translator.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"sourceUrl": "https://..."}'

# 용어 검색
curl "https://economy-translator.vercel.app/api/dictionary/search?q=환율"
```

---

## Rate Limiting

현재 MVP 단계에서는 제한이 없으나, 프로덕션 배포 시 구현 예정:
- Per IP: 100 requests/minute
- Per User: 1000 requests/hour

---

## 문의

API 관련 문의는 GitHub Issues를 통해 남겨주세요.
