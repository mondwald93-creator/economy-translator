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
  date: string
  summary: string
  headline: string | null
  indicators: KeyIndicator[]
  articles: NewsArticle[]
  dailyTerm: { term: string; explanation: string }
  top3Analysis: Top3AnalysisItem[] | null
  healthCheck: HealthCheckItem[] | null
  connections: ConnectionItem[] | null
  createdAt: string
}

export interface Top3AnalysisItem {
  articleId: string
  title: string
  steps: {
    oneline: string
    whatHappened: string
    whyHappened: string
    myImpact: string
    outlook: string
    conclusion: string
  }
}

export interface HealthCheckItem {
  category: '물가' | '소비' | '수출' | '고용' | '부동산' | '금융'
  status: 'good' | 'normal' | 'warning'
  summary: string
}

export interface ConnectionItem {
  from: string
  to: string
}

export interface ArticleFullAnalysis {
  oneline: string
  whatHappened: string
  whyHappened: string
  myImpact: string
  outlook: string
  conclusion: string
}
