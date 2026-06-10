import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

interface Props {
  searchParams: { email?: string }
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const email = searchParams.email?.trim().toLowerCase()
  let success = false

  if (email) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase
      .from('subscribers')
      .update({ is_active: false })
      .eq('email', email)
    success = !error
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="rounded-card border border-line p-10 text-center max-w-md">
        <div className="text-4xl mb-5">{success ? '👋' : '⚠️'}</div>
        {success ? (
          <>
            <h1 className="text-xl font-bold text-ink mb-3">구독이 취소됐어요</h1>
            <p className="text-sm text-ink-muted leading-relaxed mb-6">
              <strong>{email}</strong>으로의 이메일 발송을 중단할게요.<br />
              언제든 다시 구독하실 수 있어요.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-ink mb-3">이메일 주소를 찾을 수 없어요</h1>
            <p className="text-sm text-ink-muted leading-relaxed mb-6">
              다시 확인해보시거나 홈에서 구독을 취소해주세요.
            </p>
          </>
        )}
        <Link
          href="/"
          className="inline-block text-sm font-semibold px-6 py-3 rounded-lg text-white"
          style={{ background: '#22C55E' }}
        >
          경제번역기 홈으로
        </Link>
      </div>
    </div>
  )
}
