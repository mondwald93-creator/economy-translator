import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { slugifyTerm } from '@/lib/terms'

// ⚠️ 요청마다 새로 만든다 + Supabase 조회에 `cache: 'no-store'` (dictionary/page.tsx와 같은 패턴).
//  2026-09-21 실측: 설정이 없어 빌드 때 한 번 만들어진 사이트맵이 그대로 굳었다.
//  9/13 배포 뒤 8일간 브리핑 8장·새 용어 6개가 사이트맵에 안 올라갔다(페이지 자체는 200).
//  그전엔 거의 매일 배포해서 티가 안 났다.
export const dynamic = 'force-dynamic'

const BASE = 'https://economytranslator.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/dictionary`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/briefing`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/analyze`, changeFrequency: 'monthly', priority: 0.6 },
  ]

  // 날짜별 브리핑 아카이브 (매일 한 장씩 자동으로 늘어남)
  const { data: briefings } = await supabase
    .from('briefings')
    .select('date, created_at')
    .not('headline', 'is', null)
    .order('date', { ascending: false })

  const briefingPages: MetadataRoute.Sitemap = (briefings ?? []).map((b) => ({
    url: `${BASE}/briefing/${b.date}`,
    lastModified: b.created_at ? new Date(b.created_at) : undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // 경제용어 개별 페이지 (검색 유입 주력 — 수요가 끊기지 않는 페이지)
  const { data: terms } = await supabase
    .from('terms')
    .select('term, created_at')
    .order('term')

  const termPages: MetadataRoute.Sitemap = (terms ?? []).map((t) => ({
    url: `${BASE}/dictionary/${slugifyTerm(t.term)}`,
    lastModified: t.created_at ? new Date(t.created_at) : undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  // 최근 30일 뉴스 기사
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: articles } = await supabase
    .from('news_articles')
    .select('id, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(300)

  const articlePages: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${BASE}/news/${a.id}`,
    lastModified: new Date(a.created_at),
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [...staticPages, ...termPages, ...briefingPages, ...articlePages]
}
