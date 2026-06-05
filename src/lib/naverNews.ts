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

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function toDateString(pubDate: string): string {
  const d = new Date(pubDate)
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
}

async function fetchNaverEconomyNews(display = 20): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 없음')

  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent('한국 경제')}&display=${display}&sort=date`
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`네이버 API 호출 실패: ${res.status}`)
  const data = await res.json()
  return data.items ?? []
}

export async function collectAndSaveNews(): Promise<{ saved: number; errors: string[] }> {
  const today = new Date().toISOString().split('T')[0]
  const errors: string[] = []
  let saved = 0

  let items: NaverNewsItem[] = []
  try {
    items = await fetchNaverEconomyNews(20)
  } catch (e) {
    errors.push((e as Error).message)
    return { saved, errors }
  }

  // 오늘 날짜 기사만, 오늘 기사 없으면 전체 사용
  const todayItems = items.filter(item => toDateString(item.pubDate) === today)
  const targets = todayItems.length > 0 ? todayItems : items

  for (const item of targets) {
    const title = cleanHtml(item.title)
    const original_url = item.originallink || item.link

    if (!title || !original_url) continue

    const { data: existing } = await supabase
      .from('news_articles')
      .select('id')
      .eq('original_url', original_url)
      .single()

    if (existing) continue

    const { error } = await supabase.from('news_articles').insert({
      date: toDateString(item.pubDate),
      title,
      summary: '',
      original_url,
      source: extractSource(item.originallink || item.link),
    })

    if (error) {
      errors.push(`저장 실패: ${error.message}`)
    } else {
      saved++
    }
  }

  return { saved, errors }
}

export async function getTodayArticles() {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('news_articles')
    .select('*')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
