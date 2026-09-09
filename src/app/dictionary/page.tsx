import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import DictionaryList from '@/components/dictionary/DictionaryList'
import type { Term } from '@/lib/terms'

// ⚠️ Supabase 조회에 `cache: 'no-store'`를 반드시 붙인다 (CLAUDE.md 「page.tsx Supabase 클라이언트」와 같은 함정).
//  용어 조회는 슬러그와 무관하게 늘 같은 조회문이라 캐시 열쇠가 하나로 고정된다.
//  그 한 칸이 굳으면 새 용어가 영영 안 보인다. 브리핑은 날짜별로 조회문이 달라져 이 함정을 피해간다.
//  2026-09-09 실측: revalidate=86400으로 뒀더니 8/17 시점 264개에서 22일간 멈췄고,
//  8/18 이후 추가된 용어 12개가 사이트맵엔 있는데 상세 페이지는 404였다(서치 콘솔 색인 경고의 원인).
export const dynamic = 'force-dynamic'

const BASE = 'https://economytranslator.com'

export const metadata: Metadata = {
  title: '경제용어 사전',
  description: '기준금리, 환율, 인플레이션처럼 어렵게 느껴지는 경제 용어를 쉬운 말로 풀어드려요. 경제 뉴스를 읽다 막히는 말이 있으면 여기서 찾아보세요.',
  alternates: { canonical: `${BASE}/dictionary` },
  openGraph: {
    title: '경제용어 사전 | 경제번역기',
    description: '어렵게 느껴지는 경제 용어를 쉬운 말로 설명해드려요.',
    url: `${BASE}/dictionary`,
  },
}

async function getTerms(): Promise<Term[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )
  const { data } = await db
    .from('terms')
    .select('id, term, category, explanation, example')
    .order('term')
  return (data as Term[]) ?? []
}

export default async function DictionaryPage() {
  const terms = await getTerms()

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="border-l-4 border-brand-green pl-4 py-1">
        <p className="section-label">사전</p>
        <h1 className="text-xl font-bold text-ink leading-snug">경제용어 사전</h1>
        <p className="text-sm text-ink-muted mt-1">
          어렵게 느껴지는 경제 용어를 쉬운 말로 설명해드려요
        </p>
      </div>

      <DictionaryList terms={terms} />
    </div>
  )
}
