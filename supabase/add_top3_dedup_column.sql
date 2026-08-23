-- TOP3 겹침 검문 기록 보관용 컬럼 (2026-08-23 신설)
--
-- 왜: 8/23 브리핑에 같은 금통위 금리 사안 기사 2개가 나란히 실렸다.
--     원인을 30분 만에 규명할 수 있었던 건 채점기가 매일 유사도를 쌓아둔 덕이었다.
--     새로 붙인 AI 겹침 검문도 같은 이유로 판정 근거를 매일 남긴다.
--
-- 들어가는 값: { model, rounds: [{titles, duplicates, reason}], replaced: [{out, in}], note? }
-- 없어도 브리핑 발행은 정상 동작한다(runBriefing이 저장 실패를 경고만 하고 넘어감).
--
-- 실행 위치: Supabase 대시보드 → SQL Editor

alter table briefings add column if not exists top3_dedup jsonb;

comment on column briefings.top3_dedup is
  'TOP3 겹침 AI 검문 기록. 판정 모델·판정 사유·교체된 기사. 상세 = src/lib/top3Dedup.ts';
