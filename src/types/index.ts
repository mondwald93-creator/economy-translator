export interface NewsArticle {
  id: string
  title: string
  summary: string        // AI가 생성한 쉬운 설명
  originalUrl: string
  source: string         // 출처 (네이버, 한겨레 등)
  publishedAt: string
  category?: string
}

export interface KeyIndicator {
  name: string           // 코스피, 환율(원/달러) 등
  value: string          // 현재 값
  change: string         // 변화량 (+/-...)
  direction: 'up' | 'down' | 'flat'
  easyExplanation: string  // 초보자용 설명
}

export interface DailyBriefing {
  id: string
  date: string           // YYYY-MM-DD
  summary: string        // 오늘의 전체 경제 요약 글
  indicators: KeyIndicator[]
  articles: NewsArticle[]
  dailyTerm: {
    term: string
    explanation: string
  }
  createdAt: string
}
