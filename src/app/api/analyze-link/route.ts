import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { openai, SYSTEM_PROMPT } from '@/lib/openai'

const CONTENT_SELECTORS = [
  '#articleBodyContents',   // 네이버 뉴스
  '#articeBody',            // 네이버 모바일
  '.article-body',
  '.article_body',
  '.article_txt',
  '.news_body',
  '.story-body',
  'article',
  '[data-article-body]',
  '.content-article',
  'main',
]

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || !url.startsWith('http')) {
    return NextResponse.json(
      { success: false, error: 'URL을 올바르게 입력해주세요. (http:// 또는 https://로 시작)' },
      { status: 400 }
    )
  }

  // 기사 본문 가져오기
  let articleText = ''
  let articleTitle = ''

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const $ = cheerio.load(html)

    // 제목 추출
    articleTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text().trim()

    // 불필요 태그 제거
    $('script, style, nav, header, footer, aside, .ad, .advertisement, .related, .comment').remove()

    // 본문 추출
    for (const selector of CONTENT_SELECTORS) {
      const el = $(selector)
      if (el.length > 0) {
        const text = el.text().replace(/\s+/g, ' ').trim()
        if (text.length > 200) {
          articleText = text
          break
        }
      }
    }

    // fallback: 전체 p 태그 합치기
    if (!articleText) {
      const paragraphs: string[] = []
      $('p').each((_, el) => {
        const t = $(el).text().trim()
        if (t.length > 30) paragraphs.push(t)
      })
      articleText = paragraphs.join(' ')
    }

    articleText = articleText.slice(0, 3000)
  } catch {
    return NextResponse.json(
      { success: false, error: '기사를 불러오지 못했어요. URL을 확인하거나 다른 링크를 시도해보세요.' },
      { status: 400 }
    )
  }

  if (articleText.length < 100) {
    return NextResponse.json(
      { success: false, error: '기사 내용을 읽을 수 없어요. 다른 링크를 시도해보세요.' },
      { status: 400 }
    )
  }

  // 6단계 AI 분석
  const prompt = `다음 경제 뉴스 기사를 경제 과외 선생님처럼 6단계로 분석해주세요.

기사 제목: ${articleTitle}
기사 내용: ${articleText}

다음 JSON 형식으로만 응답하세요:
{
  "title": "기사 제목 (30자 이내로 요약, 없으면 직접 작성)",
  "oneline": "이 기사를 한 마디로 (15자 이내)",
  "whatHappened": "무슨 일이야? (초보자 언어로 2~3문장)",
  "whyHappened": "왜 이런 일이 생겼어? (원인 설명 2~3문장)",
  "myImpact": "나한테 어떤 영향이 있어? (실생활 연결 2~3문장)",
  "outlook": "앞으로 어떻게 될까? (전망 1~2문장)",
  "conclusion": "한 줄 결론 (10자 이내 핵심 메시지)"
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const analysis = JSON.parse(res.choices[0].message.content ?? '{}')

  return NextResponse.json({ success: true, analysis })
}
