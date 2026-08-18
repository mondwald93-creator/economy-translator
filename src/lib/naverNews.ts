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

// DB에 이미 있는 URL을 안전하게 조회한다 (2026-08-17 신설, 중복 저장 사고의 수정).
// - 한 번에 묻는 개수를 제한해 요청 URL이 길어져 414가 나는 것을 막는다
// - 응답이 PostgREST 상한(1,000행)에 닿으면 잘렸을 수 있으니 반으로 나눠 다시 묻는다
//   (같은 URL이 여러 행 있는 옛 중복 때문에 100개만 물어도 1,000행을 넘을 수 있다)
// - 조회 자체가 실패하면 그 묶음을 errors에 남긴다. 예전처럼 조용히 "없음"으로 넘어가면 다시 전부 저장된다
const EXISTING_QUERY_CHUNK = 100
const POSTGREST_ROW_CAP = 1000
async function fetchExistingUrls(urls: string[], errors: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  const queue: string[][] = []
  for (let i = 0; i < urls.length; i += EXISTING_QUERY_CHUNK) queue.push(urls.slice(i, i + EXISTING_QUERY_CHUNK))

  while (queue.length) {
    const batch = queue.shift()!
    const { data, error } = await supabase
      .from('news_articles')
      .select('original_url')
      .in('original_url', batch)
      .limit(POSTGREST_ROW_CAP)
    if (error) {
      errors.push(`기존 URL 조회 실패(${batch.length}개 묶음): ${error.message}`)
      continue
    }
    const rows = data ?? []
    if (rows.length >= POSTGREST_ROW_CAP && batch.length > 1) {
      // 잘렸을 가능성 → 반으로 나눠 다시 묻는다 (1개까지 내려가면 그대로 받아들임)
      const mid = Math.ceil(batch.length / 2)
      queue.push(batch.slice(0, mid), batch.slice(mid))
      continue
    }
    for (const r of rows) found.add(r.original_url)
  }
  return found
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&apos;': "'", '&nbsp;': ' ', '&#39;': "'",
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    // 숫자 엔티티(&#39; &#x27; 등)를 먼저 글자로 되돌린다.
    // 2026-08-14 발견: 네이버 경제 섹션 제목에 16진수 표기 &#x27;가 쓰이는데
    // 아래 맵에 없어서 통째로 삭제되고 있었다("'긍정적'" → "긍정적").
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-z#0-9]+;/gi, m => HTML_ENTITIES[m] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toKSTDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// 시간대 표시가 없는 발행 시각은 한국 시각으로 읽는다 (2026-08-17 수정).
// 헤럴드경제 RSS가 `2026-08-17 22:01:14`처럼 시간대 없이 준다. 서버(Vercel)는 UTC라
// `new Date()`가 이걸 UTC로 읽어 **9시간 뒤**로 저장했다(밤 기사가 다음 날 date로 넘어감,
// 8/17 실측 16건 = 저장 시각보다 발행 시각이 뒤). 국내 언론 피드이므로 +09:00을 붙인다.
function normalizePubDate(pubDate: string): string {
  const s = pubDate.trim()
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s) ? s.replace(' ', 'T') + '+09:00' : s
}

function toDateString(pubDate: string): string {
  const d = new Date(normalizePubDate(pubDate))
  return isNaN(d.getTime()) ? toKSTDateString(new Date()) : toKSTDateString(d)
}

// 기사 실제 발행 시각. **모르면 오늘로 추측하지 않고 null을 돌려준다.**
// toDateString(=date 열)은 파싱 실패 시 오늘로 대체하는데, 그게 오래된 기사를
// '오늘 기사'로 둔갑시킨 원인이었다(2026-07-23 금리 기사 = 7/16 발행분).
// date 열의 기존 동작은 화면들이 의존하므로 건드리지 않고, 발행일만 따로 보관한다.
function toPublishedAt(pubDate: string): string | null {
  if (!pubDate) return null
  const d = new Date(normalizePubDate(pubDate))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ① 주요 언론사 RSS 피드 — 전부 "경제 섹션 전용" 피드다.
//
// 2026-08-14 전수 검증(실제 요청해서 확인). 전체기사 피드는 정치·연예가 섞여 들어오므로 쓰지 않는다.
// 뺀 것 2곳:
//   - 서울경제: 피드는 살아있으나(주소는 /rss/economy) RSS 안내에 "상업적 활용 및 AI학습 이용 금지"
//               명시. 이 서비스는 기사를 AI로 가공하므로 쓰지 않는다.
//   - 머니투데이: 경제 섹션 피드가 2025-09-22에 멈춰 있다(응답은 200에 기사 100건이라 겉으론 정상).
//                전체 피드는 비경제가 40%.
// ⚠️ 검증할 때 주의(이번에 실제로 걸린 것):
//   - HTTP 200 + item 다수여도 죽은 피드일 수 있다. pubDate 최댓값을 봐야 한다.
//   - UA를 붙이면 오히려 막히는 곳이 있다(mk.co.kr은 'Mozilla/5.0' 단독이면 403, UA 없으면 200).
//     아래 목록은 전부 UA 없이 동작하는 것만 남겼다.
const RSS_SOURCES: { name: string; url: string }[] = [
  { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/economy.xml' },
  { name: '한국경제', url: 'https://www.hankyung.com/feed/economy' },
  { name: '매일경제', url: 'https://www.mk.co.kr/rss/30100041/' },
  { name: '뉴시스', url: 'https://www.newsis.com/RSS/economy.xml' },
  { name: '헤럴드경제', url: 'https://biz.heraldcorp.com/rss/google/economy' },
  { name: '뉴스1', url: 'https://www.news1.kr/api/feeds/google?category_id=13' },
  // 이데일리(rss.edaily.co.kr)는 뺐다: curl로는 200인데 Node fetch로는
  // ERR_SSL_UNSUPPORTED_PROTOCOL로 실패한다(서버가 낡은 TLS를 쓴다). 2026-08-14 실측.
  { name: '아시아경제', url: 'https://view.asiae.co.kr/rss/economy.htm' },
  { name: '아시아경제증권', url: 'https://view.asiae.co.kr/rss/stock.htm' },
  { name: '조선비즈산업', url: 'https://biz.chosun.com/arc/outboundfeeds/rss/category/industry/?outputType=xml' },
  { name: 'SBS경제', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02' },
]

// "<![CDATA[ … ]]>" 껍데기를 벗기고 앞뒤 공백을 지운다. link(8/18 1차)·pubDate(8/18 2차)가 같이 쓴다.
function stripCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim()
}

function parseRSSItems(xml: string): NaverNewsItem[] {
  const items: NaverNewsItem[] = []
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  for (const block of blocks) {
    const c = block[1]
    const title = cleanHtml(
      c.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
      c.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
    )
    // ⚠️ 2026-08-18 수정: 매일경제·한국경제·SBS 피드는 <link>를 CDATA로 감싼다
    //    (<link><![CDATA[https://…]]></link>). 6/4 첫 수집부터 이 껍데기째 URL로 저장돼
    //    original_url이 "<![CDATA[https://…]]>"였다(고유 2,199건, 매경 2,047·한경 102·SBS 50).
    //    결과: 도메인 판별이 실패해 source가 전부 '뉴스'로 찍히고, 뉴스 상세의 원문 링크가 깨졌다.
    const link = stripCdata(
      c.match(/<link>([\s\S]*?)<\/link>/)?.[1] ||
      c.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] || ''
    )
    // ⚠️ 2026-08-18 수정(2차): 뉴스1 피드는 <pubDate>도 CDATA로 감싼다
    //    (<pubDate><![CDATA[Tue, 18 Aug 2026 12:00:00 +0900]]></pubDate>, 60건 중 60건).
    //    껍데기째 읽으면 new Date()가 실패해 published_at이 전부 null·date는 오늘로 대체됐다.
    //    뉴스1은 서울 리전 이동(8/17) 뒤 처음 들어와서 이제 드러남. 10곳 피드 중 뉴스1뿐(8/18 실측).
    const pubDate = stripCdata(c.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '')
    if (title && link) {
      items.push({ title, originallink: link, link, description: '', pubDate })
    }
  }
  return items
}

// 소스별로 몇 건 들어왔는지 함께 돌려준다.
// 이유: 2026-08-14까지 서울경제 피드가 0건을 반환하는데 아무도 몰랐다.
// 실패해도 나머지가 살아서(allSettled) 전체는 "성공"으로 보이기 때문이다.
// reasons = 0건인 소스가 "왜" 0건인지 (2026-08-17 추가).
// 예전엔 실패를 전부 0으로만 적어서, 서버(미국→서울로 옮겨도)에서 한국경제·뉴스1이 0건인 이유를
// 알 수 없었다(403인지, 연결이 안 되는지, 200인데 item이 없는지). 이제 "0건" 옆에 그 이유를 같이 남긴다.
async function fetchRSSFeeds(): Promise<{ items: NaverNewsItem[]; counts: Record<string, number>; reasons: Record<string, string> }> {
  const counts: Record<string, number> = {}
  const reasons: Record<string, string> = {}
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async ({ name, url }) => {
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) {
        counts[name] = 0
        reasons[name] = `HTTP ${res.status}` + (res.headers.get('server') ? ` (server: ${res.headers.get('server')})` : '')
        return []
      }
      const body = await res.text()
      const items = parseRSSItems(body)
      counts[name] = items.length
      if (items.length === 0) reasons[name] = `HTTP 200이지만 item 0건 (본문 ${body.length}자, 앞부분: ${body.slice(0, 80).replace(/\s+/g, ' ')})`
      return items
    })
  )
  for (let i = 0; i < RSS_SOURCES.length; i++) {
    const r = results[i]
    if (r.status === 'rejected') {
      counts[RSS_SOURCES[i].name] = 0
      const cause = (r.reason as { cause?: { code?: string; message?: string }; message?: string })
      reasons[RSS_SOURCES[i].name] = `요청 실패: ${cause?.cause?.code ?? ''} ${cause?.cause?.message ?? cause?.message ?? String(r.reason)}`.trim()
    }
  }
  return { items: results.flatMap(r => r.status === 'fulfilled' ? r.value : []), counts, reasons }
}

// "12분전"·"3시간전"·"1일전" → ISO 시각. 못 읽으면 빈 문자열(=모름)을 돌려준다.
// 오늘로 추측하지 않는 원칙은 published_at 신설 때와 같다(2026-07-23 사고).
function relativeToISO(text: string, now: number): string {
  const m = text.match(/(\d+)\s*(분|시간|일)/)
  if (!m) return ''
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n)) return ''
  const ms = m[2] === '분' ? 60_000 : m[2] === '시간' ? 3_600_000 : 86_400_000
  return new Date(now - n * ms).toISOString()
}

// ② 네이버 뉴스 "경제 섹션" 기사 (헤드라인 + 추천)
//
// 2026-08-14 교체. 그전엔 popularDay.naver(많이 본 기사)를 긁고 있었는데, 그 페이지는
// 언론사 83곳의 인기 기사를 모은 것이라 섹션 구분이 아예 없다. sid1=101(경제)을 붙여도
// 무시된다(경제·정치·파라미터없음 세 요청의 결과가 글자 하나까지 동일함을 실측).
// 그래서 「별자리 운세」·「프로야구 별세」 같은 기사가 하루 800건씩 후보 풀에 들어왔다.
// 첫 수집일(2026-06-04)부터 계속이었고, 요청이 200 OK로 성공하니 아무도 몰랐다.
async function fetchNaverEconomySection(): Promise<NaverNewsItem[]> {
  try {
    const res = await fetch('https://news.naver.com/section/101', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const html = await res.text()
    const now = Date.now()

    // 기사 하나가 <div class="sa_text"> 블록 하나다. 제목·시각이 같은 블록에 있어야 짝이 맞는다.
    const blocks = html.split('<div class="sa_text">').slice(1)
    const items: NaverNewsItem[] = []
    const seen = new Set<string>()

    for (const b of blocks) {
      try {
        const link = b.match(/<a href="(https:\/\/n\.news\.naver\.com\/mnews\/article\/\d+\/\d+)"[^>]*class="sa_text_title/)
        if (!link) continue
        const url = link[1]
        if (seen.has(url)) continue
        const rawTitle = b.match(/class="sa_text_title[^"]*"[^>]*>([\s\S]*?)<\/a>/)
        const title = rawTitle ? cleanHtml(rawTitle[1]) : ''
        if (!title) continue
        // 헤드라인 10건에는 시각이 없고, 추천 기사에만 "N분전"이 붙는다.
        const dt = b.match(/sa_text_datetime[^>]*>\s*<b>([^<]+)<\/b>/)
        seen.add(url)
        items.push({
          title, originallink: url, link: url, description: '',
          pubDate: dt ? relativeToISO(dt[1], now) : '',
        })
      } catch {
        continue   // 블록 하나가 이상해도 나머지는 계속 읽는다
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

export async function collectAndSaveNews(): Promise<{ saved: number; skippedExisting: number; errors: string[] }> {
  const today = toKSTDateString(new Date())
  const errors: string[] = []
  let saved = 0

  // 세 가지 소스 병렬 수집
  const [rss, sectionItems, keywordItems] = await Promise.all([
    fetchRSSFeeds(),
    fetchNaverEconomySection(),
    fetchNaverKeywordNews(20),
  ])
  const rssItems = rss.items
  const rankingItems = sectionItems

  // 소스별 수집량을 남긴다. 0건인 소스는 경고로 올린다.
  // 없으면 소스 하나가 조용히 죽어도 아무도 모른다(서울경제 0건이 그렇게 방치됐다).
  const counts: Record<string, number> = {
    ...rss.counts,
    '네이버경제섹션': sectionItems.length,
    '네이버검색': keywordItems.length,
  }
  const dead = Object.entries(counts).filter(([, n]) => n === 0).map(([k]) => k)
  console.log('[collectNews] 소스별 수집: ' +
    Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · '))
  if (dead.length) {
    // 이유가 있으면 같이 적는다: "한국경제(HTTP 403), 뉴스1(요청 실패: ...)"
    const msg = `수집 0건인 소스: ${dead.map(k => rss.reasons[k] ? `${k}(${rss.reasons[k]})` : k).join(', ')}`
    console.warn(`[collectNews] ⚠️ ${msg}`)
    errors.push(msg)
  }

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
  // 기사 하나가 이상해도 그 기사만 버리고 나머지는 계속 간다.
  // 예전엔 이 변환 줄에 안전망이 없어서, 예상 못 한 값 하나가 그 회차 수집 전체를 죽일 수 있었다.
  const newItems = allItems
    .map(item => {
      try {
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
      } catch {
        return null
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // DB에 이미 있는 URL 조회해서 중복 제거
  // ⚠️ 2026-08-17 수정. 예전엔 회차 URL 전부(800~900개)를 `.in()` 한 번에 물었다. 두 가지로 깨졌다:
  //   ① 요청 URL이 60KB를 넘어 414(URI Too Long) → 에러를 무시하고 "있는 URL 없음"으로 진행 → 전부 다시 저장
  //   ② 300개쯤이면 200 OK인데 응답이 1,000행에서 잘림(PostgREST 기본 상한) → 잘린 만큼 다시 저장
  //   그 결과 6월 첫 수집부터 같은 기사가 회차마다 다시 들어갔다(중복률 41~75%, 한 URL이 평균 8행).
  // → 100개씩 나눠 묻고, 묶음 응답이 상한에 닿으면 더 잘게 나눠 다시 묻는다. 조회 에러는 삼키지 않고 errors에 남긴다.
  const allUrls = Array.from(new Set(newItems.map(i => i.original_url)))
  const existingUrls = await fetchExistingUrls(allUrls, errors)
  const skippedAsExisting = newItems.length - newItems.filter(item => !existingUrls.has(item.original_url)).length
  const toInsert = newItems.filter(item => !existingUrls.has(item.original_url))
  console.log(`[collectNews] 저장 후보 ${newItems.length}건 중 이미 있는 URL ${skippedAsExisting}건 제외 → ${toInsert.length}건 저장 시도`)

  // 50개씩 묶어 넣되, 묶음이 실패하면 그 묶음만 한 건씩 다시 넣는다.
  // 예전엔 묶음 하나가 실패하면 50건이 통째로 사라졌다(평소엔 빠르게, 사고 난 날만 느리게).
  const CHUNK = 50
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error, data } = await supabase
      .from('news_articles')
      .insert(chunk)
      .select('id')
    if (!error) { saved += data?.length ?? 0; continue }

    let recovered = 0
    for (const one of chunk) {
      const r = await supabase.from('news_articles').insert(one).select('id')
      if (!r.error) recovered++
    }
    saved += recovered
    errors.push(`저장 실패(묶음 ${chunk.length}건): ${error.message} → 개별 재시도로 ${recovered}건 복구, ${chunk.length - recovered}건 유실`)
  }

  return { saved, skippedExisting: skippedAsExisting, errors }
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
