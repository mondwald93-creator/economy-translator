import { supabaseAdmin as supabase } from './supabaseAdmin'
import { titleTokenSet, isNearDuplicate } from './titleSimilarity'

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
  'sbs.co.kr': 'SBS',
  'jtbc.co.kr': 'JTBC',
  'tvchosun.com': 'TV조선',
  'mbn.co.kr': 'MBN',
  'ytn.co.kr': 'YTN',
  'yonhapnewstv.co.kr': '연합뉴스TV',
  'n.news.naver.com': '네이버뉴스',
  'news.naver.com': '네이버뉴스',
  'finance.naver.com': '네이버금융',
  'mt.co.kr': '머니투데이',
  'fnnews.com': '파이낸셜뉴스',
  'inews24.com': '아이뉴스24',
  'etnews.com': '전자신문',
  'newsis.com': '뉴시스',
  'news1.kr': '뉴스1',
  'etoday.co.kr': '이투데이',
  'gukjenews.com': '국제뉴스',
  'cjb.co.kr': 'CJB',
  'kyeongin.com': '경인일보',
  'kyeonggi.com': '경기일보',
  'smartbizn.com': '스마트비즈니스',
  'businesspost.co.kr': '비즈니스포스트',
  'thebell.co.kr': '더벨',
  'ddaily.co.kr': '디지털데일리',
  'zdnet.co.kr': 'ZDNet코리아',
  'bloter.net': '블로터',
  'heraldcorp.com': '헤럴드경제',
  'koreaherald.com': '코리아헤럴드',
  'khan.co.kr': '경향신문',
  'pressian.com': '프레시안',
  'ohmynews.com': '오마이뉴스',
  'mediatoday.co.kr': '미디어오늘',
  'nocutnews.co.kr': '노컷뉴스',
  'seoul.co.kr': '서울신문',
  'munhwa.com': '문화일보',
  'kmib.co.kr': '국민일보',
  'kookje.co.kr': '국제신문',
  'busan.com': '부산일보',
  'daejeonilbo.com': '대전일보',
  'joongdo.co.kr': '중도일보',
  'cnbnews.com': 'CNB뉴스',
  'newdaily.co.kr': '뉴데일리',
  'pennmike.com': '펜앤드마이크',
  'wikitree.co.kr': '위키트리',
  'sisain.co.kr': '시사인',
  'hankookilbo.com': '한국일보',
}

function extractSource(url: string): string {
  try {
    const { hostname } = new URL(url)
    for (const [domain, source] of Object.entries(DOMAIN_SOURCE_MAP)) {
      if (hostname.includes(domain)) return source
    }
    return '뉴스'
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

// 기사 실제 발행 시각. **모르면 오늘로 추측하지 않고 null을 돌려준다.**
// toDateString(=date 열)은 파싱 실패 시 오늘로 대체하는데, 그게 오래된 기사를
// '오늘 기사'로 둔갑시킨 원인이었다(2026-07-23 금리 기사 = 7/16 발행분).
// date 열의 기존 동작은 화면들이 의존하므로 건드리지 않고, 발행일만 따로 보관한다.
function toPublishedAt(pubDate: string): string | null {
  if (!pubDate) return null
  const d = new Date(pubDate)
  return isNaN(d.getTime()) ? null : d.toISOString()
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
        // 랭킹 페이지는 발행 시각을 주지 않는다. 예전엔 여기에 '지금'을 박아 넣었는데,
        // 그러면 며칠 전 기사가 랭킹에 다시 뜰 때 오늘 발행된 것처럼 보인다.
        // → 빈 값으로 두어 published_at이 null(=모름)이 되게 한다.
        // (date 열은 toDateString이 파싱 실패 시 오늘로 대체하므로 기존과 동일하게 동작)
        items.push({ title, originallink: url, link: url, description: '', pubDate: '' })
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

  // 전체 합치고 중복 제거: URL + 제목 앞 20자(완전 일치) + 핵심 단어 겹침(거의 같은 중복)
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()
  const acceptedTokenSets: Set<string>[] = []
  const allItems = [...rssItems, ...rankingItems, ...keywordItems].filter(item => {
    const url = item.originallink || item.link
    const cleanTitle = cleanHtml(item.title)
    const titleKey = cleanTitle.slice(0, 20)
    if (!url || !titleKey) return false
    if (seenUrls.has(url) || seenTitles.has(titleKey)) return false
    // 같은 사건을 제목만 바꿔 쓴 기사(다른 언론사) 걸러내기
    const tokens = titleTokenSet(cleanTitle)
    if (isNearDuplicate(tokens, acceptedTokenSets)) return false
    seenUrls.add(url)
    seenTitles.add(titleKey)
    acceptedTokenSets.push(tokens)
    return true
  })

  // 50개씩 나눠서 upsert (original_url 충돌 시 무시)
  const newItems = allItems
    .map(item => {
      const title = cleanHtml(item.title)
      const original_url = item.originallink || item.link
      if (!title || !original_url) return null
      return {
        date: toDateString(item.pubDate),
        published_at: toPublishedAt(item.pubDate),
        title,
        summary: '',
        original_url,
        source: extractSource(original_url),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // DB에 이미 있는 URL 조회해서 중복 제거
  const allUrls = newItems.map(i => i.original_url)
  const { data: existing } = await supabase
    .from('news_articles')
    .select('original_url')
    .in('original_url', allUrls)
  const existingUrls = new Set((existing ?? []).map(r => r.original_url))
  const toInsert = newItems.filter(item => !existingUrls.has(item.original_url))

  const CHUNK = 50
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error, data } = await supabase
      .from('news_articles')
      .insert(chunk)
      .select('id')
    if (error) errors.push(`저장 실패: ${error.message}`)
    else saved += data?.length ?? 0
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
