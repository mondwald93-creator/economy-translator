// TOP3 겹침 검문(top3Dedup.ts)을 지난 날짜의 실제 후보로 다시 돌려 본다. DB에는 아무것도 쓰지 않는다.
// 판정 모델(gpt-5.4-mini)을 실제로 부르므로 하루치에 2~3회 호출이 나간다. 같은 입력이라도 판정이 매번 같지는 않다(경향으로만 볼 것).
//
//   npx tsx scripts/top3_dedup_rerun.mts 2026-10-16
//
// 재료: briefing_scores.inputs.candidateTitles(그날 후보 30건) + briefings.top3_dedup.rounds[0].titles(그날 AI가 처음 고른 3개).
// 쓴 날: 2026-10-15(뺀 기사 재진입 막기 검증) · 2026-10-16(판정 2회→3회 검증, 10/13·10/15·10/16 세 날).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!   // briefing_scores는 anon 키로 못 읽는다(RLS)
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY }

const date = process.argv[2]
if (!date) { console.error('날짜를 주세요. 예: npx tsx scripts/top3_dedup_rerun.mts 2026-10-16'); process.exit(1) }

const [score] = await (await fetch(`${URL}/rest/v1/briefing_scores?date=eq.${date}&select=inputs`, { headers })).json()
const [brief] = await (await fetch(`${URL}/rest/v1/briefings?date=eq.${date}&select=top3_dedup`, { headers })).json()
if (!score?.inputs?.candidateTitles || !brief?.top3_dedup?.rounds?.[0]) {
  console.error(`${date}: 후보 목록이나 겹침 판정 기록이 없다(채점은 10:19에 돈다)`); process.exit(1)
}
const titles: string[] = score.inputs.candidateTitles
const candidates = titles.map((title, i) => ({ id: String(i), title }))
const start: number[] = brief.top3_dedup.rounds[0].titles.map((t: string) => titles.indexOf(t))
if (start.includes(-1)) { console.error('처음 TOP3 제목이 후보 목록에 없다 — 기록이 어긋남'); process.exit(1) }

console.log(`===== ${date} 시작 [${start}]`)
const { resolveTop3Overlap } = await import('../src/lib/top3Dedup.ts')
const { indices, log } = await resolveTop3Overlap(start, candidates)
log.rounds.forEach((r, i) => console.log(`  ${i + 1}차 겹침 ${JSON.stringify(r.duplicates)} · ${r.reason.slice(0, 70)}`))
log.replaced.forEach(r => console.log(`  교체: 「${r.out.slice(0, 28)}」 → 「${r.in.slice(0, 28)}」`))
if (log.note) console.log('  note:', log.note)
console.log(`  최종 [${indices}]`)
indices.forEach(i => console.log(`   - ${titles[i]}`))
const outs = log.replaced.map(r => r.out)
console.log('  뺀 기사 재진입:', indices.some(i => outs.includes(titles[i])) ? '❌ 있음' : '✅ 없음')
