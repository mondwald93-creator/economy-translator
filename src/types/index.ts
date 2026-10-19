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
  basis?: string           // 등락률 기준값(2026-10-19). 예: '10/16 종가 794.78' · '24시간 전 10/18 06:00 1334.2'. 화면엔 안 씀, 검산용
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
  evidence?: string[]  // 그날 진단의 근거 기사 제목(최대 3, 2026-10-19). 화면엔 안 씀, 검산용
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
