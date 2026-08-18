import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CATEGORY_COLORS, slugifyTerm, type Term } from '@/lib/terms'

// 하루 한 번 갱신. 새 용어가 추가돼도 다음 갱신 때 페이지가 생긴다.
export const revalidate = 86400
export const dynamicParams = true

const BASE = 'https://economytranslator.com'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getAllTerms(): Promise<Term[]> {
  const { data } = await getDb()
    .from('terms')
    .select('id, term, category, explanation, example')
    .order('term')
  return (data as Term[]) ?? []
}

async function findTerm(slug: string): Promise<Term | null> {
  const decoded = decodeURIComponent(slug)
  const terms = await getAllTerms()
  return terms.find((t) => slugifyTerm(t.term) === decoded) ?? null
}

export async function generateStaticParams() {
  const terms = await getAllTerms()
  return terms.map((t) => ({ slug: slugifyTerm(t.term) }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const term = await findTerm(params.slug)
  if (!term) return { title: '용어를 찾을 수 없어요' }

  const title = `${term.term} 뜻, 쉽게 설명하면`
  const description = term.explanation.slice(0, 150)
  const url = `${BASE}/dictionary/${slugifyTerm(term.term)}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | 경제번역기`, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: `${title} | 경제번역기`, description },
  }
}

export default async function TermPage({ params }: { params: { slug: string } }) {
  const term = await findTerm(params.slug)
  if (!term) notFound()

  const all = await getAllTerms()
  const related = all
    .filter((t) => t.category === term.category && t.id !== term.id)
    .slice(0, 8)

  const url = `${BASE}/dictionary/${slugifyTerm(term.term)}`

  // 검색엔진에 "이건 용어 정의 페이지다"라고 알려주는 표
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': url,
        name: term.term,
        description: term.explanation,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: '경제용어 사전',
          url: `${BASE}/dictionary`,
        },
        termCode: term.category,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: BASE },
          { '@type': 'ListItem', position: 2, name: '경제용어 사전', item: `${BASE}/dictionary` },
          { '@type': 'ListItem', position: 3, name: term.term, item: url },
        ],
      },
    ],
  }

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 위치 표시 */}
      <nav className="text-xs text-ink-subtle">
        <Link href="/" className="hover:text-ink-muted">홈</Link>
        <span className="mx-1.5">›</span>
        <Link href="/dictionary" className="hover:text-ink-muted">경제용어 사전</Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-muted">{term.term}</span>
      </nav>

      {/* 제목 */}
      <div className="border-l-4 border-brand-green pl-4 py-1">
        <p className="section-label">경제용어</p>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-ink leading-snug">{term.term}</h1>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[term.category] ?? CATEGORY_COLORS['기타']}`}>
            {term.category}
          </span>
        </div>
      </div>

      {/* 설명 */}
      <div className="border border-line rounded-[14px] p-5 bg-white">
        <p className="text-[11px] font-semibold text-ink-subtle mb-2">쉽게 말하면</p>
        <p className="text-sm text-ink leading-relaxed">{term.explanation}</p>
      </div>

      {/* 예시 */}
      {term.example && (
        <div className="border border-line rounded-[14px] p-5 bg-white">
          <p className="text-[11px] font-semibold text-ink-subtle mb-2">예를 들면</p>
          <p className="text-sm text-ink-muted leading-relaxed border-l-2 border-line pl-3">
            {term.example}
          </p>
        </div>
      )}

      {/* 같은 분야 용어 */}
      {related.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-ink">{term.category} 분야의 다른 용어</p>
          <div className="flex flex-wrap gap-1.5">
            {related.map((t) => (
              <Link
                key={t.id}
                href={`/dictionary/${slugifyTerm(t.term)}`}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-line bg-white text-ink-muted hover:bg-surface transition-colors"
              >
                {t.term}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2">
        <Link
          href="/dictionary"
          className="text-xs text-brand-green-dark underline underline-offset-2"
        >
          경제용어 사전 전체 보기
        </Link>
      </div>
    </div>
  )
}
