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
  'article',
]

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

export async function fetchArticleBody(url: string | null | undefined): Promise<ArticleBody> {
  if (!url || !/^https?:\/\//.test(url)) return { ok: false, text: '', reason: '주소 없음' }
  try {
    const res = await fetch(url, {
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

    $('script, style, noscript, nav, header, footer, aside, iframe, figure figcaption, .ad, .advertisement, .related, .comment, .reporter_area, .byline').remove()

    let text = ''
    for (const sel of CONTENT_SELECTORS) {
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

    if (text.length >= MIN_BODY) return { ok: true, text: text.slice(0, MAX_CHARS) }
    // 본문을 못 찾았으면 리드 문단이라도 넘긴다(그래도 ok=false로 표시해 AI가 원인을 지어내지 않게)
    return { ok: false, text: lead.slice(0, 600), reason: lead ? '본문 못 찾음(리드만)' : '본문 못 찾음' }
  } catch (e) {
    return { ok: false, text: '', reason: `받기 실패: ${String((e as Error).message ?? e).slice(0, 80)}` }
  }
}

/** 여러 기사를 동시에 받는다. 결과는 id → 본문. */
export async function fetchArticleBodies(
  articles: { id: string; url: string | null | undefined }[]
): Promise<Map<string, ArticleBody>> {
  const results = await Promise.all(articles.map(async a => [a.id, await fetchArticleBody(a.url)] as const))
  return new Map(results)
}
