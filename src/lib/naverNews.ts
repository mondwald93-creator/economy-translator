import { supabase } from './supabase'

interface NaverNewsItem {
  title: string
  originallink: string
  link: string
  description: string
  pubDate: string
}

const DOMAIN_SOURCE_MAP: Record<string, string> = {
  'hankyung.com': '한국경제',
  'mk.co.kr': '매일경제',
  'yna.co.kr': '연합뉴스',
  'donga.com': '동아일보',
  'asiae.co.kr': '아시아경제',
  'chosun.com': '조선일보',
  'joongang.co.kr': '중앙일보',
  'hani.co.kr': '한겨레',
  'sedaily.com': '서울경제',
  'edaily.co.kr': '이데일리',
  'kbs.co.kr': 'KBS',
  'mbc.co.kr': 'MBC',
  'yonhapnewstv.co.kr': '연합뉴스TV',
  'n.news.naver.com': '네이버뉴스',
}

function extractSource(url: string): string {
  try {
    const { hostname } = new URL(url)
    for (const [domain, source] of Object.entries(DOMAIN_SOURCE_MAP)) {
      if (hostname.includes(domain)) return source
    }
    return hostname.replace('www.', '').split('.')[0]
  } catch {
    return '뉴스'
  }
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&apos;': "'", '&nbsp;': ' ', '&#39;': "'",
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, m => HTML_ENTITIES[m] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toKSTDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function toDateString(pubDate: string): string {
  const d = new Date(pubDate)
  return isNaN(d.getTime()) ? toKSTDateString(new Date()) : toKSTDateString(d)
}

// ① 주요 언론사 RSS 피드
const RSS_SOURCES = [
  'https://www.yna.co.kr/rss/economy.xml',
  'https://www.hankyung.com/feed/economy',
  'https://www.mk.co.kr/rss/30100041/',
  'https://www.sedaily.com/RSS',
]

function parseRSSItems(xml: string): NaverNewsItem[] {
  const items: NaverNewsItem[] = []
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  for (const block of blocks) {
    const c = block[1]
    const title = cleanHtml(
      c.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
      c.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
    )
    const link = (
      c.match(/<link>([\s\S]*?)<\/link>/)?.[1] ||
      c.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] || ''
    ).trim()
    const pubDate = c.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ''
    if (title && link) {
      items.push({ title, originallink: link, link, description: '', pubDate })
    }
  }
  return items
}

async function fetchRSSFeeds(): Promise<NaverNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (url) => {
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) return []
      return parseRSSItems(await res.text())
    })
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

// ② 네이버 뉴스 경제 많이본 기사
async function fetchNaverRankingNews(): Promise<NaverNewsItem[]> {
  try {
    const res = await fetch(
      'https://news.naver.com/main/ranking/popularDay.naver?mid=etc&sid1=101',
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        next: { revalidate: 0 },
      }
    )
    if (!res.ok) return []

    const buffer = await res.arrayBuffer()
    const html = new TextDecoder('euc-kr').decode(buffer)

    const pattern = /href="(https:\/\/n\.news\.naver\.com\/article\/[^"]+ntype=RANKING)"[^>]*>([^<]+)</g
    const items: NaverNewsItem[] = []
    const seen = new Set<string>()
    let match

    while ((match = pattern.exec(html)) !== null) {
      const url = match[1]
      const title = match[2].trim()
      if (title && !seen.has(url)) {
        seen.add(url)
        items.push({ title, originallink: url, link: url, description: '', pubDate: new Date().toUTCString() })
      }
    }
    return items
  } catch {
    return []
  }
}

// ③ 네이버 키워드 검색 (경제 핵심 지표 관련)
const SEARCH_KEYWORDS = ['한국 경제', '코스피 코스닥', '환율 금리']

async function fetchNaverKeywordNews(display = 20): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return []

  const results = await Promise.allSettled(
    SEARCH_KEYWORDS.map(async (keyword) => {
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=${display}&sort=date`
      const res = await fetch(url, {
        headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
        next: { revalidate: 0 },
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.items ?? []) as NaverNewsItem[]
    })
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

export async function collectAndSaveNews(): Promise<{ saved: number; errors: string[] }> {
  const today = toKSTDateString(new Date())
  const errors: string[] = []
  let saved = 0

  // 세 가지 소스 병렬 수집
  const [rssItems, rankingItems, keywordItems] = await Promise.all([
    fetchRSSFeeds(),
    fetchNaverRankingNews(),
    fetchNaverKeywordNews(20),
  ])

  // 전체 합치고 URL + 제목 앞 20자 기준 중복 제거
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()
  const allItems = [...rssItems, ...rankingItems, ...keywordItems].filter(item => {
    const url = item.originallink || item.link
    const titleKey = cleanHtml(item.title).slice(0, 20)
    if (!url || !titleKey) return false
    if (seenUrls.has(url) || seenTitles.has(titleKey)) return false
    seenUrls.add(url)
    seenTitles.add(titleKey)
    return true
  })

  // DB에 이미 있는 URL 한 번에 조회
  const allUrls = allItems.map(item => item.originallink || item.link).filter(Boolean)
  const { data: existingRows } = await supabase
    .from('news_articles')
    .select('original_url')
    .in('original_url', allUrls)

  const existingUrls = new Set((existingRows ?? []).map(r => r.original_url))

  // 신규 기사만 필터링
  const newItems = allItems
    .map(item => {
      const title = cleanHtml(item.title)
      const original_url = item.originallink || item.link
      if (!title || !original_url || existingUrls.has(original_url)) return null
      return {
        date: toDateString(item.pubDate),
        title,
        summary: '',
        original_url,
        source: extractSource(original_url),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // 50개씩 나눠서 일괄 삽입
  const CHUNK = 50
  for (let i = 0; i < newItems.length; i += CHUNK) {
    const chunk = newItems.slice(i, i + CHUNK)
    const { error } = await supabase.from('news_articles').insert(chunk)
    if (error) errors.push(`저장 실패: ${error.message}`)
    else saved += chunk.length
  }

  return { saved, errors }
}

export async function getTodayArticles() {
  const today = toKSTDateString(new Date())
  const { data, error } = await supabase
    .from('news_articles')
    .select('*')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
