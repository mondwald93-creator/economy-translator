/**
 * 홈 공유 카드 — 브랜드 간판 (2026-08-11 신설 · 2026-08-20 고정판으로 교체)
 * 링크를 카톡·스레드에 붙였을 때 뜨는 1200x630 그림.
 *
 * ⚠️ 매일 바뀌지 않는다. 예전엔 그날 「오늘의 한 문장」을 그렸는데,
 * 스레드 계정 고정글(소개글)이 홈 링크를 달고 있어서 브리핑이 바뀔 때마다
 * 고정글 카드까지 같이 바뀌었다. 바로 아래 자동 게시글(브리핑 상세 카드)과
 * 거의 같은 그림 두 장이 겹쳐 보였다(2026-08-20 폰 실물 확인).
 *
 * 홈으로 보내는 링크는 전부 간판 자리다 — 스레드 고정글·프로필, 이메일,
 * 링크드인, 디스콰이엇, GeekNews, 인스타 프로필(마케팅 P3-1 UTM 표).
 * 그날 내용은 `/briefing/<날짜>` 카드가 맡는다. 그쪽은 그대로 둔다.
 */
import { ImageResponse } from 'next/og'
import { OG_SIZE, OG_CONTENT_TYPE, OG_HEADERS, ogFonts, FallbackCard } from '@/lib/ogCard'

export const alt = '경제번역기 — 매일 5분 경제 입문 브리핑'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  // DB를 보지 않는다. 그리는 글자가 고정이라 폰트 서브셋도 FIXED_GLYPHS만으로 충분하다.
  return new ImageResponse(FallbackCard(), {
    ...size,
    fonts: await ogFonts(),
    headers: OG_HEADERS,
  })
}
