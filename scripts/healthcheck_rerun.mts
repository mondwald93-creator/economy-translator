// 건강진단(healthCheck)을 지난 날짜의 실제 재료로 다시 만들어 그날 저장값과 나란히 본다. DB에는 아무것도 쓰지 않는다.
//
//   npx tsx scripts/healthcheck_rerun.mts --cats <고르기 재실행 기록.txt> 2026-10-15 2026-10-20   지금 방식(전용 호출, Opus 하루 1회)
//   npx tsx scripts/healthcheck_rerun.mts --base 2026-10-14 2026-10-16 …                            옛 방식(generateMainBriefing 안에서 gpt-4o-mini, 후보 30건 제목만)
//
// 재료: briefing_scores.inputs.candidateTitles(그날 후보 30건) + fetchBriefingPool(그날 발행 시각) + briefings.indicators·health_check
//       분야 대표·TOP3 = briefings.top3_dedup.selection(10/20부터), 그 전 날짜는 --cats 파일(select_rerun.mts 출력의 [새 TOP3]·[새 분야 대표] 줄)
//       본문은 지금 받으므로 그날 아침과 조금 다를 수 있다(경향으로만 볼 것).
// 센다: 「변화 없음」 칸 · 분야 카드(분야 대표)가 있는데 「변화 없음」인 칸 · 다른 분야의 분야 대표를 근거로 단 칸
// 쓴 날: 2026-10-19(9/25 감사 R1 = 예시의 건강진단을 113일 내내 베낀 문제 수정 뒤 검증).
//        2026-10-20(건강진단을 전용 호출로 떼어냄, healthCheck.ts).
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
// 로컬엔 경번 Claude 키가 없다(Vercel에만). 재실행은 같은 조직의 takt 키를 빌려 쓴다
loadEnv(path.resolve(ROOT, '../takt/.env.local'), ['ANTHROPIC_API_KEY'])
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY }
const args = process.argv.slice(2)
const base = args.includes('--base')
const catsFile = args.includes('--cats') ? args[args.indexOf('--cats') + 1] : null
const dates = args.filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a))
if (dates.length === 0) { console.error('날짜를 주세요'); process.exit(1) }
if (!base && !process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY가 없다'); process.exit(1) }

// --cats 파일: 「===== 날짜」 블록 안의 「   1. 제목」(TOP3)·「   물가  제목  └ 고른 이유」(분야 대표, (비움)은 건너뜀)
type Pick = { category: string; title: string }
const fileSel = new Map<string, { top3: string[]; cats: Pick[] }>()
if (catsFile) {
  let day = ''
  let inTop3 = false
  for (const l of fs.readFileSync(catsFile, 'utf8').split('\n')) {
    const d = l.match(/^===== (\d{4}-\d{2}-\d{2})/)
    if (d) { day = d[1]; fileSel.set(day, { top3: [], cats: [] }); continue }
    if (!day) continue
    if (l.includes('[새 TOP3]')) { inTop3 = true; continue }
    if (/^\s{2}\[/.test(l)) inTop3 = false
    const t = l.match(/^\s{3}\d\. (.+)$/)
    if (inTop3 && t) fileSel.get(day)!.top3.push(t[1].trim())
    const m = l.match(/^\s{3}(물가|소비|수출|고용|부동산|금융)\s+(.+?)\s+└ /)
    if (m && m[2] !== '(비움)') fileSel.get(day)!.cats.push({ category: m[1], title: m[2] })
  }
}

const { fetchBriefingPool } = await import('../src/lib/briefingPool.ts')
const { generateMainBriefing } = await import('../src/lib/generateBriefing.ts')
const { fetchArticleBodies } = await import('../src/lib/articleBody.ts')
const { judgeHealthCheck } = await import('../src/lib/healthCheck.ts')

type HC = { category: string; status: string; summary: string; evidence?: string[] }
const line = (h: HC[]) => h.map(x => `${x.category}:${x.status[0]}`).join(' ')
const combos = new Set<string>()
for (const date of dates) {
  const [score] = await (await fetch(`${URL}/rest/v1/briefing_scores?date=eq.${date}&select=inputs`, { headers })).json()
  const [brief] = await (await fetch(`${URL}/rest/v1/briefings?date=eq.${date}&select=created_at,indicators,health_check,top3_dedup`, { headers })).json()
  if (!score?.inputs?.candidateTitles || !brief) { console.log(`===== ${date}: 후보 기록 없음(건너뜀)`); continue }
  const pool = await fetchBriefingPool({ date, cutoff: new Date(brief.created_at) })
  const byTitle = new Map(pool.map(a => [a.title, a]))
  // 기록 파일 제목은 잘려 있을 수 있어(「…」) 앞 40자로도 찾는다
  const find = (t: string) => byTitle.get(t) ?? pool.find(a => a.title.slice(0, 40) === t.slice(0, 40))
  const sel = brief.top3_dedup?.selection
  const top3Titles: string[] = sel?.top3?.length ? sel.top3.map((x: { title: string }) => x.title) : fileSel.get(date)?.top3 ?? []
  const cats: Pick[] = sel?.categories?.length
    ? sel.categories.filter((c: { title: string | null }) => c.title).map((c: Pick) => ({ category: c.category, title: c.title }))
    : fileSel.get(date)?.cats ?? []
  const cardCats = new Set(cats.map(c => c.category))

  const t0 = Date.now()
  let hc: HC[]
  let note = ''
  if (base) {
    const candidates = (score.inputs.candidateTitles as string[])
      .map(t => byTitle.get(t)).filter((a): a is NonNullable<typeof a> => !!a).map(a => ({ id: a.id, title: a.title }))
    const r = await generateMainBriefing(candidates, brief.indicators ?? [], [], new Map(), { candidates, picked: [] })
    hc = r.healthCheck as HC[]
  } else {
    const wanted = [...cats.map(c => ({ ...c, a: find(c.title) })), ...top3Titles.map(t => ({ category: undefined, title: t, a: find(t) }))]
    const missing = wanted.filter(w => !w.a).map(w => w.title.slice(0, 30))
    const bodies = await fetchArticleBodies(wanted.filter(w => w.a).map(w => ({ id: w.a!.id, url: w.a!.original_url, title: w.a!.title })))
    const articles = wanted.filter(w => w.a).map(w => ({ title: w.a!.title, body: bodies.get(w.a!.id), category: w.category }))
    note = `분야 대표 ${articles.filter(a => a.category).length} · TOP3 ${articles.filter(a => !a.category).length} · 본문 ok ${articles.filter(a => a.body?.ok).length}/${articles.length}` +
      (missing.length ? ` · 못 찾음 ${missing.join(' / ')}` : '')
    const r = await judgeHealthCheck(articles, brief.indicators ?? [])
    if (!r.ok) { console.log(`\n===== ${date}: 실패 ${r.log.note}`); continue }
    hc = r.items as HC[]
  }
  combos.add(line(hc))
  const quiet = hc.filter(h => h.summary.includes('뚜렷한 변화'))
  const catTitle = new Map(cats.map(c => [c.title.slice(0, 40), c.category]))
  const crossed = hc.filter(h => (h.evidence ?? []).some(e => { const c = catTitle.get(e.slice(0, 40)); return c && c !== h.category }))
  console.log(`\n===== ${date} (${base ? '옛 방식' : '전용 호출'} · ${((Date.now() - t0) / 1000).toFixed(0)}초${note ? ` · ${note}` : ''})`)
  console.log(`「변화 없음」 ${quiet.length}칸 · 카드 있는데 「변화 없음」 ${quiet.filter(h => cardCats.has(h.category)).length}칸(카드 ${cardCats.size}개) · 다른 분야 대표를 근거로 단 칸 ${crossed.length}`)
  console.log(`지표: ${(brief.indicators ?? []).map((i: { name: string; change: string }) => `${i.name} ${i.change}`).join(' · ')}`)
  console.log(`그날 저장: ${line(brief.health_check ?? [])}`)
  console.log(`다시 만듦: ${line(hc)}`)
  for (const h of hc) console.log(`  ${h.category} ${h.status.padEnd(7)} ${h.summary}${h.evidence?.length ? `\n${''.padEnd(14)}근거: ${h.evidence.join(' / ')}` : ''}`)
}
console.log(`\n다시 만든 ${dates.length}일의 6칸 상태 조합 ${combos.size}가지`)
