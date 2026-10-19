// 건강진단(healthCheck)을 지난 날짜의 실제 후보 30건·저장 지표로 다시 만들어 그날 저장값과 나란히 본다. DB에는 아무것도 쓰지 않는다.
// generateMainBriefing(gpt-4o-mini)을 하루 1회 부른다(약 10~20초·1센트 미만). 헤드라인·요약도 같이 나오지만 건강진단만 본다.
//
//   npx tsx scripts/healthcheck_rerun.mts 2026-10-14 2026-10-16 …
//
// 재료: briefing_scores.inputs.candidateTitles(그날 후보 30건) + fetchBriefingPool(그날 발행 시각) + briefings.indicators·health_check
// 쓴 날: 2026-10-19(9/25 감사 R1 = 예시의 건강진단을 113일 내내 베낀 문제 수정 뒤 검증).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY }
const dates = process.argv.slice(2)
if (dates.length === 0) { console.error('날짜를 주세요'); process.exit(1) }

const { fetchBriefingPool } = await import('../src/lib/briefingPool.ts')
const { generateMainBriefing } = await import('../src/lib/generateBriefing.ts')

type HC = { category: string; status: string; summary: string; evidence?: string[] }
const line = (h: HC[]) => h.map(x => `${x.category}:${x.status[0]}`).join(' ')
const combos = new Set<string>()
for (const date of dates) {
  const [score] = await (await fetch(`${URL}/rest/v1/briefing_scores?date=eq.${date}&select=inputs`, { headers })).json()
  const [brief] = await (await fetch(`${URL}/rest/v1/briefings?date=eq.${date}&select=created_at,indicators,health_check`, { headers })).json()
  if (!score?.inputs?.candidateTitles || !brief) { console.log(`===== ${date}: 후보 기록 없음(건너뜀)`); continue }
  const pool = await fetchBriefingPool({ date, cutoff: new Date(brief.created_at) })
  const byTitle = new Map(pool.map(a => [a.title, a]))
  const candidates = (score.inputs.candidateTitles as string[])
    .map(t => byTitle.get(t)).filter((a): a is NonNullable<typeof a> => !!a).map(a => ({ id: a.id, title: a.title }))
  const t0 = Date.now()
  const r = await generateMainBriefing(candidates, brief.indicators ?? [], [], new Map(), { candidates, picked: [] })
  const before: HC[] = brief.health_check ?? []
  combos.add(line(r.healthCheck as HC[]))
  console.log(`\n===== ${date} (후보 ${candidates.length}건 · ${((Date.now() - t0) / 1000).toFixed(0)}초)`)
  console.log(`지표: ${(brief.indicators ?? []).map((i: { name: string; change: string }) => `${i.name} ${i.change}`).join(' · ')}`)
  console.log(`그날 저장: ${line(before)}`)
  console.log(`다시 만듦: ${line(r.healthCheck as HC[])}`)
  for (const h of r.healthCheck as HC[]) console.log(`  ${h.category} ${h.status.padEnd(7)} ${h.summary}${h.evidence?.length ? `\n${''.padEnd(14)}근거: ${h.evidence.join(' / ')}` : ''}`)
}
console.log(`\n다시 만든 ${dates.length}일의 6칸 상태 조합 ${combos.size}가지`)
