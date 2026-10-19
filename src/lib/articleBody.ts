/**
 * 기사 원문 본문 받기 — 2026-10-06 신설
 *
 * 왜: 해설(whyHappened·myImpact·outlook)과 브리핑 요약을 AI가 **기사 제목만 보고** 쓰고 있었다.
 *     수집 단계(naverNews.ts)가 6/6부터 summary를 항상 ''로 저장해서 DB에 본문이 없다.
 *     그래서 AI가 제목에 없는 원인·주체·숫자를 지어냈다(9/25~10/6 해설 85건 중 32건 사실 오류,
 *     예: 샤인머스캣 기사 → 「귀족새우」, 1~9월 누적 수출 → 「연간 1조 달러 돌파」).
 *     기록 = 전직로드맵/_작업기록/자리비움점검_2026-10-06.md 5-2절
 *
 * 하는 일: 해설을 쓸 기사 몇 건(하루 약 9건)만 원문을 받아 본문 글자를 뽑는다.
 *     실패해도 예외를 던지지 않는다 — 발행을 막지 않고, 호출하는 쪽이 「본문 없음」으로 다룬다.
 * 링크분석기(api/analyze-link)의 추출 방식을 바탕으로 두 가지를 보강했다:
 *   ① 네이버 뉴스 현재 본문 위치 #dic_area / #newsct_article
 *   ② EUC-KR 언론사 대응(바이트로 받아 charset을 보고 해독)
 */
import * as cheerio from 'cheerio'

const CONTENT_SELECTORS = [
  '#dic_area',                    // 네이버 뉴스(현재)
  '#newsct_article',              // 네이버 뉴스(감싸는 칸)
  '#articleBodyContents',         // 네이버 뉴스(옛)
  '[itemprop="articleBody"]',
  '#article-view-content-div',    // 언론사 공용 CMS(ndsoft 계열)
  '#articleBody',
  '#article_body',
  '.article_body',
  '.article-body',
  '.article_txt',
  '.news_body',
  '.news_cnt_detail_wrap',
  '.story-body',
  '[data-article-body]',
  '.content-article',
  '.paragraph',                   // YTN (첫 article 태그가 관련기사 칸이라 그보다 먼저)
  '#viewPrint',                   // 일부 지역·전문지 CMS
  // 아래 둘은 2026-10-19 추가. full_analysis.body 기록(10/16 신설)이 처음 잡아낸 추출기 구멍 2건.
  '.news_view',                   // 동아일보: 'article'이 관련기사 카드(40자)를 먼저 잡아 본문(section.news_view 2,535자)을 놓쳤다(10/17 수출)
  '#article-body-content',        // 비즈니스포스트: 본문 칸이 목록에 없어 리드 39자만 넘어갔다(10/17 TOP3 1번)
  // 아래 셋은 2026-10-19 뉴스 해설 재감사(162건)에서 찾은 구멍. 기록 = 전직로드맵/_작업기록/경번_뉴스재감사_2026-10-19/
  // (MBN은 동영상 안내문 894자를 본문으로 잡는데, 페이지 구조가 깨져 #newsViewArea가 안 잡힌다. 본문-제목 일치 검사가 실패로 돌린다)
  '.news_article',                // 국제신문: 본문 칸이 없어 p 태그 모으기가 옆 칸 병원 칼럼을 본문으로 잡았다(10/19 취업준비 58만원 → 해설이 「본문에 병원 글만 있다」)
  '#newsView',                    // 서울경제TV: 리드 78자만 넘어갔다(9/23 소비심리)
  '.acem_text',                   // SBS Biz amp 쪽 본문 칸(주소는 toFetchUrl이 amp로 바꾼다)
  'article',
]

// 본문을 화면에서 스크립트로 그리는 곳은 서버가 본문을 그려 주는 주소로 바꿔 받는다.
// SBS Biz: biz.sbs.co.kr/article_hub/<번호>·/article/<번호>는 리드만 있다 → /amp/article/<번호>에 본문이 있다(10/7 HLB 「실사 결과는 본문에 안 나온다」 → 실제로는 「자발적 시정조치 권고」로 나옴)
function toFetchUrl(url: string): string {
  const sbs = url.match(/^https?:\/\/biz\.sbs\.co\.kr\/(?:article_hub|article)\/(\d+)/)
  if (sbs) return `https://biz.sbs.co.kr/amp/article/${sbs[1]}`
  return url
}

const MAX_CHARS = 2500   // 프롬프트에 넣을 길이. 9건 × 2,500자 ≈ 한 번 호출에 충분히 들어간다
const MIN_BODY = 200     // 이보다 짧으면 본문을 못 찾은 것으로 본다

export interface ArticleBody {
  ok: boolean            // 본문을 충분히 얻었나
  text: string           // 본문(없으면 리드 문단이라도, 그것도 없으면 '')
  reason?: string        // 실패 이유(관측용)
}

function decode(buf: ArrayBuffer, contentType: string | null): string {
  const head = new TextDecoder('utf-8').decode(buf.slice(0, 4000))
  const fromHeader = contentType?.match(/charset=([\w-]+)/i)?.[1]
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
  const cs = (fromHeader || fromMeta || 'utf-8').toLowerCase()
  const label = /euc-?kr|ks_c_5601|cp949/.test(cs) ? 'euc-kr' : 'utf-8'
  try {
    return new TextDecoder(label).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

// 뉴스1은 본문을 화면 칸에 두지 않고 __NEXT_DATA__(Next.js가 화면 재료를 담아 두는 script 칸)에만 넣는다.
// 이걸 안 보면 'article' 칸의 부제목·키워드·관련 기사 제목(300자대)을 본문으로 잘못 받는다.
// 10/7~10/15 뉴스1 해설 4건이 전부 그랬고, 해설에 「기사에서 따로 밝히지 않았어요」 빈칸이 생겼다(2026-10-15).
function textFromNextData($: cheerio.CheerioAPI): string {
  const raw = $('script#__NEXT_DATA__').html()
  if (!raw) return ''
  try {
    const parts = JSON.parse(raw)?.props?.pageProps?.articleView?.contentArrange
    if (!Array.isArray(parts)) return ''
    return parts
      .filter((p: { type?: string; content?: unknown }) => p?.type === 'text' && typeof p.content === 'string')
      .map((p: { content: string }) => cheerio.load(p.content).text())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

// 본문-제목 일치 검사(2026-10-19). 받은 글에 제목의 단어가 하나도 없으면 엉뚱한 칸을 본문으로 잡은 것이다.
// 국제신문(옆 칸 병원 칼럼 558자)이 글자 수만 넘겨 ok로 기록됐고, 해설이 「기사 본문에 병원 글만 있다」고 독자에게 썼다(10/19 재감사 🔴).
// 기준은 「0개」만: 다른 경제 기사끼리는 삼성전자·코스피 같은 단어가 겹쳐 비율로는 못 가른다(재감사 162건 실측 =
// 맞는 짝 중앙 0.75 · 엇갈린 짝도 상위 10%는 0.29 이상). 기사가 아닌 글(칼럼 목록·안내문)만 잡는 용도다.
const TITLE_LABEL = /\[[^\]]*\]|【[^】]*】|〈[^〉]*〉|<[^>]*>|\([^)]*\)/g   // [마켓 HOT 뉴스]·(종합) 같은 머리말
const PARTICLE = /(으로|에서|에게|까지|부터|처럼|보다|이라|이다|은|는|이|가|을|를|에|의|와|과|도|로|만)$/
const STOPWORDS = new Set(['종합', '속보', '단독', '오늘', '뉴스', '기자', '영상', '이슈', '포토', '사진'])

export function titleKeywords(title: string): string[] {
  const words = title.replace(TITLE_LABEL, ' ').split(/[^0-9A-Za-z가-힣]+/)
  const out = new Set<string>()
  for (const w of words) {
    const k = w.replace(PARTICLE, '').replace(PARTICLE, '')   // 「화요일에도」처럼 조사가 둘 붙은 것까지
    if (k.length >= 2 && !STOPWORDS.has(k)) out.add(k)
  }
  return [...out]
}

/** 제목 단어 중 본문에 나오는 비율(띄어쓰기는 무시). 단어가 없으면 null */
export function titleOverlap(title: string, text: string): { found: number; total: number } | null {
  const keys = titleKeywords(title)
  if (keys.length === 0) return null
  const body = text.replace(/\s+/g, '')
  return { found: keys.filter(k => body.includes(k)).length, total: keys.length }
}

// 조선일보는 본문을 화면 칸에 두지 않고 Fusion.globalContent(화면 재료를 담은 script)에만 넣는다.
// 이걸 안 보면 리드 124~136자만 넘어간다(10/9 금융지주 · 10/16 청년 고용).
function textFromFusion($: cheerio.CheerioAPI): string {
  let raw = ''
  $('script').each((_, el) => {
    const s = $(el).html() ?? ''
    if (!raw && s.includes('Fusion.globalContent')) raw = s
  })
  const m = raw.match(/Fusion\.globalContent\s*=\s*(\{[\s\S]*?\});\s*Fusion\./)
  if (!m) return ''
  try {
    const parts = JSON.parse(m[1])?.content_elements
    if (!Array.isArray(parts)) return ''
    return parts
      .filter((p: { type?: string; content?: unknown }) => p?.type === 'text' && typeof p.content === 'string')
      .map((p: { content: string }) => cheerio.load(p.content).text())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

/** title을 주면 본문-제목 일치 검사까지 한다(제목 단어가 본문에 하나도 없으면 ok=false) */
export async function fetchArticleBody(url: string | null | undefined, title?: string): Promise<ArticleBody> {
  if (!url || !/^https?:\/\//.test(url)) return { ok: false, text: '', reason: '주소 없음' }
  try {
    const res = await fetch(toFetchUrl(url), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, text: '', reason: `HTTP ${res.status}` }
    const html = decode(await res.arrayBuffer(), res.headers.get('content-type'))
    const $ = cheerio.load(html)
    const lead = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim()
    // script 태그를 지우기 전에 읽어야 한다
    const nextDataText = textFromNextData($)
    const fusionText = nextDataText.length >= MIN_BODY ? '' : textFromFusion($)

    $('script, style, noscript, nav, header, footer, aside, iframe, figure figcaption, .ad, .advertisement, .related, .comment, .reporter_area, .byline').remove()

    let text = nextDataText.length >= MIN_BODY ? nextDataText : fusionText.length >= MIN_BODY ? fusionText : ''
    for (const sel of text ? [] : CONTENT_SELECTORS) {
      const el = $(sel).first()
      if (el.length === 0) continue
      const t = el.text().replace(/\s+/g, ' ').trim()
      if (t.length >= MIN_BODY) { text = t; break }
    }
    if (!text) {
      const paragraphs: string[] = []
      $('p').each((_, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim()
        if (t.length > 40) paragraphs.push(t)
      })
      text = paragraphs.join(' ')
    }

    if (text.length >= MIN_BODY) {
      const overlap = title ? titleOverlap(title, text) : null
      if (overlap && overlap.found === 0) {
        return { ok: false, text: lead.slice(0, 600), reason: `본문-제목 불일치(제목 단어 0/${overlap.total})` }
      }
      return { ok: true, text: text.slice(0, MAX_CHARS) }
    }
    // 본문을 못 찾았으면 리드 문단이라도 넘긴다(그래도 ok=false로 표시해 AI가 원인을 지어내지 않게)
    return { ok: false, text: lead.slice(0, 600), reason: lead ? '본문 못 찾음(리드만)' : '본문 못 찾음' }
  } catch (e) {
    return { ok: false, text: '', reason: `받기 실패: ${String((e as Error).message ?? e).slice(0, 80)}` }
  }
}

/** 여러 기사를 동시에 받는다. 결과는 id → 본문. */
export async function fetchArticleBodies(
  articles: { id: string; url: string | null | undefined; title?: string }[]
): Promise<Map<string, ArticleBody>> {
  const results = await Promise.all(articles.map(async a => [a.id, await fetchArticleBody(a.url, a.title)] as const))
  return new Map(results)
}
