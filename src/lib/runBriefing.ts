import { supabaseAdmin as supabase } from './supabaseAdmin'
import { getMarketIndicators } from './marketData'
import {
  generateMainBriefing,
  pickCategoryNews,
  rankKoreanFirst,
  generateCategoryAnalysis,
  generateTop3Analysis,
  groundBriefingText,
  buildTop3AnalysisData,
} from './generateBriefing'
import { fetchArticleBodies, type ArticleBody } from './articleBody'
import { resolveTop3Overlap } from './top3Dedup'
import { selectStoriesWithBody, categoryKeywordExtras } from './selectStories'
import { judgeHealthCheck } from './healthCheck'
import { fetchBriefingPool } from './briefingPool'
import { buildTopicBaseline, gateCandidates, selectCandidatePool } from './candidatePool'
import { notifyIndexNow, briefingUrls } from './indexNow'
import { slugifyTerm } from './terms'

// 후보 30건 만들기(관문·화제 기준선·선별)는 candidatePool.ts에 있다 — 채점기와 공용.

export async function runDailyBriefing({ regenerate = false }: { regenerate?: boolean } = {}) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 하루 한 번만 발행: 오늘 브리핑이 이미 완성돼 있으면 다시 만들지 않고 그대로 둔다.
  // (아침에 두 번 도는 구조에서 나중 실행이 먼저 것을 덮어써 내용이 바뀌던 문제 방지)
  // 수동 재생성(regenerate:true)일 때만 이 잠금을 건너뛴다.
  if (!regenerate) {
    const { data: existing } = await supabase
      .from('briefings')
      .select('headline')
      .eq('date', today)
      .maybeSingle()
    if (existing?.headline) {
      return { date: today, generated: false, skipped: '오늘 브리핑이 이미 있어 재생성하지 않음' }
    }
  }

  // 후보 풀 = 지금 기준 지난 24시간 발행분 + 발행 시각 모르는 오늘 수집분 (2026-08-17, briefingPool.ts 참조).
  // 예전 `date = 오늘`은 랭킹 페이지를 뺀 뒤 아침 풀이 오늘 0~9시 기사만 남아(450→130건) 어제 오후 뉴스가 통째로 빠졌다.
  // 채점 대조 자료(gradeBriefing)도 같은 함수를 쓴다.
  const articles = await fetchBriefingPool({ date: today, cutoff: new Date() })

  if (!articles || articles.length === 0) {
    throw new Error('오늘 수집된 뉴스가 없습니다. 먼저 뉴스 수집이 완료되어야 합니다.')
  }

  // 후보 풀 관문 (candidatePool.ts, 채점기와 공용)
  const { inputs: articleInputs } = gateCandidates(articles)

  const sevenDaysAgo = new Date(Date.now() + 9 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const { data: recentBriefings } = await supabase
    .from('briefings')
    .select('daily_term')
    .gte('date', sevenDaysAgo)
    .lt('date', today)
  const recentTerms = (recentBriefings ?? [])
    .map(b => {
      try {
        const t = typeof b.daily_term === 'string' ? JSON.parse(b.daily_term) : b.daily_term
        return t?.term ?? ''
      } catch { return '' }
    })
    .filter(Boolean) as string[]

  // 화제 급등 정렬의 기준선 = 직전 5일 하루 평균 단어빈도 (2026-09-03 신설).
  // 「코스피」처럼 매일 나오는 배경어와 「예산안」처럼 오늘만 터진 화제를 가르는 분모다.
  // 실패해도 발행은 막지 않는다 — 빈 기준선이면 급등 정렬이 꺼지고 예전 최신순으로 돌아간다.
  const topicBaseline = await buildTopicBaseline(today).catch(err => {
    console.error('[runBriefing] 화제 기준선 계산 실패 → 급등 정렬 없이 진행:', (err as Error).message)
    return new Map<string, number>()
  })

  const indicators = await getMarketIndicators()

  // ── 고르기 (2026-10-19 개편) ──────────────────────────────────────────────────
  // 예전: gpt-4o-mini가 제목 30건만 보고 TOP3를 고르고, 분야 대표도 제목만 보고 골랐다.
  //       → 본문 못 받은 기사가 TOP3에 올라 빈칸 해설(10/13~19 TOP3 20건 중 8건), 낚시·인물 발언·분야 불일치.
  // 지금: 후보 30건(+분야용 20건)의 본문을 먼저 받고, 본문 없는 기사는 후보에서 뺀 뒤
  //       Opus가 제목+본문 앞부분을 보고 TOP3·분야 대표를 한 번에 고른다(selectStories.ts).
  //       실패하면 옛 경로 그대로 — 발행은 안 막힌다.
  // 후보 30건을 뽑는 함수(candidatePool.ts)는 그대로다. 채점기가 같은 30건을 재현해야 하므로 여기는 안 건드린다.
  const { candidates: candidateArticles, picked } = selectCandidatePool(articleInputs, topicBaseline)
  const inTop3Pool = new Set(candidateArticles.map(a => a.id))
  // 분야 대표 후보 = 30건 + 국내 우선 20건(옛 pickCategoryNews가 보던 50건과 같은 범위)
  //                 + 분야 단어가 제목에 있는 기사 분야당 4건(조용한 분야가 비지 않게, selectStories.ts 참조)
  // 분야 대표는 오늘 발행분(date = 오늘)에서만 — 홈 분야 카드가 그 기사만 보여준다(page.tsx). 발행 시각 모르면 수집일 = 오늘
  const publishedToday = new Set(
    articles.filter(a => !a.published_at || new Date(new Date(a.published_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) === today).map(a => a.id)
  )
  const koreanFirst = rankKoreanFirst(articleInputs).filter(a => !inTop3Pool.has(a.id) && publishedToday.has(a.id))
  const categoryExtra = koreanFirst.slice(0, 20)
  categoryExtra.push(...categoryKeywordExtras(koreanFirst, new Set([...inTop3Pool, ...categoryExtra.map(a => a.id)])))
  const urlOf = new Map(articles.map(a => [a.id, a.original_url]))
  const bodies = await fetchArticleBodies(
    [...candidateArticles, ...categoryExtra].map(a => ({ id: a.id, url: urlOf.get(a.id), title: a.title }))
  )
  const withBody = (a: { id: string; title: string }) => ({ ...a, body: bodies.get(a.id), categoryOk: publishedToday.has(a.id) })
  const selection = await selectStoriesWithBody(candidateArticles.map(withBody), categoryExtra.map(withBody))
  if (selection.ok) {
    console.log(`[runBriefing] 본문 기반 고르기 ${selection.log.model} ${selection.log.ms}ms · ` +
      `TOP3 적격 ${selection.log.eligible.top3}/${selection.log.pool.top3} · 제외 ${selection.log.excluded.length}건 · 분야 ${selection.categories.length}/6`)
  } else {
    console.warn(`[runBriefing] 본문 기반 고르기 실패(${selection.log.note}) → 옛 경로(gpt-4o-mini 제목 고르기)`)
  }

  // 건강진단은 고르기가 된 날엔 따로 판단한다(healthCheck.ts, 2026-10-20): 분야 대표 + TOP3 본문과 지표만 보고 6칸.
  // generateMainBriefing의 건강진단은 후보 30건 제목만 봐서 그날 큰 화제 밖의 분야가 「변화 없음」으로 비었다. 실패하면 그것을 그대로 쓴다.
  // TOP3는 겹침 검문 전의 셋이다(교체돼도 근거 기사는 실제 오늘 기사라 그대로 둔다).
  const healthArticles = selection.ok
    ? [
        ...selection.categories.map(c => ({ title: c.title, body: bodies.get(c.id), category: c.category })),
        ...selection.top3Indices.map(i => candidateArticles[i]).filter(a => !!a).map(a => ({ title: a.title, body: bodies.get(a.id) })),
      ]
    : []
  const [briefingResult, health] = await Promise.all([
    generateMainBriefing(articleInputs, indicators, recentTerms, topicBaseline,
      { candidates: candidateArticles, picked, fixedTop3: selection.ok ? selection.top3Indices : undefined }),
    selection.ok ? judgeHealthCheck(healthArticles, indicators) : Promise.resolve(null),
  ])
  if (health?.ok) briefingResult.healthCheck = health.items
  if (health) {
    selection.log.health = health.log
    console.log(`[runBriefing] 건강진단 ${health.ok ? `${health.log.model} ${health.log.ms}ms · 「변화 없음」 ${health.items.filter(h => h.evidence?.length === 0).length}칸` : `실패(${health.log.note}) → gpt 건강진단 그대로`}`)
  }

  // 단어 겹침 검문(enforceTop3Rules)을 통과한 3개를 AI가 한 번 더 본다 — 표현이 달라도 같은 사안이면 교체.
  // 2026-08-23 "한은의 고심, 또 인상?" + "[금통위폴] 8월도 금리 인상?"이 나란히 실린 게 계기. 상세 = top3Dedup.ts
  // 교체분도 본문 받은 기사만 쓴다(2026-10-19). 옛 경로로 왔을 땐 예전처럼 제목 규칙만.
  const { indices: top3Indices, log: top3DedupLog } = await resolveTop3Overlap(
    (briefingResult.top3Indices ?? []).slice(0, 3),
    briefingResult.candidateArticles,
    selection.ok ? { isEligible: idx => !!bodies.get(briefingResult.candidateArticles[idx]?.id ?? '')?.ok } : {}
  )
  top3DedupLog.selection = selection.log
  if (top3DedupLog.replaced.length > 0) {
    console.log(`[runBriefing] TOP3 겹침 교체 ${top3DedupLog.replaced.length}건:`,
      top3DedupLog.replaced.map(r => `"${r.out}" → "${r.in}"`).join(' / '),
      `(사유: ${top3DedupLog.rounds[0]?.reason ?? ''})`)
  } else if (top3DedupLog.note) {
    console.log(`[runBriefing] TOP3 겹침 검문: ${top3DedupLog.note}`)
  }

  const top3Articles = top3Indices
    .map(idx => briefingResult.candidateArticles[idx])
    .filter((a): a is { id: string; title: string } => !!a)

  // 홈 목록용 = 분야별(6개) 대표 기사 1개씩 선정 / TOP3 = 별도 하이라이트
  // 2026-10-06: 해설·브리핑 글을 쓰기 전에 고른 기사의 **원문 본문**을 받는다(articleBody.ts).
  //   예전엔 제목만 보고 써서 원인·주체·숫자를 지어냈다(9/25~10/6 해설 85건 중 32건 사실 오류).
  //   본문 받기가 실패해도 발행은 계속한다 — 그 기사는 「본문 없음」으로 표시돼 AI가 추측하지 않게 한다.
  // 분야 대표: 본문 기반 고르기가 됐으면 그 결과, 아니면 옛 경로(제목만, gpt-4o-mini)
  const categoryPicks = selection.ok
    ? selection.categories
    : await pickCategoryNews(articleInputs).catch(err => {
        console.error('[runBriefing] 분야별 기사 고르기 실패 → 분야별 목록 없이 진행:', (err as Error).message)
        return [] as { id: string; title: string; category: string }[]
      })
  const needBody = [...new Map([...top3Articles, ...categoryPicks].map(a => [a.id, a])).values()]
  // 본문은 위에서 50건을 이미 받았다. 옛 경로가 그 밖의 기사를 골랐을 때만 더 받는다.
  const missingBody = needBody.filter(a => !bodies.has(a.id))
  if (missingBody.length > 0) {
    for (const [id, b] of await fetchArticleBodies(missingBody.map(a => ({ id: a.id, url: urlOf.get(a.id), title: a.title })))) bodies.set(id, b)
  }
  const bodyFetch = {
    ok: needBody.filter(a => bodies.get(a.id)?.ok).length,
    total: needBody.length,
    failed: needBody.filter(a => !bodies.get(a.id)?.ok)
      .map(a => `${a.title.slice(0, 30)} (${bodies.get(a.id)?.reason ?? '안 받음'})`),
  }
  console.log(`[runBriefing] 본문 받기 ${bodyFetch.ok}/${bodyFetch.total}` +
    (bodyFetch.failed.length ? ` · 실패: ${bodyFetch.failed.join(' / ')}` : ''))
  // 기사마다 본문 받기 결과를 full_analysis.body에도 남긴다(2026-10-16).
  // 팜인사이트 기사 해설이 「본문이 없어서」로 나왔는데 실패 이유는 위 console.log에만 있어 30분 뒤 사라졌다.
  // 같은 주소를 로컬·라이브 서버에서 다시 받으면 둘 다 성공 → 그 순간만의 오류인데 종류(시간 초과/접속 오류)를 모른다.
  const bodyRecord = (b: ArticleBody | undefined) =>
    b ? { ok: b.ok, chars: b.text.length, reason: b.reason ?? null } : null

  const top3WithBody = top3Articles.map(a => ({ ...a, body: bodies.get(a.id) }))
  const [categoryNews, top3Analyses, grounded] = await Promise.all([
    generateCategoryAnalysis(categoryPicks.map(a => ({ ...a, body: bodies.get(a.id) }))),
    generateTop3Analysis(top3WithBody),
    groundBriefingText(
      {
        headline: briefingResult.headline,
        summary: briefingResult.summary,
        shareCard: briefingResult.shareCard,
        connections: briefingResult.connections,
      },
      top3WithBody,
      indicators
    ),
  ])
  // 해설을 실제로 쓴 모델별 건수(2026-10-13). OpenAI 쪽 숫자가 보이면 Claude 호출이 실패해 대신 쓴 것
  const explainModel = [...top3Analyses, ...categoryNews].reduce<Record<string, number>>((acc, a) => {
    acc[a.model] = (acc[a.model] ?? 0) + 1
    return acc
  }, {})
  console.log(`[runBriefing] 해설 모델 ${Object.entries(explainModel).map(([m, n]) => `${m} ${n}건`).join(' · ')}`)

  // 본문 대조로 고친 글을 그대로 저장한다(초안은 로그에만)
  if (grounded.changed) {
    console.log(`[runBriefing] 본문 대조로 브리핑 글 수정: "${briefingResult.headline.split('\n')[0]}" → "${grounded.headline.split('\n')[0]}"`)
  }
  briefingResult.headline = grounded.headline
  briefingResult.summary = grounded.summary
  briefingResult.shareCard = grounded.shareCard ?? briefingResult.shareCard
  briefingResult.connections = grounded.connections

  const fullIndicators = indicators.map(ind => ({
    ...ind,
    easyExplanation:
      briefingResult.indicatorExplanations?.find(e => e.name === ind.name)?.easyExplanation ?? '',
  }))

  // TOP3 먼저 저장 → 분야 대표와 겹치는 기사가 있으면 아래에서 category까지 덮어쓰도록 순서 보장
  if (top3Analyses.length > 0) {
    const results = await Promise.all(
      top3Analyses.map(a =>
        supabase.from('news_articles').update({
          full_analysis: {
            oneline: a.oneline,
            whatHappened: a.whatHappened,
            whyHappened: a.whyHappened,
            myImpact: a.myImpact,
            outlook: a.outlook,
            conclusion: a.conclusion,
            // 해설을 실제로 쓴 모델(2026-10-15). 로그는 Vercel 무료 플랜에서 30분만 남아 다음 날 확인할 수 없었다.
            // 화면은 정해진 칸만 읽으므로(news/[id]/page.tsx) 이 칸은 보이지 않는다
            model: a.model,
            body: bodyRecord(bodies.get(a.id)),
          },
        }).eq('id', a.id)
      )
    )
    // 조용한 실패 방지: update 오류를 그냥 넘기지 않고 로그로 드러낸다 (발행 흐름은 막지 않음)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error(`[runBriefing] TOP3 기사 상세(full_analysis) 저장 실패 ${failed.length}/${top3Analyses.length}건:`, failed.map(r => r.error?.message))
    }
  }

  // 분야별 대표 기사: full_analysis에 category 꼬리표 포함 저장 (홈 목록이 이걸로 골라 뿌림)
  if (categoryNews.length > 0) {
    const results = await Promise.all(
      categoryNews.map(a =>
        supabase.from('news_articles').update({
          full_analysis: {
            category: a.category,
            oneline: a.oneline,
            whatHappened: a.whatHappened,
            whyHappened: a.whyHappened,
            myImpact: a.myImpact,
            outlook: a.outlook,
            conclusion: a.conclusion,
            model: a.model,
            body: bodyRecord(bodies.get(a.id)),
          },
        }).eq('id', a.id)
      )
    )
    // 조용한 실패 방지: 분야별 대표 기사 저장 오류도 로그로 드러낸다 (발행 흐름은 막지 않음)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error(`[runBriefing] 분야별 대표 기사(full_analysis) 저장 실패 ${failed.length}/${categoryNews.length}건:`, failed.map(r => r.error?.message))
    }
  }

  const top3AnalysisData = buildTop3AnalysisData(top3Analyses, articleInputs)

  const { error: insertError } = await supabase.from('briefings').upsert({
    date: today,
    summary: briefingResult.summary,
    headline: briefingResult.headline,
    share_card: briefingResult.shareCard ?? null,
    daily_term: JSON.stringify(briefingResult.dailyTerm),
    indicators: fullIndicators,
    top3_analysis: top3AnalysisData,
    health_check: briefingResult.healthCheck,
    connections: briefingResult.connections,
  }, { onConflict: 'date' })

  if (insertError) throw new Error(insertError.message)

  // 겹침 검문 기록 — 나중에 "그날 왜 이렇게 뽑혔나"를 되짚을 때 쓴다(2026-08-23 진단이 47일치 채점 기록 덕에 가능했음).
  // 별도 update인 이유: 컬럼이 없어도 브리핑 발행은 이미 끝나 있어야 한다. 컬럼 추가 = supabase/add_top3_dedup_column.sql
  const { error: dedupLogError } = await supabase
    .from('briefings')
    .update({ top3_dedup: top3DedupLog })
    .eq('date', today)
  if (dedupLogError) {
    console.warn('[runBriefing] TOP3 겹침 검문 기록 저장 건너뜀:', dedupLogError.message)
  }

  // 사전에는 새 용어만 넣는다. 이미 있는 용어는 건드리지 않는다(2026-10-19).
  // 예전엔 upsert가 같은 용어를 그날 AI 문장으로 덮어써서, 사전 정의가 검수 없이 마지막으로 나온 날의
  // 문장으로 계속 바뀌었다(9/25 감사 원인 ③: 기준금리 정의만 8가지 넘게 · 10/6 수동 재생성 때 「투자」 분류가
  // 기업→무역으로 바뀜). 사전 문장을 고치는 건 사람이 정해서 따로 한다.
  if (briefingResult.dailyTerm?.term) {
    const { error: termError } = await supabase.from('terms').upsert(
      {
        term: briefingResult.dailyTerm.term,
        category: briefingResult.dailyTerm.category ?? '기타',
        explanation: briefingResult.dailyTerm.explanation,
      },
      { onConflict: 'term', ignoreDuplicates: true }
    )
    if (termError) console.warn('[runBriefing] 오늘의 단어 사전 저장 건너뜀:', termError.message)
  }

  // 검색엔진(네이버·빙 등)에 "새 페이지 생겼다" 알림. 발행이 끝난 뒤에만 부른다.
  // 실패해도 발행 결과에는 영향을 주지 않는다(부가 기능) — 결과만 응답에 실어 눈으로 볼 수 있게 한다.
  const termSlug = briefingResult.dailyTerm?.term ? slugifyTerm(briefingResult.dailyTerm.term) : null
  const indexNow = await notifyIndexNow(briefingUrls(today, termSlug))
  if (!indexNow.ok) console.error('[runBriefing] IndexNow 알림 실패:', indexNow.status, indexNow.detail)

  return {
    date: today,
    generated: true,
    articlesTotal: articles.length,
    categoryNewsCount: categoryNews.length,
    bodyFetch,
    groundedChanged: grounded.changed,
    explainModel,
    indicatorsCollected: indicators.length,
    headline: briefingResult.headline,
    top3: top3Articles.map(a => a.title),
    dailyTerm: briefingResult.dailyTerm?.term ?? '',
    indexNow,
  }
}
