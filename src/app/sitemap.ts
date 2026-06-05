import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

const BASE = 'https://economy-translator.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/dictionary`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/analyze`, changeFrequency: 'monthly', priority: 0.6 },
  ]

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

  return [...staticPages, ...articlePages]
}
