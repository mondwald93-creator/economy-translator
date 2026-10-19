// 본문 받기(articleBody.ts) 회귀 점검. DB에는 아무것도 쓰지 않는다.
//
//   npx tsx scripts/body_check.mts <목록.json> <결과.json>          목록 = [{id, url, title}]
//   npx tsx scripts/body_check.mts <목록.json> <결과.json> <이전 결과.json>   + 이전 결과와 비교(좋아짐·나빠짐·글 바뀜)
//
// 선택자·주소 바꾸기·본문 검사를 고친 뒤, 같은 주소 목록을 고치기 전·후로 받아 나빠진 기사가 없는지 본다.
// 쓴 날: 2026-10-19(뉴스 해설 재감사 162건 = 국제신문·SBS Biz·조선일보·서울경제TV 추가 · 본문-제목 일치 검사).
import fs from 'node:fs'

const [listPath, outPath, prevPath] = process.argv.slice(2)
if (!listPath || !outPath) { console.error('사용법: npx tsx scripts/body_check.mts <목록.json> <결과.json> [이전 결과.json]'); process.exit(1) }
const { fetchArticleBody } = await import('../src/lib/articleBody.ts')

type Item = { id: string; url: string; title?: string }
type Res = { id: string; url: string; ok: boolean; chars: number; reason: string | null; head: string }
const list: Item[] = JSON.parse(fs.readFileSync(listPath, 'utf8'))

const out: Res[] = []
for (let i = 0; i < list.length; i += 8) {
  const part = await Promise.all(list.slice(i, i + 8).map(async a => {
    const b = await fetchArticleBody(a.url, a.title)
    return { id: a.id, url: a.url, ok: b.ok, chars: b.text.length, reason: b.reason ?? null, head: b.text.slice(0, 80) }
  }))
  out.push(...part)
}
fs.writeFileSync(outPath, JSON.stringify(out, null, 1))
const okN = out.filter(r => r.ok).length
console.log(`받음 ${okN}/${out.length}`)
const reasons = new Map<string, number>()
for (const r of out) if (!r.ok) reasons.set(r.reason ?? '?', (reasons.get(r.reason ?? '?') ?? 0) + 1)
for (const [k, n] of reasons) console.log(`  실패 ${n} · ${k}`)

if (prevPath) {
  const prev = new Map((JSON.parse(fs.readFileSync(prevPath, 'utf8')) as Res[]).map(r => [r.id, r]))
  for (const r of out) {
    const p = prev.get(r.id)
    if (!p) continue
    const host = new URL(r.url).host
    if (!p.ok && r.ok) console.log(`🟢 좋아짐 ${host} ${r.chars}자 · ${r.head.slice(0, 50)}`)
    else if (p.ok && !r.ok) console.log(`🔴 나빠짐 ${host} ${p.chars}자 → 실패(${r.reason}) · ${p.head.slice(0, 50)}`)
    else if (p.ok && r.ok && p.head !== r.head) console.log(`🟡 글 바뀜 ${host} ${p.chars}→${r.chars}자\n     전: ${p.head.slice(0, 60)}\n     후: ${r.head.slice(0, 60)}`)
  }
}
