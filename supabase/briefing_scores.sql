-- 브리핑 자동 채점 결과 테이블 (채점기 P1 · 기준표 v2.1 기반)
-- Supabase > SQL Editor에 붙여넣고 실행하세요 (기존 schema.sql과 별개, 이것만 실행하면 됨)

create table if not exists briefing_scores (
  id               uuid primary key default gen_random_uuid(),
  date             date not null unique,       -- 채점 대상 브리핑 날짜 (하루 1행)
  rubric_version   text not null default 'v2.1', -- 어떤 기준표로 채점했는지
  total            int,                        -- 5항목 합계 (0~10). 판정 불가 항목이 있으면 null
  scores           jsonb,                      -- 항목별 {score, reason}: 이해도/사실/선정/다양성/톤
  format_pass      boolean,                    -- 형식 검사(코드) 전체 통과 여부
  format_checks    jsonb,                      -- 형식 검사 세부 결과 목록
  disqualified     boolean default false,      -- 안전선 실격 (투자조언·지어낸 정보)
  disqualify_reason text,
  issue_note       text,                       -- "눈에 띈 문제 한 줄" (천장 효과 보완용)
  inputs           jsonb,                      -- 채점에 첨부한 입력 기록 (지표 값·후보 기사 수 등)
  created_at       timestamptz default now()
);

create index if not exists briefing_scores_date_idx on briefing_scores(date);
