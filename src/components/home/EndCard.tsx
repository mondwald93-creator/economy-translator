import Link from 'next/link'
import DailyStreakBanner from './DailyStreakBanner'

interface Props {
  /** 오늘의 경제 단어 — 없으면 그 칸만 빠진다. */
  dailyTerm: { term: string; explanation: string } | null
  /** 다음에 볼 브리핑 날짜(YYYY-MM-DD). 홈에서는 어제, 지난 브리핑에서는 그 전날. */
  prevDate?: string | null
  /** 지난 브리핑에서는 '오늘 치'가 아니라 '이 날 치'로 말한다. */
  snapshot?: boolean
}

function label(date: string): string {
  const [y, m, d] = date.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/**
 * 화면의 끝을 만드는 카드.
 * "하루 한 편" 서비스의 자산은 완독의 기분과 내일의 약속이라, 다 읽은 자리에 그 둘을 둔다.
 * (완독 배너는 원래 글 맨 위에 있어 '완료'가 아니라 '예고'로 읽혔다 — 2026-08-11 이동)
 */
export default function EndCard({ dailyTerm, prevDate, snapshot = false }: Props) {
  return (
    <section className="rounded-[16px] bg-ink text-white px-5 py-6 sm:px-7">
      <p className="text-[15px] font-extrabold">
        🎉 {snapshot ? '이 날 브리핑 끝!' : '오늘 치 끝! 5분 걸렸어요'}
      </p>
      <p className="text-[13px] text-[#9CA3AF] mt-1">
        {snapshot ? '오늘 브리핑도 매일 아침 9시에 올라와요' : '내일 아침 9시에 새 브리핑이 올라와요'}
      </p>

      {!snapshot && (
        <div className="mt-4">
          <DailyStreakBanner />
        </div>
      )}

      {dailyTerm && (
        <div className="mt-4 rounded-[12px] bg-white/[0.07] px-4 py-3.5">
          <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest">
            {snapshot ? '그날' : '오늘'} 알면 좋은 경제 단어
          </p>
          <p className="text-[17px] font-black text-[#86EFAC] mt-1.5">{dailyTerm.term}</p>
          <p className="text-[14px] text-[#CBD5E1] leading-relaxed mt-1">{dailyTerm.explanation}</p>
          <Link
            href="/dictionary?from=endcard"
            className="inline-block text-[13px] font-bold text-white/80 underline underline-offset-4 mt-2.5"
          >
            단어 더 보기 →
          </Link>
        </div>
      )}

      {prevDate && (
        <Link
          href={`/briefing/${prevDate}?from=endcard`}
          className="block bg-brand-green text-white text-[14px] font-extrabold text-center py-3 rounded-[12px] mt-4"
        >
          {label(prevDate)} 브리핑 보기 →
        </Link>
      )}
    </section>
  )
}
