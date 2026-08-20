-- ─────────────────────────────────────────────────────────────────────────
-- 자동 게시(스레드·인스타)용 테이블 2개 — 2026-08-20 신설
-- Supabase > SQL Editor에 붙여넣고 실행하세요. 재실행해도 안전합니다.
--
-- 설계 원본 = 전직로드맵/1_프로젝트/경제번역기/마케팅/02_P3_설계_2026-08-19.md (P3-6)
--
-- 왜 토큰을 DB에 두나:
--   Meta 토큰은 60일마다 갱신해야 하고 **갱신하면 값이 바뀐다.**
--   Vercel 환경변수는 코드가 스스로 바꿀 수 없다(바꾸려면 사람이 재배포).
--   그래서 값이 변하는 것은 DB에, 변하지 않는 것(앱 시크릿)은 환경변수에 둔다.
--
-- 보안: 두 테이블 모두 RLS를 켜고 **정책을 만들지 않는다** → 공개 anon 키로 완전 차단.
--   서버는 service_role 키(supabaseAdmin)로 접근하며 service_role은 RLS를 통과한다.
--   (subscribers·briefing_scores와 같은 방식. 2026-07-22 enable_rls.sql 참조)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 토큰 보관함 (플랫폼당 1행)
create table if not exists social_tokens (
  platform     text primary key,              -- 'threads' | 'instagram'
  access_token text        not null,
  expires_at   timestamptz not null,          -- 이 시각 전에 갱신해야 한다(만료되면 재로그인밖에 없음)
  updated_at   timestamptz not null default now()
);

comment on table social_tokens is '자동 게시용 장기 액세스 토큰. 만료 14일 전부터 크론이 자동 갱신한다(60일 만료).';

-- 2) 게시 기록 (같은 날 두 번 올리지 않기 위한 잠금 + 실패 관측)
create table if not exists social_posts (
  id          bigserial   primary key,
  platform    text        not null,           -- 'threads' | 'instagram'
  post_date   date        not null,           -- 브리핑 날짜(KST 기준)
  status      text        not null,           -- 'success' | 'failed'
  post_id     text,                           -- 성공 시 플랫폼이 준 글 id
  detail      text,                           -- 실패 사유 또는 메모
  created_at  timestamptz not null default now()
);

-- 하루 한 번만 성공 기록이 남게 한다(멱등). 실패는 여러 번 남을 수 있다.
create unique index if not exists social_posts_once_per_day
  on social_posts (platform, post_date)
  where status = 'success';

comment on table social_posts is '자동 게시 결과 로그. 같은 날 재게시 방지(부분 유니크 인덱스) + 수요일 5분 점검 때 최근 7일 성공 건수 확인용.';

-- 3) RLS 켜기 (정책 없음 = anon 완전 차단)
alter table social_tokens enable row level security;
alter table social_posts  enable row level security;
