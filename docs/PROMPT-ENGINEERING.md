# 프롬프트 엔지니어링 가이드

## OpenAI 프롬프트 전략

### 시스템 프롬프트

경제 뉴스를 분석할 때 사용하는 시스템 프롬프트입니다.

```
당신은 경제 초보자를 위한 경제 선생님입니다.

특징:
- 중학생도 이해할 수 있는 수준의 설명
- 실생활 예시를 풍부하게 사용
- 전문 용어는 쉬운 말로 설명
- 객관적이고 중립적인 태도
- 투자 조언은 절대 하지 않음

항상 이 순서를 따릅니다:
1. 무슨 기사인가? → 핵심을 1-2문장으로
2. 쉽게 설명하면? → 일상적인 예시로 설명
3. 왜 중요한가? → 뉴스 중요도와 영향력
4. 한국 경제에 미치는 영향 → 국내 경제에 미치는 구체적 영향
5. 핵심 포인트 → 초보자가 꼭 알아야 할 내용

문체:
- 존댓말 사용
- 1인칭은 "우리"로 통일
- 이모지 활용 (👍, ⚠️, 💡 등)
- 복잡한 문장보다 짧고 명확한 문장 선호
```

### 사용자 프롬프트 템플릿

```
다음 기사를 분석해주세요:

제목: {article_title}

본문:
{article_content}

위 기사를 경제 초보자도 이해할 수 있게 설명해주세요.
```

## 프롬프트 최적화 팁

### 1. 맥락 제공

❌ 나쁜 예:
```
이 기사가 뭐하는 거야?
```

✅ 좋은 예:
```
다음은 네이버 뉴스의 경제 기사입니다. 
경제 초보자도 이해할 수 있도록 설명해주세요.

기사: [기사 내용]
```

### 2. 구조화된 출력

❌ 나쁜 예:
```
뉴스를 설명해줄 수 있니?
```

✅ 좋은 예:
```
다음 형식으로 답변해주세요:

1. 무슨 기사인가? [한 두 문장]
2. 쉽게 설명하면? [일상적 예시]
3. 왜 중요한가? [중요도]
4. 한국 경제 영향 [국내 영향]
5. 핵심 포인트 [초보자용]
```

### 3. 역할 지정

```
당신은 경제 선생님입니다. 
복잡한 경제 개념을 쉽게 설명하는 것이 당신의 강점입니다.
```

## 비용 최적화

### 모델 선택 기준

| 상황 | 추천 모델 | 이유 |
|------|---------|------|
| 매일 아침 브리핑 | gpt-4 | 품질 중요, 1회/일 |
| 실시간 분석 | gpt-4o | 속도 + 품질 균형 |
| 용어 설명 | gpt-3.5-turbo | 비용 절감, 단순 설명 |
| 배치 작업 | gpt-4 | 품질 중요, 배치 처리 |

### 비용 계산

```javascript
// gpt-4o 기준
const estimateCost = (inputTokens, outputTokens) => {
  const INPUT_PRICE = 0.000005; // $0.000005 per token
  const OUTPUT_PRICE = 0.000015; // $0.000015 per token
  
  return (inputTokens * INPUT_PRICE) + (outputTokens * OUTPUT_PRICE);
};

// 예: 입력 500토큰, 출력 1000토큰
console.log(estimateCost(500, 1000)); // 약 $0.02
```

## 프롬프트 테스트

### ChatGPT에서 테스트

```
[시스템 프롬프트]
당신은 경제 초보자를 위한 경제 선생님입니다...

[사용자 프롬프트]
다음 기사를 분석해주세요:

제목: 미국 금리 인상 예상... 환율 올라갈 듯
본문: ...
```

### 평가 기준

1. **이해도** - 중학생 수준에서 이해 가능?
2. **정확성** - 경제 개념이 정확한가?
3. **유용성** - 실생활 예시가 충분한가?
4. **길이** - 너무 길거나 짧지 않은가?
5. **톤** - 일관되고 친절한가?

## API 통합

### 비용 추적

```typescript
// src/lib/openai.ts
export const estimateApiCost = (
  inputTokens: number,
  outputTokens: number,
  model: 'gpt-4' | 'gpt-4o' | 'gpt-3.5-turbo' = 'gpt-4o'
): number => {
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.00003, output: 0.00006 },
    'gpt-4o': { input: 0.000005, output: 0.000015 },
    'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
  };

  const rate = costs[model];
  return (inputTokens * rate.input) + (outputTokens * rate.output);
};
```

### 에러 처리

```typescript
try {
  const completion = await openai.chat.completions.create({...});
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      // Rate limit - 재시도
      console.log('Rate limited, retrying...');
    } else if (error.status === 401) {
      // 인증 오류
      console.log('Invalid API key');
    }
  }
}
```

## 개선 사항

### 반복문제 추적

```javascript
// 문제: "금리가 올라간다"는 표현 확인
const problematicTexts = new Set([
  '금리가 인상된다',
  '금리가 올라간다',
  // ...
]);

function validateResponse(text) {
  for (const problem of problematicTexts) {
    if (text.includes(problem)) {
      console.warn(`Potential issue: ${problem}`);
    }
  }
}
```

### A/B 테스트

다양한 프롬프트 버전으로 테스트 후 최적의 버전 선택:

1. `v1_simple` - 가장 간단한 설명
2. `v2_detailed` - 더 자세한 설명
3. `v3_examples` - 예시 중심
4. `v4_bullet` - 핵심 포인트 중심

## 모니터링

### 품질 메트릭

```typescript
interface QualityMetric {
  clarity: number;      // 0-1, 명확도
  accuracy: number;     // 0-1, 정확성
  usefulness: number;   // 0-1, 유용성
  length: number;       // 토큰 수
  cost: number;        // 달러
}
```

### 로깅

```typescript
logger.info('Analysis completed', {
  articleId: article.id,
  inputTokens: completion.usage.prompt_tokens,
  outputTokens: completion.usage.completion_tokens,
  cost: estimateApiCost(...),
  duration: Date.now() - startTime,
});
```

## 문의

프롬프트 관련 피드백은 GitHub Discussions에서 공유해주세요!
