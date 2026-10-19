// 본문 기반 고르기(selectStories.ts)를 지난 날짜의 실제 후보로 다시 돌려 그날 실제 TOP3와 나란히 본다. DB에는 아무것도 쓰지 않는다.
// Opus를 하루치에 1회 부른다(약 40초·수십 센트). 본문은 지금 받으므로 그날 아침과 조금 다를 수 있다(경향으로만 볼 것).
//
//   npx tsx scripts/select_rerun.mts 2026-10-17 2026-10-18 …      (날짜 여러 개)
//
// 재료: briefing_scores.inputs.candidateTitles(그날 후보 30건) + briefings.top3_analysis(그날 실제 TOP3)
//      + fetchBriefingPool(그날 발행 시각 기준)으로 제목 → 주소를 되찾는다.
// 쓴 날: 2026-10-19(고르기 개편 전 12일 검증, 10/8~10/19).
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
if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY가 없다'); process.exit(1) }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY }
const dates = process.argv.slice(2)
if (dates.length === 0) { console.error('날짜를 주세요. 예: npx tsx scripts/select_rerun.mts 2026-10-17 2026-10-18'); process.exit(1) }

const { fetchBriefingPool } = await import('../src/lib/briefingPool.ts')
const { gateCandidates } = await import('../src/lib/candidatePool.ts')
const { rankKoreanFirst, isClickbait, isUnfitForTop3 } = await import('../src/lib/generateBriefing.ts')
const { fetchArticleBodies } = await import('../src/lib/articleBody.ts')
const { selectStoriesWithBody, categoryKeywordExtras } = await import('../src/lib/selectStories.ts')

for (const date of dates) {
  const [score] = await (await fetch(`${URL}/rest/v1/briefing_scores?date=eq.${date}&select=inputs`, { headers })).json()
  const [brief] = await (await fetch(`${URL}/rest/v1/briefings?date=eq.${date}&select=created_at,top3_analysis`, { headers })).json()
  if (!score?.inputs?.candidateTitles || !brief) { console.log(`===== ${date}: 후보 기록 없음(건너뜀)`); continue }
  const titles: string[] = score.inputs.candidateTitles
  const oldTop3: string[] = (brief.top3_analysis ?? []).map((t: { title: string }) => t.title)

  const cutoff = new Date(brief.created_at)
  const pool = await fetchBriefingPool({ date, cutoff })
  const byTitle = new Map(pool.map(a => [a.title, a]))
  const candidates = titles.map(t => byTitle.get(t)).filter((a): a is NonNullable<typeof a> => !!a)
  const { inputs } = gateCandidates(pool, { now: cutoff.getTime(), tag: 'rerun' })
  const inPool = new Set(candidates.map(a => a.id))
  // runBriefing과 같은 규칙: 분야 대표는 오늘 발행분만
  const publishedToday = new Set(
    pool.filter(a => !a.published_at || new Date(new Date(a.published_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) === date).map(a => a.id)
  )
  const koreanFirst = rankKoreanFirst(inputs).filter(a => !inPool.has(a.id) && publishedToday.has(a.id))
  const extra = koreanFirst.slice(0, 20)
  extra.push(...categoryKeywordExtras(koreanFirst, new Set([...inPool, ...extra.map(a => a.id)])))
  const urlOf = new Map(pool.map(a => [a.id, a.original_url]))

  const t0 = Date.now()
  const bodies = await fetchArticleBodies([...candidates, ...extra].map(a => ({ id: a.id, url: urlOf.get(a.id), title: a.title })))
  const bodyMs = Date.now() - t0
  const withBody = (a: { id: string; title: string }) => ({ id: a.id, title: a.title, body: bodies.get(a.id), categoryOk: publishedToday.has(a.id) })
  const sel = await selectStoriesWithBody(candidates.map(withBody), extra.map(withBody))

  console.log(`\n===== ${date}  후보 ${candidates.length}/${titles.length}건 되찾음 · 본문 ${[...bodies.values()].filter(b => b.ok).length}/${bodies.size} ok(${bodyMs}ms) · 분야용 추가 ${extra.length}`)
  console.log(`  [옛 TOP3]`)
  oldTop3.forEach((t, i) => console.log(`   ${i + 1}. ${t}${isClickbait(t) ? '   ← 낚시 필터에 걸림' : ''}${!bodies.get(byTitle.get(t)?.id ?? '')?.ok ? '   ← 본문 없음' : ''}`))
  if (!sel.ok) { console.log(`  [새 TOP3] 실패: ${sel.log.note}`); continue }
  console.log(`  [새 TOP3]  ${sel.log.model} ${sel.log.ms}ms · 적격 ${sel.log.eligible.top3}/${sel.log.pool.top3}`)
  sel.log.top3.forEach((t, i) => console.log(`   ${i + 1}. ${t.title}\n        └ ${t.why.slice(0, 80)}`))
  const clickbait = titles.filter(t => isClickbait(t))
  const unfit = titles.filter(t => !isClickbait(t) && isUnfitForTop3(t))
  const noBody = sel.log.excluded.filter(e => e.reason.startsWith('본문 없음'))
  console.log(`  [뺀 것] 본문 없음 ${noBody.length} · 낚시 ${clickbait.length} · 시황·해외 ${unfit.length}`)
  clickbait.forEach(t => console.log(`     낚시: ${t}`))
  noBody.slice(0, 6).forEach(e => console.log(`     본문 없음: ${e.title.slice(0, 40)} (${e.reason.replace('본문 없음(', '').replace(/\)$/, '')})`))
  console.log(`  [새 분야 대표] ${sel.categories.length}/6`)
  sel.log.categories.forEach(c => console.log(`   ${c.category.padEnd(3)} ${c.title ? c.title.slice(0, 50) : '(비움)'}  └ ${c.why.slice(0, 50)}`))
}
