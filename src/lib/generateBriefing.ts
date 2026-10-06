import { openai, SYSTEM_PROMPT } from './openai'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem, ArticleFullAnalysis } from '@/types'
import { titleTokenSet, isNearDuplicate } from './titleSimilarity'
import { selectCandidatePool } from './candidatePool'
import { indicatorLine } from './marketData'
import type { ArticleBody } from './articleBody'

// ── B안: AI가 고른 TOP3를 코드가 한 번 더 검문 ──────────────────────────────
// 프롬프트(A안)만으로는 "같은 기업·통계를 다른 각도로 쓴 기사"나 "환율·지수 시황"을
// AI가 100% 걸러내지 못함을 라이브에서 확인(2026-07-01: KB금융 2건 + 환율 1,550원 시황).
// 그래서 AI 선정 결과를 코드가 재검사해 규칙 위반이면 다른 후보로 자동 교체한다.

const FOREIGN_KEYWORDS_TOP3 = ['미국', '美', '연준', 'Fed', '중국', '中 ', '일본', '日 ', '유럽', '월가', '나스닥', '다우', 'S&P', '뉴욕증시', 'ECB', '엔저', '엔화', '위안화']

// 대괄호 코너 이름표 = TOP3 부적합. [마켓 브리핑]·[뉴욕환시]·[Who is ?] 같은 것.
// 초보자용 5분 브리핑에 실릴 성격이 아닌 시황·나열·연재 코너를 여기서 거른다.
//
// ⚠️ 닫는 ]를 요구하지 않는다 (2026-08-31 변경, 60일 실측 근거).
//    TOP3 제목의 26.7%가 잘린 채 저장되는데(수집 단계 별건, 미착수),
//    닫는 괄호까지 요구하면 잘린 코너 기사가 통째로 그물을 빠져나갔다.
//    실제로 8/24·8/14에 실린 「[코스피·코스닥, 삼성전자 두산에너빌리티 …」가 그 경로였다.
//    이 변경으로 후보 풀 11,766건 중 19건이 추가로 걸리고, 전부 시황·나열형이다(오탐 0).
//
// ⚠️ 단어를 넓게 잡지 말 것. 아래는 뺀 단어와 이유다.
//    · '리스트'  → [더벨][카카오 리스트럭처링] 같은 멀쩡한 기획이 걸린다
//    · '코스피'·'코스닥' 단독 → [코스피 1만의 조건]·[코스닥 상폐 딜레마㊤]·[롤러코스피 대책]이 걸린다
//      그래서 가운뎃점으로 이어진 '코스피·코스닥' 형태만 잡는다
//    · '모닝' 단독 → [굿모닝경제]·[코인 모닝콜]이 걸려 '모닝 리포트'로 좁혔다
//    새 코너명이 나오면 또 뚫린다. 매주 회고에서 TOP3를 훑어 여기에 더한다.
const TOP3_TAG_WORDS =
  /\[[^\]]*(마켓|증시|시황|머니플로우|글로벌|브리핑|오늘의|코스피·코스닥|환시|외환|모닝 리포트|어제장|순매수|톱뉴스|공시|ETF워치|[Ww]ho\s+[Ii]s)/

// 단순 지수·환율 시황 / 시세 전망 / 시황 모음 태그 / 사설·칼럼 = TOP3 부적합
function isSituationNews(title: string): boolean {
  if (TOP3_TAG_WORDS.test(title)) return true
  // 코스피·코스닥·환율·지수·통화의 단순 등락/시세 전망 (엔저·위안화 등 해외 FX 시황 포함)
  if (/(코스피|코스닥|환율|원\/?달러|원달러|증시|지수|엔저|엔화|위안화|원화|달러화)/.test(title) &&
      /(출발|마감|전망|돌파|폭등|급락|급등|강세|약세|반등|출렁|치솟|미끄러|하락세|상승세|방어선|개입|어디까지)/.test(title)) return true
  // 신문 사설·칼럼·오피니언·데스크칼럼·논평/기고(뉴스가 아닌 의견글). [thebell note] 등 note 칼럼 포함
  if (/사설|칼럼|오피니언|데스크|기고|논평|시론|톺아|\bnote\b/i.test(title)) return true
  return false
}

// 해외 단독 뉴스(한국 각도 아님) 판별 — 한국·국내·정부 등이 안 걸리는 순수 외신
function isForeignOnly(title: string): boolean {
  if (!FOREIGN_KEYWORDS_TOP3.some(k => title.includes(k))) return false
  return !/한국|국내|한은|한국은행|코스피|코스닥|정부|기재부|우리|국채/.test(title)
}

// export 이유: 교체 후보를 고르는 top3Dedup.ts가 같은 잣대를 써야 한다(시황·해외 기사가 교체분으로 들어오면 안 됨)
export function isUnfitForTop3(title: string): boolean {
  return isSituationNews(title) || isForeignOnly(title)
}

// AI가 준 top3 인덱스를 검문·교정해 항상 3개(중복·시황 없는) 인덱스를 돌려준다.
export function enforceTop3Rules(
  aiIndices: number[],
  candidates: { id: string; title: string }[]
): number[] {
  // 최종 3개끼리는 좁은 집합이라 후보풀(0.5)보다 엄격히 본다 — '같은 기업 다른 각도'(겹침 0.375)까지 잡되,
  // 넓은 후보풀 임계(0.5)는 그대로 둬 오판 위험은 키우지 않는다.
  const FINAL_DUP_THRESHOLD = 0.35
  const chosen: number[] = []
  const chosenTokens: Set<string>[] = []

  const tryAccept = (idx: number): boolean => {
    const art = candidates[idx]
    if (!art || chosen.includes(idx)) return false
    if (isUnfitForTop3(art.title)) return false
    const tokens = titleTokenSet(art.title)
    if (isNearDuplicate(tokens, chosenTokens, FINAL_DUP_THRESHOLD)) return false
    chosen.push(idx)
    chosenTokens.push(tokens)
    return true
  }

  // 1) AI가 고른 순서대로, 규칙 통과분만 채택
  for (const idx of aiIndices) {
    if (chosen.length >= 3) break
    tryAccept(idx)
  }
  // 2) 빈자리는 후보 목록(한국 우선·중복 제거된) 앞에서부터 규칙 통과분으로 채움
  for (let idx = 0; idx < candidates.length && chosen.length < 3; idx++) {
    tryAccept(idx)
  }
  // 3) 그래도 3개가 안 되면(후보 부족·전부 시황인 극단적 날) AI 원안으로 빈자리만 메워 항상 3개 반환(빈 브리핑 방지)
  for (const idx of aiIndices) {
    if (chosen.length >= 3) break
    if (candidates[idx] && !chosen.includes(idx)) chosen.push(idx)
  }
  return chosen.slice(0, 3)
}
// ────────────────────────────────────────────────────────────────────────────

interface BriefingAIResult {
  headline: string
  summary: string
  shareCard: string
  dailyTerm: { term: string; category: string; explanation: string }
  indicatorExplanations: { name: string; easyExplanation: string }[]
  top3Indices: number[]
  healthCheck: HealthCheckItem[]
  connections: ConnectionItem[]
}

export interface BriefingResult extends BriefingAIResult {
  candidateArticles: { id: string; title: string }[]
}

// shareCard 40자 초과 방지(형식 채점 기준=40자 이내). 메인 브리핑·본문 대조 둘 다 쓴다.
// '—'/',' 앞 절만으로 완결되면 그 절만 남기고(문장이 안 끊김), 아니면 40자 이내 단어 경계에서 자른다.
export function trimShareCard(raw: string): string {
  let sc = raw.trim()
  if (sc.length > 40) {
    const m = sc.match(/^(.{15,40}?)(?:\s—\s|,\s)/)
    if (m) {
      sc = m[1].trim()
    } else {
      const sp = sc.lastIndexOf(' ', 40)
      sc = (sp > 20 ? sc.slice(0, sp) : sc.slice(0, 40)).trim()
    }
  }
  return sc
}

// B1 + B3 + B4: 메인 브리핑 생성 (헤드라인, TOP3 선정, 건강진단, 연결관계 포함)
export async function generateMainBriefing(
  articles: { id: string; title: string }[],
  indicators: Omit<KeyIndicator, 'easyExplanation'>[],
  recentTerms: string[] = [],
  // 직전 며칠간의 하루 평균 단어빈도. 「평소보다 몇 배 튀었나」의 분모다.
  // 비어 있으면(과거 조회 실패 등) 급등 정렬이 저절로 꺼지고 예전 최신순 동작으로 돌아간다.
  topicBaseline: Map<string, number> = new Map()
): Promise<BriefingResult> {
  const indicatorList = indicators.length > 0
    ? indicators.map(indicatorLine).join('\n')
    : '- 지표 데이터를 가져오지 못했습니다'

  // 후보 30건 = 국내 우선 + 화제 급등 순 + 중복 제거 + 화제 상한.
  // 로직은 candidatePool.ts에 있다 — 채점기(gradeBriefing)가 같은 함수를 써서 같은 30건을
  // 재현한다. 예전엔 채점기가 이 블록을 복사해 갖고 있다가 9/3 수정을 놓쳐 어긋났다(2026-09-07).
  const { candidates: candidateArticles, picked } = selectCandidatePool(articles, topicBaseline)
  const titleList = candidateArticles.map((a, i) => `${i}. ${a.title}`).join('\n')

  // 관측 장치(규칙 14-6): 무엇이 왜 앞자리에 왔는지 발행 로그에 남긴다.
  // 편향이 재발하면 "그날 1위 화제가 뭐였나"를 로그만 보고 되짚을 수 있다.
  const topicSummary = picked.slice(0, 5)
    .map(r => `${r.topic || '무화제'}×${r.score.toFixed(1)}`)
    .join(' · ')
  console.log(`[generateMainBriefing] 후보 ${articles.length}건 → 30건 선별. ` +
    `기준선 단어 ${topicBaseline.size}개${topicBaseline.size === 0 ? ' ⚠️급등 정렬 꺼짐(최신순 동작)' : ''}. ` +
    `상위 화제: ${topicSummary}`)
  const avoidTerms = recentTerms.length > 0
    ? ` (최근 7일간 이미 다룬 용어는 피하세요: ${recentTerms.join(', ')})`
    : ''

  const prompt = `당신은 한국 경제 전문 브리핑 서비스입니다. 오늘의 한국 경제 뉴스를 바탕으로 다음 내용을 JSON으로 생성해주세요.

## 주요 지표 (직전 거래일 마감 기준 — 오늘 장은 아직 시작 전)
${indicatorList}

## 오늘의 주요 뉴스 (인덱스. 제목)
${titleList}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "headline": "오늘 가장 큰 구체적 경제 이슈 한 줄\\n그 영향 한 줄 (두 줄을 \\n으로 구분, 구어체 ~했어요 형식. 첫 줄은 반드시 18자 이내 짧게. 아래 '이슈 범위'에서 그날 가장 큰 것을 고르고 단순 지수·환율 시황은 쓰지 마세요. 형식 예시일 뿐 내용은 따라하지 말 것: '정부, 전기요금 동결했어요\\n물가 부담을 덜어주려는 거예요' / '주요 기업들이 하반기 채용 늘려요\\n일자리에 숨통이 트일 전망이에요')",
  "summary": "오늘 경제 전체를 초보자 언어로 정리한 요약 글. 반드시 3~5개 문단으로 나누고, 각 문단 사이는 빈 줄(\\n\\n)로 구분하세요 (한 덩어리로 쓰지 말 것)",
  "shareCard": "경제를 전혀 모르는 친구에게 카카오톡으로 보내는 오늘의 한 줄 (공백 포함 반드시 40자 이내로 짧게, 숫자보다 의미 중심, headline과 다른 내용. 말끝은 headline과 같은 '~어요/~예요'로 쓰세요. '~대요/~래요/~거든요'처럼 남에게 전해 들은 말투는 쓰지 마세요 — 직접 읽고 옮겨 주는 서비스라 목소리가 갈립니다. '거래/건데/란다' 같은 줄임말도 쓰지 마세요('거래'는 去來로 읽힙니다). 형식 예시일 뿐 내용은 따라하지 말 것: '외국인이 돌아오면서 증시가 살아났어요' / '기름값이 올라 장바구니 물가가 걱정이에요')",
  "dailyTerm": {
    "term": "오늘 뉴스와 관련 있는 경제 용어 1개${avoidTerms}",
    "category": "금리|환율|주식|부동산|무역|경기|소비|통화 중 하나",
    "explanation": "그 용어를 초등학생도 이해할 수 있게 2~3문장으로 설명"
  },
  "indicatorExplanations": [
    { "name": "코스피", "easyExplanation": "직전 거래일 마감 수치를 바탕으로 초보자에게 1~2문장 설명" },
    { "name": "환율(원/달러)", "easyExplanation": "직전 거래일 마감 수치를 바탕으로 초보자에게 1~2문장 설명" },
    { "name": "코스닥", "easyExplanation": "직전 거래일 마감 수치를 바탕으로 초보자에게 1~2문장 설명" }
  ],
  "top3Indices": [0, 1, 2],
  "healthCheck": [
    { "category": "물가", "status": "warning", "summary": "밥값·전기료 등 생활물가가 계속 오르고 있어요" },
    { "category": "소비", "status": "normal", "summary": "..." },
    { "category": "수출", "status": "good", "summary": "..." },
    { "category": "고용", "status": "normal", "summary": "..." },
    { "category": "부동산", "status": "normal", "summary": "..." },
    { "category": "금융", "status": "warning", "summary": "..." }
  ],
  "connections": [
    { "from": "원인 키워드", "to": "결과 키워드" },
    { "from": "결과 키워드", "to": "파생 결과 키워드" }
  ]
}

규칙:
- 지표 수치(코스피·환율·코스닥)는 **직전 거래일 마감 기준**입니다. 브리핑은 장 시작 전에 만들어지므로 "오늘 올랐어요/떨어졌어요"처럼 당일 장중 움직임으로 단정하지 마세요. "지난 거래일 코스피는 …로 마감했어요"처럼 마감 기준임이 드러나게 쓰세요. (단, 뉴스 내용 자체는 오늘 자이므로 뉴스를 가리킬 때는 '오늘'로 써도 됩니다)
- 이 서비스는 한국 경제 전문입니다. 헤드라인·TOP3·healthCheck 모두 한국 경제 상황을 중심으로 작성하세요
- 미국·중국 등 해외 뉴스는 한국 경제에 직접 영향을 줄 때만 언급하고, 단독 TOP3로 선정하지 마세요
- status는 반드시 "good", "normal", "warning" 중 하나
- healthCheck는 반드시 6개 (물가·소비·수출·고용·부동산·금융 순서)
- top3Indices는 위 뉴스 목록의 앞 숫자(인덱스)를 3개 선정. 예: 0번 기사 선택 시 0. 미국·중국·일본·유럽 등 해외 경제 뉴스는 절대 TOP3에 넣지 마세요. 한국 기업·증시·부동산·정책·소비·고용 관련 기사를 우선하세요
- ⭐TOP3 세 기사는 반드시 서로 다른 사건이어야 합니다. 같은 사건을 여러 언론사가 제목만 바꿔 쓴 기사(내용이 사실상 같은 것)를 2개 이상 넣지 마세요. 같은 사건이면 그중 하나만 고르고, 남는 자리는 다른 주제·다른 분야의 뉴스로 채우세요. ⭐'같은 사건'은 제목 표현이 같은 것뿐 아니라, 같은 통계·같은 기업·같은 정책을 서로 다른 각도(통계 수치 vs 현장 반응 등)로 다룬 기사까지 포함합니다. TOP3 3개는 서로 다른 '주제'여야 합니다 — 예: 하나가 한계기업이면 나머지 둘은 부동산·고용·생활물가 등 다른 주제에서 고르세요. ⭐단, 빈자리를 다른 주제로 채울 때도 해외 단독 뉴스·단순 지수 시황·시세 전망 기사는 넣지 마세요. 적합한 한국 단독 이슈가 부족하면 억지로 시황·해외로 채우지 말고 생활물가·정책·기업·고용·부동산 쪽 한국 기사에서 고르세요
- ⭐헤드라인과 TOP3는 아래 "이슈 범위" 안에서 그날 가장 큰 이슈를 고르세요. 판단 질문: "오늘 한국에서 보통 사람이 가장 알아야 하고 체감할 경제 뉴스 한 가지는?" 이 질문에 답할 때 다음을 함께 저울질하되 어느 하나가 항상 이기지 않게 종합 판단하세요 — 파급(영향받는 사람 수)·체감(내 지갑·일상에 닿는 정도)·사건성(오늘 새로 터진 일인가)·규모(변화의 크기). 큰 사건이 터진 날은 사건성이, 잔잔한 날은 생활 밀접 뉴스가 1위가 되는 게 정상입니다. 특정 분야를 편애하지 말고 분야 불문 그날 가장 중요한 것을 선택하세요.
  [이슈 범위] ① 기업·산업(실적·투자·M&A·신제품·구조조정, 반도체·자동차·배터리·바이오·플랫폼 등) ② 정책·국가사업(정부·국회 경제정책, 지원금·세제·예산, 청년·소상공인 사업, 부동산·금리 대책) ③ 생활·물가(장바구니 물가, 전기·가스·교통요금, 외식·식품, 대출이자) ④ 부동산·주거(집값·전월세·청약·대출규제) ⑤ 고용·일자리(채용·취업·임금·자영업) ⑥ 금융·자산(금리 결정·가계부채·새 금융상품/규제 같은 구조적 이슈) ⑦ 대외(미국 금리·관세·환율 등은 한국에 직접 영향 줄 때만, 한국 영향 각도로)
  [제외] 단순 지수 시황("코스피·환율이 몇 % 올랐다/내렸다"), 환율·시세 전망("환율 ○원 출발/마감 전망"·"코스닥 ○% 폭등/급락" 류), "[마켓 브리핑]"·"[오늘의 증시]"·"신문 사설" 같은 모음·시황 기사, 단순 속보, 해외 단독 뉴스. ⭐이 제외 규칙은 헤드라인뿐 아니라 TOP3 선정에도 똑같이 적용됩니다. 지수·환율 수치는 이미 지표 박스로 보여주므로 헤드라인에서 또 다루지 마세요
- connections는 오늘 한국 경제에서 가장 핵심적인 흐름 3~5개 (짧은 키워드로)`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const parsed = JSON.parse(res.choices[0].message.content ?? '{}') as BriefingAIResult
  // B안: AI가 고른 TOP3를 코드가 재검문 — 같은 사건·시황·해외면 다른 후보로 자동 교체
  parsed.top3Indices = enforceTop3Rules(parsed.top3Indices ?? [], candidateArticles)
  // shareCard 40자 초과 방지(형식 채점 기준=40자 이내). 프롬프트로도 유도하되, 넘치면 코드가 마지막 안전망으로 자른다.
  // '—'/',' 앞 절만으로 완결되면 그 절만 남기고(문장이 안 끊김), 아니면 40자 이내 단어 경계에서 자른다.
  if (parsed.shareCard) parsed.shareCard = trimShareCard(parsed.shareCard)
  return { ...parsed, candidateArticles }
}

// B2: 기사별 간단 요약 (뉴스 카드용, 2~3문장)
export async function generateArticleSummaries(
  articles: { id: string; title: string }[]
): Promise<{ id: string; summary: string }[]> {
  if (articles.length === 0) return []

  const articleList = articles.map(a => `{"id":"${a.id}","title":"${a.title}"}`).join('\n')

  const prompt = `다음 경제 뉴스 기사 제목들을 경제를 전혀 모르는 초보자가 이해할 수 있게 각각 2~3문장으로 설명해주세요.

기사 목록:
${articleList}

다음 JSON 형식으로만 응답하세요:
{"articles": [{"id": "기사id", "summary": "초보자용 2~3문장 설명"}]}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  }, { timeout: 100_000 }) // 요약은 건수가 많아 출력이 길다 — 기본 60초로는 정상 응답도 끊길 수 있음

  const parsed = JSON.parse(res.choices[0].message.content ?? '{"articles":[]}')
  return (parsed.articles ?? []) as { id: string; summary: string }[]
}

// ─────────────────────────────────────────────────────────────────────────
// B2: 기사 6단계 해설 — 2026-10-06 개편: 제목만 → **본문을 함께 넣는다**
//
// 왜: 예전엔 AI에게 제목만 주고 「왜 생겼나·나에게 영향·전망」을 쓰게 했다. 본문이 없으니
//     AI가 원인·주체·숫자를 지어냈다(9/25~10/6 해설 85건 중 32건 사실 오류. 샤인머스캣 → 「귀족새우」,
//     한국서부발전 → 「사우디 기업」, 1~9월 누적 수출 → 「연간 1조 달러 돌파」 등).
//     기록 = 전직로드맵/_작업기록/자리비움점검_2026-10-06.md 5-2절. 본문 받기 = articleBody.ts
// 바뀐 점: ① 본문 2,500자까지 같이 넣음 ② 「본문에 있는 사실만」 규칙 ③ temperature 0.7 → 0.3
//          ④ 분야별 대표 기사는 「고르기」와 「해설 쓰기」를 두 번으로 나눔(고른 뒤에야 본문을 받을 수 있어서)
// ─────────────────────────────────────────────────────────────────────────
// 본문 대조 해설·브리핑 글 고치기에 쓰는 모델. 시험용으로 환경변수로 바꿀 수 있게 둔다(기본값은 아래).
// gpt-5·o 계열은 temperature를 받지 않으므로 그때는 빼고 보낸다.
const GROUNDED_MODEL = process.env.GROUNDED_MODEL || 'gpt-5.4-mini'  // 2026-10-06 18건 비교: 4o-mini·4.1-mini보다 사실·문체 모두 우세
function samplingFor(model: string, temperature: number): { temperature?: number } {
  return /^(gpt-5|o\d)/.test(model) ? {} : { temperature }
}

export interface ArticleWithBody {
  id: string
  title: string
  body?: ArticleBody
}

const GROUNDING_RULES = `⭐가장 중요한 규칙 — [본문]에 있는 사실만 씁니다. 이 서비스는 기사를 직접 읽고 옮겨 주는 서비스입니다.
- whyHappened(원인)는 본문이 밝힌 원인만 쓰세요. 본문에 원인이 없으면 "기사에서 원인을 따로 밝히지는 않았어요."라고 쓰고, 그럴듯한 원인을 지어내지 마세요.
- 누가 했는지(사람·기관·회사)는 본문에 나온 그대로 쓰세요. 주어를 바꾸지 마세요(예: A사가 B사와 손잡고 C를 지원하면, B사가 지원한다고 쓰지 말 것). 직함도 본문 표현을 따르세요.
- 숫자는 본문에 있는 숫자만, 본문이 붙인 조건·기간·단위와 함께 쓰세요. 누적치·전망치·가정 계산을 확정된 결과처럼 쓰지 마세요(예: 1~9월 누적을 연간이라고 쓰지 말 것, 시뮬레이션 수치를 실제 상승률로 쓰지 말 것).
- 전망·예정·관측·계획·가능성 기사는 아직 일어나지 않은 일로 쓰세요("~할 예정이에요", "~라는 전망이 나왔어요").
- 오름·내림, 늘어남·줄어듦, 인상·인하의 방향을 본문과 다르게 쓰지 마세요. 「~할 가능성이 낮아졌다」를 「높아졌다」로 바꾸지 마세요.
- myImpact·outlook도 본문에서 이어지는 범위에서만 쓰세요. 해외에서 일어나는 일(예: 미국 안에 짓는 발전소)을 국내 요금·가격에 바로 연결하지 마세요.
- 원인을 「~때문인 것으로 보여요」, 「~것 같아요」처럼 추측으로 덧붙이지 마세요. 본문이 밝힌 것만 단정해서 쓰고, 나머지는 쓰지 않습니다.
- outlook에 본문에 없는 의견·권고(예: "정부의 지원이 필요해요", "주의가 필요해요")를 덧붙이지 마세요. 본문에 전망이 없으면 "기사에서 따로 전망을 밝히지는 않았어요."라고 쓰세요.
- 특정 투자를 권하는 말("투자해볼 수 있어요", "사볼 만해요")은 쓰지 마세요.
- [본문]이 "(본문 없음)"이거나 아주 짧으면, 제목과 주어진 문장에 있는 사실만 쓰고 원인·영향·전망은 추측하지 말고 "기사에서 따로 밝히지는 않았어요."라고 쓰세요.`

const SPEECH_RULES = `【말투】 사이트 전체가 존댓말이라 여기도 존댓말로 씁니다. 말끝은 '~어요/~예요'로 쓰세요.
  ⚠️ '~야/~어/~지/~거야'처럼 반말로 끝내지 마세요.
  ⚠️ '~대요/~래요'처럼 전해 들은 말투도 쓰지 마세요. 직접 읽고 옮겨 주는 서비스라 목소리가 갈립니다.
  ⚠️ '~습니다/~입니다' 같은 합쇼체도 섞지 마세요.
  ⚠️ '제/저는' 같은 글쓴이 1인칭을 쓰지 마세요. 독자 입장은 '내 생활', '우리 집'처럼 쓰세요(예: '제 개인 생활에' ✗ → '내 생활에' ○).
  (oneline·conclusion은 짧은 명사구라 어미가 없어도 됩니다. 단 '올랐다'처럼 반말 어미로 끝내지는 마세요)`

function bodyBlock(a: ArticleWithBody): string {
  const b = a.body
  if (!b || !b.text) return '(본문 없음)'
  return b.ok ? b.text : `(본문을 다 받지 못해 리드 문단만 있음) ${b.text}`
}

/** 본문을 함께 넣어 6단계 해설을 만든다. 결과의 순서·id는 코드가 인덱스로 복원한다(AI가 쓴 식별자를 믿지 않음). */
async function analyzeWithBody(articles: ArticleWithBody[]): Promise<(ArticleFullAnalysis & { id: string })[]> {
  if (articles.length === 0) return []
  // ⚠️ AI에게 UUID를 되받아 쓰게 하면 가끔 글자를 빠뜨려 기사 매칭이 깨짐(2026-07-08 TOP3 빈 제목 사고) → 인덱스 방식 유지
  const articleList = articles
    .map((a, i) => `### 기사 ${i}\n[제목] ${a.title}\n[본문] ${bodyBlock(a)}`)
    .join('\n\n')

  const prompt = `다음 경제 뉴스 기사들을 경제 과외 선생님처럼 6단계로 설명해주세요. 기사마다 [제목]과 [본문]이 있습니다.

${articleList}

${GROUNDING_RULES}

${SPEECH_RULES}

각 기사에 대해 아래 6단계로 설명하세요:
- oneline: 이 기사를 한 마디로 (15자 이내)
- whatHappened: 무슨 일인가요? (초보자 언어로 2~3문장, 본문 사실만)
- whyHappened: 왜 이런 일이 생겼나요? (본문이 밝힌 원인 2~3문장. 없으면 위 규칙대로)
- myImpact: 나에게 어떤 영향이 있나요? (실생활 연결 2~3문장, 본문에서 이어지는 범위만)
- outlook: 앞으로 어떻게 될까요? (본문에 나온 전망·예정 1~2문장)
- conclusion: 한 줄 결론 (10자 이내 핵심 메시지)

다음 JSON 형식으로만 응답하세요:
{
  "articles": [
    {
      "index": 위 기사 번호(숫자),
      "oneline": "한 마디 요약",
      "whatHappened": "무슨 일 설명",
      "whyHappened": "원인 설명",
      "myImpact": "내 생활 영향",
      "outlook": "앞으로 전망",
      "conclusion": "한 줄 결론"
    }
  ]
}`

  const res = await openai.chat.completions.create({
    model: GROUNDED_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    ...samplingFor(GROUNDED_MODEL, 0.3),
  }, { timeout: 100_000 }) // 본문이 들어가 입력이 길다 — 기본 60초로는 정상 응답도 끊길 수 있음

  const parsed = JSON.parse(res.choices[0].message.content ?? '{"articles":[]}')
  const rows = (parsed.articles ?? []) as Array<{ index: number } & ArticleFullAnalysis>
  const result: (ArticleFullAnalysis & { id: string })[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const art = articles[r.index]
    if (!art || seen.has(art.id)) continue
    seen.add(art.id)
    result.push({
      id: art.id,
      oneline: r.oneline,
      whatHappened: r.whatHappened,
      whyHappened: r.whyHappened,
      myImpact: r.myImpact,
      outlook: r.outlook,
      conclusion: r.conclusion,
    })
  }
  return result
}

// TOP3 하이라이트 해설 (본문 포함)
export async function generateTop3Analysis(
  articles: ArticleWithBody[]
): Promise<(ArticleFullAnalysis & { id: string })[]> {
  return analyzeWithBody(articles)
}

// B5: 분야별(6개) 대표 기사 1개씩 선정 + 6단계 분석 (홈 뉴스 목록용)
// 기존 "오늘 기사 전부를 한 번에 요약"(generateArticleSummaries)이 기사 1,000건+에서
// 출력 길이 한도에 막혀 ~80건만 처리되던 문제를 대체. 보여줄 기사만 선별·분석한다.
// 2026-10-06: 「고르기」(pickCategoryNews, 제목만)와 「해설 쓰기」(generateCategoryAnalysis, 본문 포함)로 나눔.
export const NEWS_CATEGORIES = ['물가', '소비', '수출', '고용', '부동산', '금융'] as const

export interface CategoryNewsItem extends ArticleFullAnalysis {
  id: string
  category: string
}

export async function pickCategoryNews(
  articles: { id: string; title: string }[]
): Promise<{ id: string; title: string; category: string }[]> {
  if (articles.length === 0) return []

  // 한국 경제 기사 우선 정렬 후 후보 50개로 압축 (분야 커버리지 확보 + 출력 길이 안전)
  const foreignKeywords = ['미국', '미 ', '美 ', '美국', '연준', 'Fed ', '중국', '中 ', '일본', '日 ', '유럽', '월가', '나스닥', '다우', 'S&P', '뉴욕증시']
  const koreanFirst = [...articles].sort((a, b) => {
    const aForeign = foreignKeywords.some(k => a.title.includes(k)) ? 1 : 0
    const bForeign = foreignKeywords.some(k => b.title.includes(k)) ? 1 : 0
    return aForeign - bForeign
  })
  const candidates = koreanFirst.slice(0, 50)
  const titleList = candidates.map((a, i) => `${i}. ${a.title}`).join('\n')

  const prompt = `다음은 오늘 수집된 한국 경제 뉴스입니다. 아래 6개 분야 각각에 대해 "오늘 가장 중요하거나 이슈가 된 대표 기사" 1개씩을 골라주세요. (해설은 따로 씁니다. 여기서는 고르기만 합니다)

분야: 물가, 소비, 수출, 고용, 부동산, 금융

## 오늘의 뉴스 (인덱스. 제목)
${titleList}

규칙:
- 6개 분야를 가능한 한 모두 채우세요. 정말 어울리는 기사가 단 하나도 없는 분야만 생략하되, 어떤 경우에도 최소 4개 분야는 반드시 채워야 합니다. (특정 분야에 딱 맞는 기사가 없으면, 그 분야와 가장 관련 있는 한국 경제 기사를 골라 넣으세요. 단 아래 해외 단독 뉴스 제외 규칙은 지키세요.)
- 같은 사건·주제를 여러 분야에 중복 선정하지 마세요. 한 사건(예: 특정 통계 발표·특정 기업 이슈·특정 정책)이 여러 분야에 걸쳐 보여도, 가장 잘 맞는 분야 1곳에만 싣고 나머지 분야는 그 분야의 다른 사건을 고르세요. 같은 통계·같은 기업·같은 정책을 다른 각도로 다룬 기사도 '같은 사건'으로 봅니다.
- 미국·중국 등 해외 단독 뉴스는 고르지 마세요. 한국 경제 중심으로.

다음 JSON 형식으로만 응답하세요:
{
  "categories": [
    { "category": "물가|소비|수출|고용|부동산|금융 중 하나", "index": 위 목록의 기사 인덱스 숫자 }
  ]
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const parsed = JSON.parse(res.choices[0].message.content ?? '{"categories":[]}')
  const rows = (parsed.categories ?? []) as Array<{ category: string; index: number }>
  const seen = new Set<string>()
  const picked: { id: string; title: string; category: string }[] = []
  for (const r of rows) {
    const art = candidates[r.index]
    if (!art || seen.has(art.id)) continue
    if (!(NEWS_CATEGORIES as readonly string[]).includes(r.category)) continue
    seen.add(art.id)
    picked.push({ id: art.id, title: art.title, category: r.category })
  }
  return picked
}

export async function generateCategoryAnalysis(
  picked: (ArticleWithBody & { category: string })[]
): Promise<CategoryNewsItem[]> {
  const analyses = await analyzeWithBody(picked)
  return analyses.map(a => ({ ...a, category: picked.find(p => p.id === a.id)!.category }))
}

// ─────────────────────────────────────────────────────────────────────────
// 브리핑 글(헤드라인·요약·공유카드·연결고리)을 TOP3 본문과 대조해 고친다 — 2026-10-06 신설
//
// 왜: 메인 브리핑은 후보 30건의 **제목만** 보고 쓴다(고르기와 쓰기를 한 번에 하는 구조라 본문을 넣을 수 없음).
//     그래서 헤드라인·요약에도 지어낸 내용이 들어갔다(9/29 「대기업들이 하반기 채용 늘린대요」 = 원문은
//     줄이는 기업이 더 많음, 10/6 「韓-사우디 협력 강화해요」 = 원문은 포럼에서 논의할 예정).
//     TOP3가 정해진 뒤 그 본문으로 초안을 한 번 더 고친다. 실패하면 초안 그대로 둔다(발행을 막지 않음).
// ─────────────────────────────────────────────────────────────────────────
export async function groundBriefingText(
  draft: { headline: string; summary: string; shareCard?: string; connections: ConnectionItem[] },
  top3: ArticleWithBody[],
  indicators: Omit<KeyIndicator, 'easyExplanation'>[]
): Promise<{ headline: string; summary: string; shareCard?: string; connections: ConnectionItem[]; changed: boolean }> {
  const usable = top3.filter(a => a.body?.text)
  if (usable.length === 0) return { ...draft, changed: false }

  const articleList = top3.map((a, i) => `### 기사 ${i + 1}\n[제목] ${a.title}\n[본문] ${bodyBlock(a)}`).join('\n\n')
  const indicatorList = indicators.length > 0 ? indicators.map(indicatorLine).join('\n') : '- (지표 없음)'

  const prompt = `아래는 오늘 경제 브리핑 초안입니다. 초안은 기사 제목만 보고 쓰여서 틀린 내용이 섞여 있을 수 있습니다.
오늘 고른 핵심 기사 3건의 [본문]과 지표를 기준으로 초안을 검토하고, 본문·지표와 다르거나 본문에 없는 내용을 고쳐 주세요.

## 핵심 기사 3건
${articleList}

## 주요 지표 (직전 거래일 마감 기준)
${indicatorList}

## 초안
{
  "headline": ${JSON.stringify(draft.headline)},
  "summary": ${JSON.stringify(draft.summary)},
  "shareCard": ${JSON.stringify(draft.shareCard ?? '')},
  "connections": ${JSON.stringify(draft.connections ?? [])}
}

고치는 규칙:
- 사실(누가·무엇을·숫자·방향·시제)은 위 본문과 지표에 맞추세요. 본문에 없는 원인·사건·사람·숫자는 빼세요.
- 전망·예정·논의 단계인 일은 결정된 일처럼 쓰지 마세요(예: "협력하기로 했어요" ✗ → "협력을 논의할 예정이에요").
- 비율이 늘어난 것을 규모가 늘어난 것처럼 쓰지 마세요(예: 「계획을 세운 기업 비율이 늘었다」 ≠ 「채용을 늘린다」).
- 초안 내용이 위 기사 3건에도 지표에도 없는 이야기라면, 지어내지 말고 기사 3건과 지표 범위 안에서 다시 쓰세요.
- 맞는 부분은 그대로 두세요. 문체·길이·형식은 초안을 따르세요:
  · headline: 두 줄(\\n으로 구분), 첫 줄 18자 이내, 존댓말 '~어요/~예요', '~대요/~래요' 금지, 지수·환율 시황 금지
  · summary: 3~5개 문단, 문단 사이 빈 줄(\\n\\n). 지표는 「지난 거래일 … 마감」 기준으로
  · shareCard: 공백 포함 20~40자, headline과 다른 내용, '~어요/~예요', '~대요/~래요/~거든요' 금지
  · connections: 3~5개, 짧은 키워드 {"from","to"}, 본문에 근거한 흐름만
${SPEECH_RULES}

다음 JSON 형식으로만 응답하세요:
{ "headline": "...", "summary": "...", "shareCard": "...", "connections": [{"from":"...","to":"..."}] }`

  try {
    const res = await openai.chat.completions.create({
      model: GROUNDED_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      ...samplingFor(GROUNDED_MODEL, 0.2),
    }, { timeout: 100_000 })
    const p = JSON.parse(res.choices[0].message.content ?? '{}') as Partial<typeof draft>
    // 형식이 깨진 응답이면 그 칸만 초안 유지
    const headline = typeof p.headline === 'string' && p.headline.includes('\n') ? p.headline : draft.headline
    const summary = typeof p.summary === 'string' && p.summary.length > 100 ? p.summary : draft.summary
    const shareCard = typeof p.shareCard === 'string' && p.shareCard.trim() ? trimShareCard(p.shareCard) : draft.shareCard
    const connections = Array.isArray(p.connections) && p.connections.length >= 2 ? p.connections : draft.connections
    const changed = headline !== draft.headline || summary !== draft.summary || shareCard !== draft.shareCard
    return { headline, summary, shareCard, connections, changed }
  } catch (e) {
    console.error('[groundBriefingText] 본문 대조 실패 → 초안 그대로:', (e as Error).message)
    return { ...draft, changed: false }
  }
}

// Top3AnalysisItem 배열로 변환 (DB 저장용)
export function buildTop3AnalysisData(
  top3Analyses: (ArticleFullAnalysis & { id: string })[],
  articles: { id: string; title: string }[]
): Top3AnalysisItem[] {
  return top3Analyses.map(analysis => ({
    articleId: analysis.id,
    title: articles.find(a => a.id === analysis.id)?.title ?? '',
    steps: {
      oneline: analysis.oneline,
      whatHappened: analysis.whatHappened,
      whyHappened: analysis.whyHappened,
      myImpact: analysis.myImpact,
      outlook: analysis.outlook,
      conclusion: analysis.conclusion,
    },
  }))
}
