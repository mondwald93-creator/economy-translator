/**
 * 공유 카드(og:image) 공통 부품 — 2026-08-11 신설
 *
 * 링크를 카톡·스레드에 붙였을 때 자동으로 뜨는 1200x630 그림을 서버가 그린다.
 * 카드 3종(홈·브리핑 상세·용어 상세)이 이 파일 하나를 같이 쓴다.
 *
 * ⚠️ 여기 있는 JSX는 브라우저가 아니라 satori(@vercel/og 내부 엔진)가 그린다.
 * 아래 제약은 2026-08-11 실측으로 확인한 것이다. 어기면 조용히 다르게 그려지거나 에러가 난다.
 *   - display:grid 는 에러. display:block 은 말없이 flex로 바뀐다 → 모든 div에 display:'flex' 명시
 *   - 세로로 쌓으려면 flexDirection:'column' 필수 (기본이 가로)
 *   - textWrap:'balance' 는 wordBreak:'keep-all' 과 같이 쓰면 깨진다 (satori#595, 미해결)
 *   - 선택자·가상요소·미디어쿼리·z-index·vw/vh 없음
 * 조사 원본 = 전직로드맵/1_프로젝트/경제번역기/모바일최적화/14_구현조사_공유이미지_2026-08-11.md
 */

import type { ReactElement } from 'react'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

/**
 * 캐시 표시를 덮어쓴다.
 * ⚠️ 이걸 빼면 안 된다. ImageResponse 기본값이 `immutable, max-age=31536000`(1년간 안 바뀜)이라,
 * 카톡·CDN이 그 말을 믿고 저장해 버려서 매일 새로 만들어도 어제 그림이 계속 공유된다.
 * 브리핑은 하루 단위로 바뀌므로 1시간마다 다시 확인하게 둔다.
 */
export const OG_HEADERS = {
  'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
}

const FONT = 'NotoKR'

/** 브리핑이 없는 날 떨어지는 기본 문장 */
const FALLBACK_LINE = '경제 뉴스를 쉬운 말로 옮겨 드려요'

/**
 * 카드 어디에나 나오는 고정 글자. 서브셋 폰트에 이게 빠지면 안 된다.
 * ⚠️ 2026-08-11 실물 확인에서 잡은 것: 여기 빠진 글자는 다른 폰트로 대체돼
 * 한 문장 안에서 굵기가 들쭉날쭉해진다. 특히 아래 세 가지를 빠뜨리기 쉽다.
 *   - 푸터의 영문 주소(항상 나옴)  - 숫자(날짜·금액)  - 기본 문장(FALLBACK_LINE)
 */
const FIXED_GLYPHS =
  '경제번역기오늘의브리핑용어사전매일분입문쉬운말로풀어쓴개년월일화수목금토' +
  // 홈 간판 카드의 메타 글자. 2026-08-20 홈 og를 간판 고정으로 바꾸면서 추가했다.
  // 이 넉 자가 빠져 있었는데, 그때까진 FallbackCard가 실제로 그려진 적이 없어 안 드러났다.
  '아침발행' +
  FALLBACK_LINE +
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789' +
  '().,·-·%’\'"…'

/**
 * Google Fonts에서 "이 글자들만" 담긴 축소판 폰트를 받는다.
 * 전체 Noto Sans KR은 9.93MB인데, 그날 카드에 쓰이는 글자만 뽑으면 7KB 수준이다(실측).
 *
 * ⚠️ fetch에 User-Agent 헤더를 붙이면 안 된다.
 * 붙이면 woff2 형식이 오는데 satori는 woff2를 못 읽는다(brotli 해제를 안 함).
 * 헤더 없이 부르면 truetype이 온다. 2026-08-11 실측 확인.
 */
async function loadFontSubset(text: string, weight: 400 | 700 | 900): Promise<ArrayBuffer> {
  const api = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`
  const css = await fetch(api).then((r) => r.text())
  const found = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)
  if (!found) throw new Error(`og font: subset url not found (weight ${weight})`)
  const res = await fetch(found[1])
  if (!res.ok) throw new Error(`og font: fetch failed ${res.status}`)
  return res.arrayBuffer()
}

/** 카드에 실제로 들어가는 글자만 모아 굵기 2벌을 받는다. */
export async function ogFonts(...texts: (string | null | undefined)[]) {
  const text = texts.filter(Boolean).join('') + FIXED_GLYPHS
  // 900(Black)도 받는다. 주간 카드 제목이 이 굵기다 — 옛 미리보기 HTML의 `.h{font-weight:900}`.
  // 700만 쓰면 제목이 눈에 띄게 얇아 보인다(2026-08-23 실물 대조에서 드러났다).
  const [black, bold, regular] = await Promise.all([
    loadFontSubset(text, 900),
    loadFontSubset(text, 700),
    loadFontSubset(text, 400),
  ])
  return [
    { name: FONT, data: black, style: 'normal' as const, weight: 900 as const },
    { name: FONT, data: bold, style: 'normal' as const, weight: 700 as const },
    { name: FONT, data: regular, style: 'normal' as const, weight: 400 as const },
  ]
}

/**
 * 설명을 첫 문장까지만 남긴다.
 * 용어 260개 전수 실측(2026-08-11): 첫 문장 83%가 "○○는 ~예요" 정의문이고,
 * 잘려 나가는 뒷부분은 "마치~" 61건·"예를 들어" 16건처럼 예시·비유다.
 * 즉 뜻은 남고 예시가 빠진다. 예시는 눌러 들어와야 볼 수 있는 것으로 남긴다.
 */
export function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}

/** 글자가 많으면 작게. 카드 밖으로 넘치는 것을 막는다. */
function fit(len: number, steps: [number, number][], last: number): number {
  for (const [max, size] of steps) if (len <= max) return size
  return last
}

type ShellProps = {
  badge: string
  meta: string
  footLeft: string
  children: ReactElement
}

/** 카드 3종이 공유하는 껍데기 — 배경·장식·배지·푸터 */
function Shell({ badge, meta, footLeft, children }: ShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '74px 80px 66px',
        position: 'relative',
        fontFamily: FONT,
        backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #1E293B 58%, #064E3B 100%)',
      }}
    >
      {/* 배경 장식 원 2개 */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: -150,
          right: -120,
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.13)',
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          bottom: -110,
          left: -90,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.08)',
        }}
      />
      {/* 목업에 있던 큰따옴표 장식은 뺐다.
          목업은 브라우저가 Georgia(serif)로 그렸는데 서버에는 그 서체가 없어
          한글 폰트로 대체되면서 모양이 뭉개지고 본문 글자와 겹쳤다(2026-08-11 실물 확인).
          초록 원 장식만으로 충분히 카드가 서므로 없애는 쪽을 택했다. */}

      {/* 머리: 배지 + 날짜 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            background: '#22C55E',
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: 700,
            padding: '9px 24px',
            borderRadius: 40,
          }}
        >
          {badge}
        </div>
        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.5)', fontSize: 26 }}>{meta}</div>
      </div>

      {/* 몸통 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        {children}
      </div>

      {/* 발: 구분선 + 브랜딩 */}
      <div
        style={{
          display: 'flex',
          borderTop: '2px solid rgba(255,255,255,0.14)',
          paddingTop: 26,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.42)', fontSize: 25 }}>
          {footLeft}
        </div>
        <div style={{ display: 'flex', color: '#22C55E', fontSize: 25, fontWeight: 700 }}>
          economytranslator.com
        </div>
      </div>
    </div>
  )
}

/** ① 홈 카드 — 오늘의 한 문장 (실측 23~46자) */
export function SentenceCard({ sentence, dateLabel }: { sentence: string; dateLabel: string }) {
  return (
    <Shell badge="경제번역기" meta={dateLabel} footLeft="매일 5분 경제 입문 브리핑">
      <div
        style={{
          display: 'flex',
          color: '#F8FAFC',
          fontSize: fit(sentence.length, [[28, 68], [38, 62]], 56),
          fontWeight: 700,
          lineHeight: 1.48,
          letterSpacing: '-0.02em',
          wordBreak: 'keep-all',
        }}
      >
        {sentence}
      </div>
    </Shell>
  )
}

/**
 * ② 브리핑 상세 카드 — 그날 헤드라인
 * 헤드라인은 원래 줄바꿈이 든 2줄 구조다(실측). 1줄차=사실, 2줄차=설명으로 위계를 나눈다.
 */
export function BriefingCard({
  headline,
  dateLabel,
}: {
  headline: string
  dateLabel: string
}) {
  const [first, ...rest] = headline.split('\n').map((s) => s.trim()).filter(Boolean)
  const second = rest.join(' ')
  return (
    <Shell badge="오늘의 브리핑" meta={dateLabel} footLeft="매일 5분 경제 입문 브리핑">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            color: '#F8FAFC',
            fontSize: fit(first.length, [[20, 62], [28, 54]], 46),
            fontWeight: 700,
            lineHeight: 1.42,
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
            marginBottom: second ? 20 : 0,
          }}
        >
          {first}
        </div>
        {second && (
          <div
            style={{
              display: 'flex',
              color: 'rgba(226,232,240,0.72)',
              fontSize: fit(second.length, [[24, 40], [34, 34]], 30),
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.015em',
              wordBreak: 'keep-all',
            }}
          >
            {second}
          </div>
        )}
      </div>
    </Shell>
  )
}

/** ③ 용어 카드 — 용어 + 한 줄 뜻 (용어명 2~15자, 설명은 첫 문장만) */
export function TermCard({
  term,
  category,
  explanation,
}: {
  term: string
  category: string
  explanation: string
}) {
  const desc = firstSentence(explanation)
  return (
    <Shell badge="경제용어" meta="경제번역기 용어사전" footLeft="쉬운 말로 풀어 쓴 경제용어 260개">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 26 }}>
          <div
            style={{
              display: 'flex',
              color: '#F8FAFC',
              fontSize: fit(term.length, [[6, 76], [10, 62]], 48),
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            {term}
          </div>
          <div
            style={{
              display: 'flex',
              border: '2px solid rgba(34,197,94,0.55)',
              color: '#4ADE80',
              fontSize: 24,
              fontWeight: 400,
              padding: '6px 20px',
              borderRadius: 30,
            }}
          >
            {category}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            color: 'rgba(226,232,240,0.78)',
            fontSize: fit(desc.length, [[45, 38], [65, 34]], 29),
            fontWeight: 400,
            lineHeight: 1.62,
            letterSpacing: '-0.015em',
            wordBreak: 'keep-all',
          }}
        >
          {desc}
        </div>
      </div>
    </Shell>
  )
}

/* ────────────────────────────────────────────────────────────────
   ④ 인스타 세로 카드 (2026-08-20 신설 · 마케팅 P4-8)

   위 3종과 크기가 다르다. 1080×1350(4:5)이고, 무엇보다 **카드 한 장이 전부**다.
   인스타는 캡션에 적은 링크가 눌리지 않는다(Meta 문서 확인). 스레드처럼
   "카드는 미끼, 본문 링크로 들어온다"가 안 통하고, 이 그림만 보고 주소를
   외워서 찾아와야 한다. 그래서 두 가지가 위 3종과 다르다.
     - 정보를 더 넣는다(지표 4개·오늘의 용어). 세로라 자리가 남기도 한다
     - 주소를 푸터에서 끌어올려 크게 쓴다
   ──────────────────────────────────────────────────────────────── */

export const IG_SIZE = { width: 1080, height: 1350 }

/** 세로 카드가 쓰는 고정 글자. 폰트 서브셋에 반드시 넣는다(ogFonts에 넘길 것). */
export const IG_FIXED_GLYPHS = '오늘의지표용어매일분경제입문브리핑주소에서전체보기▲▼—'

/** 지표 등락 색 — 빨강=상승/파랑=하락(한국 금융앱 관습, 2026-06-11 결정).
 *  카드 배경이 어두워서 사이트 색(#DC2626·#2563EB)을 그대로 쓰면 묻힌다.
 *  색상은 그대로 두고 밝기만 올린 값이다. */
function changeColor(direction: string): string {
  if (direction === 'up') return '#F87171'
  if (direction === 'down') return '#60A5FA'
  return 'rgba(255,255,255,0.55)'
}

/** 밝은 배경용 등락 색. 사이트와 같은 값을 그대로 쓴다(어두운 배경일 때만 밝기를 올렸었다). */
function changeColorLight(direction: string): string {
  if (direction === 'up') return '#DC2626'
  if (direction === 'down') return '#2563EB'
  return '#9CA3AF'
}

export type IgIndicator = { name: string; value: string; change: string; direction: string }

export function InstagramCard({
  headline,
  dateLabel,
  indicators,
  term,
}: {
  headline: string
  dateLabel: string
  indicators: IgIndicator[]
  term?: string | null
}) {
  const [first, ...rest] = headline.split('\n').map((s) => s.trim()).filter(Boolean)
  const second = rest.join(' ')
  const rows = indicators.slice(0, 4)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '92px 78px 84px',
        position: 'relative',
        fontFamily: FONT,
        // 2026-08-23 라이트로 전환. 주간 카드가 옛 형식대로 다크라서, 매일 올라가는
        // 일간을 밝게 두면 프로필 그리드에서 주마다 어두운 줄(주간 묶음)이 하나 껴 보인다.
        backgroundImage: 'linear-gradient(160deg, #FFFFFF 0%, #ECFDF3 100%)',
      }}
    >
      {/* 배경 장식 원 2개 — 가로 카드와 같은 값, 세로 비율에 맞춰 자리만 옮겼다 */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: -190,
          right: -150,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          bottom: -140,
          left: -120,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.07)',
        }}
      />

      {/* 머리 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            background: '#DCFCE7',
            color: '#16A34A',
            fontSize: 28,
            fontWeight: 700,
            padding: '10px 26px',
            borderRadius: 40,
          }}
        >
          오늘의 브리핑
        </div>
        <div style={{ display: 'flex', color: '#6B7280', fontSize: 28 }}>{dateLabel}</div>
      </div>

      {/* 헤드라인 */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 76 }}>
        <div
          style={{
            display: 'flex',
            color: '#111827',
            fontSize: fit(first.length, [[16, 68], [24, 58]], 50),
            fontWeight: 700,
            lineHeight: 1.38,
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
            marginBottom: second ? 24 : 0,
          }}
        >
          {first}
        </div>
        {second && (
          <div
            style={{
              display: 'flex',
              color: '#4B5563',
              fontSize: fit(second.length, [[22, 42], [32, 36]], 32),
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.015em',
              wordBreak: 'keep-all',
            }}
          >
            {second}
          </div>
        )}
      </div>

      {/* 지표 — 남는 세로 공간을 여기가 채운다 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255,255,255,0.72)',
            border: '2px solid rgba(17,24,39,0.08)',
            borderRadius: 24,
            padding: '34px 38px',
          }}
        >
          {rows.map((it, i) => (
            <div
              key={it.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: i === 0 ? 0 : 18,
                paddingBottom: i === rows.length - 1 ? 0 : 18,
                borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(17,24,39,0.08)',
              }}
            >
              <div style={{ display: 'flex', color: '#6B7280', fontSize: 31 }}>
                {it.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ display: 'flex', color: '#111827', fontSize: 33, fontWeight: 700 }}>
                  {it.value}
                </div>
                <div style={{ display: 'flex', color: changeColorLight(it.direction), fontSize: 29, fontWeight: 700 }}>
                  {it.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        {term && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 34 }}>
            <div
              style={{
                display: 'flex',
                border: '2px solid rgba(22,163,74,0.45)',
                color: '#16A34A',
                fontSize: 26,
                padding: '7px 20px',
                borderRadius: 30,
              }}
            >
              오늘의 용어
            </div>
            <div style={{ display: 'flex', color: '#111827', fontSize: 32, fontWeight: 700 }}>{term}</div>
          </div>
        )}
      </div>

      {/* 발 — 링크가 안 눌리는 매체라 주소를 크게 쓴다 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '2px solid rgba(17,24,39,0.10)',
          paddingTop: 30,
        }}
      >
        <div style={{ display: 'flex', color: '#16A34A', fontSize: 40, fontWeight: 700 }}>
          economytranslator.com
        </div>
        <div style={{ display: 'flex', color: '#9CA3AF', fontSize: 27, marginTop: 10 }}>
          매일 5분 경제 입문 브리핑 · 프로필 주소에서 전체 보기
        </div>
      </div>
    </div>
  )
}

/** 브리핑이 없는 날·문장이 빈 날 떨어지는 자리 */
export function FallbackCard() {
  return (
    <Shell badge="경제번역기" meta="매일 아침 발행" footLeft="매일 5분 경제 입문 브리핑">
      <div
        style={{
          display: 'flex',
          color: '#F8FAFC',
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.45,
          letterSpacing: '-0.02em',
          wordBreak: 'keep-all',
        }}
      >
        {FALLBACK_LINE}
      </div>
    </Shell>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * 주간 카드 (2026-08-23 신설)
 *
 * 6~7월에 손으로 만들던 인스타 주간 카드뉴스를 코드로 옮긴 것이다.
 * 색·서체·배치는 그때 쓰던 미리보기 HTML(`마케팅/인스타_카드_2026-*주_미리보기.html`)의
 * 값을 그대로 옮겼다. 미리보기가 300×375였으므로 1080×1350 기준으로 3.6배 환산했다.
 *
 * ⚠️ **커버는 옛 형식 그대로 다크다.** 일간 카드가 같은 다크 그라데이션이라 프로필
 *    그리드에서 섞여 보이는 문제가 있는데(2026-08-23 지적), 그건 **일간 쪽을 바꿔서**
 *    푼다. 주간 형식은 6~7월에 쓰던 것을 그대로 지킨다.
 * ────────────────────────────────────────────────────────────────────────── */

/** 주간 카드 공통 껍데기. dark=false면 라이트. */
function WeeklyShell({
  dark,
  children,
}: {
  dark: boolean
  children: ReactElement | ReactElement[]
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '94px 86px 86px',
        position: 'relative',
        fontFamily: FONT,
        backgroundImage: dark
          ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #064E3B 100%)'
          : 'linear-gradient(160deg, #FFFFFF 0%, #ECFDF3 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: -190,
          right: -150,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: dark ? 'rgba(34,197,94,0.13)' : 'rgba(34,197,94,0.10)',
        }}
      />
      {dark ? (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: -140,
            left: -120,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'rgba(34,197,94,0.08)',
          }}
        />
      ) : (
        <div style={{ display: 'flex' }} />
      )}
      {children}
    </div>
  )
}

/**
 * 머리 표시.
 * ⚠️ 옛 카드는 **밝은 장에서만 알약**을 쓰고, 어두운 장에서는 **배경 없는 초록 글씨**를 쓴다
 *    (미리보기 HTML에 `.badge`와 `.label`이 따로 있고, 다크 장은 label을 쓴다.
 *     실물 `card_03.jpg`의 "② 상장폐지"가 그 모양이다).
 */
function WeeklyBadge({
  text,
  dark,
  pill = false,
}: {
  text: string
  dark: boolean
  /** 어두운 장이라도 알약으로 그린다. 표지가 그렇다(실물 card_01의 "주간 정리") */
  pill?: boolean
}) {
  if (dark && pill) {
    return (
      <div
        style={{
          display: 'flex',
          background: '#22C55E',
          color: '#FFFFFF',
          fontSize: 40,
          fontWeight: 900,
          padding: '16px 40px',
          borderRadius: 999,
        }}
      >
        {text}
      </div>
    )
  }
  if (dark) {
    return (
      <div
        style={{
          display: 'flex',
          color: '#22C55E',
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: '0.06em',
        }}
      >
        {text}
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        background: '#DCFCE7',
        color: '#16A34A',
        fontSize: 40,
        fontWeight: 900,
        padding: '16px 40px',
        borderRadius: 999,
      }}
    >
      {text}
    </div>
  )
}

/** 카드 하단 줄 — 왼쪽에 짧은 한 줄, 오른쪽에 계정 이름. 모든 장에 들어간다. */
function WeeklyFoot({
  left,
  dark,
  brand = true,
}: {
  left: string
  dark: boolean
  /** 표지·팔로우 장은 계정만 쓴다(실물 card_01·card_07이 그렇다) */
  brand?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        marginTop: 'auto',
        paddingTop: 34,
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: dark ? 'none' : '2px solid rgba(17,24,39,0.10)',
      }}
    >
      <div style={{ display: 'flex', fontSize: 30, color: dark ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }}>
        {left || ''}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 30,
          fontWeight: 700,
          color: dark ? '#22C55E' : '#16A34A',
        }}
      >
        {brand ? '경제번역기 · @econ.5min' : '@econ.5min'}
      </div>
    </div>
  )
}

/**
 * 1장 — 커버. 옛 주간 카드와 같은 다크.
 * 줄 안에서 `**...**`로 감싼 곳이 초록이 된다(실물 카드가 "**8000선 회복** 📈"처럼 썼다).
 */
export function WeeklyCoverCard({
  rangeLabel,
  lines,
}: {
  rangeLabel: string
  lines: string[]
}) {
  // 글자 크기는 가장 긴 줄에 맞춘다. 강조 표시는 길이에서 뺀다.
  const longest = lines.reduce((m, l) => Math.max(m, plainText(l).length), 0)
  const size = fit(longest, [[10, 92], [13, 80], [16, 68], [19, 58]], 50)
  return (
    <WeeklyShell dark={true}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <WeeklyBadge text="주간 정리" dark={true} pill={true} />
        <div style={{ display: 'flex', fontSize: 38, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
          {rangeLabel}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {lines.map((l, i) => (
          <RichLine key={i} text={l} size={size} color="#F8FAFC" accent="#22C55E" weight={900} lineHeight={1.34} />
        ))}
      </div>

      <WeeklyFoot left="이번 주 경제, 4가지로 정리 →" dark={true} brand={false} />
    </WeeklyShell>
  )
}

/**
 * 2~5장 — 분야별. 다크·라이트를 번갈아 쓴다.
 * 실물 카드(`경제번역기_ins_260705/card_02.jpg`) 구조 그대로다:
 *   배지 → 제목 첫 줄 → 제목 둘째 줄(통째로 강조 + 이모지) → 본문 문단 둘 → 하단 한마디
 */
export function WeeklySectionCard({
  badge,
  titleTop,
  titleAccent,
  bodyParts,
  foot,
  dark,
}: {
  badge: string
  titleTop: string
  titleAccent: string
  bodyParts: string[]
  foot: string
  dark: boolean
}) {
  const titleLen = Math.max(titleTop.length, plainText(titleAccent).length)
  const titleSize = fit(titleLen, [[13, 82], [17, 70], [21, 60]], 52)
  const bodyLen = bodyParts.reduce((m, b) => m + plainText(b).length, 0)
  // 옛 미리보기 HTML의 `.b{font-size:13.5px}`를 1080 기준으로 환산하면 약 48px이다.
  // 글자가 많은 날만 단계적으로 줄인다.
  const bodySize = fit(bodyLen, [[80, 48], [120, 44], [160, 40]], 36)
  const ink = dark ? '#F8FAFC' : '#111827'
  const sub = dark ? 'rgba(255,255,255,0.66)' : '#4B5563'
  // 어두운 장에서는 #22C55E가 배경에 가라앉아 밝은 민트를 쓴다(실물 card_03의 "200억"이 그 색이다)
  const hot = dark ? '#5EEAD4' : '#16A34A'

  return (
    <WeeklyShell dark={dark}>
      <div style={{ display: 'flex' }}>
        <WeeklyBadge text={badge} dark={dark} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: titleSize,
              fontWeight: 900,
              color: ink,
              lineHeight: 1.4,
            }}
          >
            {titleTop}
          </div>
          {titleAccent ? (
            <div style={{ display: 'flex' }}>
              <RichLine
                text={`**${plainText(titleAccent)}**`}
                size={titleSize}
                color={ink}
                accent={hot}
                weight={900}
                lineHeight={1.4}
              />
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34, gap: 22 }}>
          {bodyParts.map((b, i) => (
            <RichLine
              key={i}
              text={b}
              size={bodySize}
              color={sub}
              accent={hot}
              weight={400}
              lineHeight={1.62}
            />
          ))}
        </div>
      </div>

      <WeeklyFoot left={foot} dark={dark} />
    </WeeklyShell>
  )
}

/**
 * 6장 — 이번 주 숫자. 여기 값은 전부 코드가 만든 실측이다.
 * 실물 카드(`card_06.jpg`)를 따라 **지표마다 둥근 박스**로 떼어 놓고,
 * 머리는 배지가 아니라 초록 라벨로 둔다. 값 옆 한마디(note)는 AI가 쓴다.
 */
export function WeeklyStatsCard({
  rangeLabel,
  indicators,
  notes,
}: {
  rangeLabel: string
  indicators: IgIndicator[]
  notes?: Record<string, string>
}) {
  return (
    <WeeklyShell dark={true}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', fontSize: 42, fontWeight: 900, color: '#22C55E' }}>
          📊 이번 주 숫자
        </div>
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          ({rangeLabel})
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 24 }}>
        {indicators.map((it) => {
          const note = notes?.[it.name] ?? ''
          return (
            <div
              key={it.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 30,
                padding: '38px 44px',
              }}
            >
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>
                {it.name.replace('(원/달러)', '')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, color: changeColor(it.direction) }}>
                  {it.value}
                </div>
                <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: changeColor(it.direction) }}>
                  {it.change}
                </div>
                {note ? (
                  <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                    {note}
                  </div>
                ) : (
                  <div style={{ display: 'flex' }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <WeeklyFoot left="오른 건 지수, 지갑은 아직" dark={true} />
    </WeeklyShell>
  )
}

/** 7장 — 팔로우 유도. 문구는 고정이고 캡션 끝 두 줄과 같은 말을 쓴다. */
export function WeeklyCtaCard() {
  return (
    <WeeklyShell dark={false}>
      <div style={{ display: 'flex' }}>
        <WeeklyBadge text="매일 5분" dark={false} />
      </div>

      {/* 실물 card_07 그대로: 커피잔을 크게 놓고 전부 가운데로 모은다.
          다른 장은 왼쪽 정렬인데 이 장만 가운데인 게 원본이다. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', fontSize: 150, marginBottom: 46 }}>☕</div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          {/* satori는 &nbsp;를 공백으로 안 읽는다(붙어서 나온다). 여백으로 띄운다 */}
          <div
            style={{
              display: 'flex',
              fontSize: 88,
              fontWeight: 900,
              color: '#111827',
              lineHeight: 1.3,
              marginRight: 22,
            }}
          >
            매일 아침
          </div>
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 900, color: '#16A34A', lineHeight: 1.3 }}>
            5분
          </div>
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 900, color: '#111827', lineHeight: 1.3 }}>
            이면
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 88, fontWeight: 900, color: '#111827', lineHeight: 1.3 }}>
          경제가 쉬워져요
        </div>

        <div style={{ display: 'flex', marginTop: 34, fontSize: 42, color: '#6B7280', fontWeight: 700 }}>
          👇 팔로우하면 내일 브리핑이 와요
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 46,
            background: '#22C55E',
            color: '#FFFFFF',
            fontSize: 50,
            fontWeight: 900,
            padding: '38px 90px',
            borderRadius: 30,
            lineHeight: 1.34,
          }}
        >
          <div style={{ display: 'flex' }}>프로필 링크에서</div>
          <div style={{ display: 'flex' }}>오늘 브리핑 보기 →</div>
        </div>
      </div>

      <WeeklyFoot left="경제 왕초보 환영" dark={false} brand={false} />
    </WeeklyShell>
  )
}

/**
 * 강조가 섞인 한 줄을 그린다 — 2026-08-23 신설 (주간 카드용)
 *
 * `**이렇게**` 감싼 곳만 강조색으로 낸다. 옛 주간 카드가 숫자와 결론을 초록으로
 * 짚어 주던 방식이다("장중 **7,378**까지 밀렸다가 7/3 하루 **+5.76%** 반등했어요").
 *
 * ⚠️ satori는 한 텍스트 안에서 일부만 색을 바꾸지 못한다(인라인 span이 없다).
 *    그래서 **어절 단위로 쪼개 flexWrap으로 흘려보낸다.**
 *    이때 공백을 gap으로 주면 "**7,378**까지"처럼 원래 붙어 있던 자리까지 벌어진다.
 *    그래서 gap을 안 쓰고, 원문에 공백이 있던 어절에만 marginRight를 준다.
 */
function RichLine({
  text,
  size,
  color,
  accent,
  weight = 700,
  lineHeight = 1.42,
}: {
  text: string
  size: number
  color: string
  accent: string
  weight?: number
  lineHeight?: number
}) {
  type Tok = { t: string; hot: boolean; gap: boolean }
  const toks: Tok[] = []
  let pendingGap = false

  for (const seg of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!seg) continue
    const hot = seg.startsWith('**') && seg.endsWith('**')
    const body = hot ? seg.slice(2, -2) : seg
    for (const piece of body.split(/(\s+)/)) {
      if (!piece) continue
      if (/^\s+$/.test(piece)) {
        // 앞 어절 뒤에 공백이 있었다는 표시. 어절 자체로는 넣지 않는다.
        if (toks.length) toks[toks.length - 1].gap = true
        else pendingGap = true
        continue
      }
      toks.push({ t: piece, hot, gap: false })
      if (pendingGap) pendingGap = false
    }
  }

  // ⚠️ 줄 간격은 **어절 요소의 lineHeight로만** 준다.
  // rowGap을 같이 주면 요소가 이미 가진 줄높이에 더해져 두 번 벌어진다
  // (2026-08-23 실물 대조에서 "줄간격이 넓다"고 지적받은 자리).
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {toks.map((tk, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            color: tk.hot ? accent : color,
            fontSize: size,
            fontWeight: weight,
            lineHeight,
            marginRight: tk.gap ? Math.round(size * 0.28) : 0,
          }}
        >
          {tk.t}
        </div>
      ))}
    </div>
  )
}

/** `**강조**` 표시를 걷어낸 순수 글자. 폰트 서브셋에 넘길 때 쓴다. */
export function plainText(s: string): string {
  return s.replace(/\*\*/g, '')
}
