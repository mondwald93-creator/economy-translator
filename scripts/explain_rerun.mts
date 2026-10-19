// 뉴스 해설을 지금 코드(본문 받기 + 해설 프롬프트 + 내부 말 정리)로 다시 쓴다.
//
//   npx tsx scripts/explain_rerun.mts <id목록.json> <결과.json>                     다시 쓰기만(DB에는 아무것도 안 씀)
//   npx tsx scripts/explain_rerun.mts <id목록.json> <결과.json> --apply <백업.json>   본문을 받은 기사만 DB에 덮어씀(먼저 백업)
//
// id목록.json = ["uuid", …]. 결과.json = 기사마다 제목·본문 상태·옛 해설·새 해설.
// --apply는 news_articles.full_analysis의 6칸만 바꾸고 다른 칸(category 등)은 그대로 둔다. body·model 기록을 붙인다.
// 본문을 못 받은 기사는 옛 해설을 그대로 둔다(제목만 보고 다시 쓰면 같은 문제가 난다).
// 쓴 날: 2026-10-19(뉴스 해설 재감사 뒤 프롬프트 시험 · 옛 제목 기반 해설 다시 쓰기).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function loadEnv(file: string, only?: string[]) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]] && (!only || only.includes(m[1]))) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv(path.join(ROOT, '.env.local'))
// 로컬엔 경번 Claude 키가 없다(Vercel에만). 재실행은 같은 조직의 takt 키를 빌려 쓴다(select_rerun.mts와 같음)
loadEnv(path.resolve(ROOT, '../takt/.env.local'), ['ANTHROPIC_API_KEY'])
if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY가 없다'); process.exit(1) }

const [idPath, outPath, flag, backupPath] = process.argv.slice(2)
if (!idPath || !outPath || (flag && (flag !== '--apply' || !backupPath))) {
  console.error('사용법: npx tsx scripts/explain_rerun.mts <id목록.json> <결과.json> [--apply <백업.json>]'); process.exit(1)
}
const APPLY = flag === '--apply'

const { fetchArticleBodies } = await import('../src/lib/articleBody.ts')
const { generateTop3Analysis } = await import('../src/lib/generateBriefing.ts')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }
const ids: string[] = JSON.parse(fs.readFileSync(idPath, 'utf8'))

type Row = { id: string; date: string; title: string; original_url: string | null; full_analysis: Record<string, unknown> | null }
const rows: Row[] = []
for (let i = 0; i < ids.length; i += 50) {
  const q = ids.slice(i, i + 50).join(',')
  const r = await fetch(`${URL}/rest/v1/news_articles?select=id,date,title,original_url,full_analysis&id=in.(${q})`, { headers })
  rows.push(...(await r.json()) as Row[])
}
console.log(`기사 ${rows.length}/${ids.length}건 읽음`)

const bodies = await fetchArticleBodies(rows.map(r => ({ id: r.id, url: r.original_url, title: r.title })))
const withBody = rows.filter(r => bodies.get(r.id)?.ok)
console.log(`본문 받음 ${withBody.length}/${rows.length}`)

// 9건씩 나눠 쓴다(analyzeWithBody가 그 안에서 3건씩 동시에 보낸다 = 발행 때와 같은 묶음)
const FIELDS = ['oneline', 'whatHappened', 'whyHappened', 'myImpact', 'outlook', 'conclusion'] as const
const fresh = new Map<string, Record<string, string>>()
for (let i = 0; i < withBody.length; i += 9) {
  const part = withBody.slice(i, i + 9)
  const t0 = Date.now()
  const res = await generateTop3Analysis(part.map(r => ({ id: r.id, title: r.title, body: bodies.get(r.id) })))
  for (const a of res) fresh.set(a.id, a as unknown as Record<string, string>)
  console.log(`  ${Math.min(i + 9, withBody.length)}/${withBody.length} · ${((Date.now() - t0) / 1000).toFixed(0)}초`)
}

const out = rows.map(r => {
  const b = bodies.get(r.id)
  const n = fresh.get(r.id)
  return {
    id: r.id, date: r.date, title: r.title, url: r.original_url,
    body: b ? { ok: b.ok, chars: b.text.length, reason: b.reason ?? null } : null,
    old: Object.fromEntries(FIELDS.map(f => [f, r.full_analysis?.[f] ?? ''])),
    new: n ? Object.fromEntries([...FIELDS.map(f => [f, n[f] ?? '']), ['model', n.model]]) : null,
  }
})
fs.writeFileSync(outPath, JSON.stringify(out, null, 1))
console.log(`결과 → ${outPath} (새 해설 ${fresh.size}건)`)

if (APPLY) {
  const targets = rows.filter(r => fresh.has(r.id))
  fs.writeFileSync(backupPath, JSON.stringify(targets.map(r => ({ id: r.id, full_analysis: r.full_analysis })), null, 1))
  console.log(`백업 ${targets.length}건 → ${backupPath}`)
  let ok = 0
  for (const r of targets) {
    const n = fresh.get(r.id)!
    const b = bodies.get(r.id)!
    const next = { ...(r.full_analysis ?? {}), ...Object.fromEntries(FIELDS.map(f => [f, n[f]])), model: n.model, body: { ok: b.ok, chars: b.text.length, reason: b.reason ?? null }, rewritten: '2026-10-19' }
    const res = await fetch(`${URL}/rest/v1/news_articles?id=eq.${r.id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ full_analysis: next }) })
    if (res.ok) ok++
    else console.error('  쓰기 실패', r.id, res.status, await res.text())
  }
  console.log(`DB에 씀 ${ok}/${targets.length}`)
}
