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
async function loadFontSubset(text: string, weight: 400 | 700): Promise<ArrayBuffer> {
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
  const [bold, regular] = await Promise.all([
    loadFontSubset(text, 700),
    loadFontSubset(text, 400),
  ])
  return [
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
        backgroundImage: 'linear-gradient(160deg, #0F172A 0%, #1E293B 55%, #064E3B 100%)',
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
          background: 'rgba(34,197,94,0.13)',
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
          background: 'rgba(34,197,94,0.08)',
        }}
      />

      {/* 머리 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            background: '#22C55E',
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: 700,
            padding: '10px 26px',
            borderRadius: 40,
          }}
        >
          오늘의 브리핑
        </div>
        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.5)', fontSize: 28 }}>{dateLabel}</div>
      </div>

      {/* 헤드라인 */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 76 }}>
        <div
          style={{
            display: 'flex',
            color: '#F8FAFC',
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
              color: 'rgba(226,232,240,0.72)',
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
            background: 'rgba(255,255,255,0.06)',
            border: '2px solid rgba(255,255,255,0.10)',
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
                borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', color: 'rgba(226,232,240,0.66)', fontSize: 31 }}>
                {it.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ display: 'flex', color: '#F8FAFC', fontSize: 33, fontWeight: 700 }}>
                  {it.value}
                </div>
                <div style={{ display: 'flex', color: changeColor(it.direction), fontSize: 29, fontWeight: 700 }}>
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
                border: '2px solid rgba(34,197,94,0.55)',
                color: '#4ADE80',
                fontSize: 26,
                padding: '7px 20px',
                borderRadius: 30,
              }}
            >
              오늘의 용어
            </div>
            <div style={{ display: 'flex', color: '#F8FAFC', fontSize: 32, fontWeight: 700 }}>{term}</div>
          </div>
        )}
      </div>

      {/* 발 — 링크가 안 눌리는 매체라 주소를 크게 쓴다 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '2px solid rgba(255,255,255,0.14)',
          paddingTop: 30,
        }}
      >
        <div style={{ display: 'flex', color: '#22C55E', fontSize: 40, fontWeight: 700 }}>
          economytranslator.com
        </div>
        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.42)', fontSize: 27, marginTop: 10 }}>
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
