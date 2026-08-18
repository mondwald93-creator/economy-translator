import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import DictionaryList from '@/components/dictionary/DictionaryList'
import type { Term } from '@/lib/terms'

// 하루 한 번 갱신. 새 용어가 추가되면 다음 갱신 때 목록에 들어온다.
export const revalidate = 86400

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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
