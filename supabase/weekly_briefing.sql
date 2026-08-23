-- 주간 브리핑 저장 (2026-08-23 신설)
--
-- 왜 테이블이 필요한가: 인스타 캐러셀은 카드 7장을 **공개 주소로** 올려두면
-- Meta 서버가 각각 직접 가져간다. 그때마다 OpenAI를 부르면 한 번 게시에 7번 호출이고,
-- 장마다 다른 문장이 나올 수도 있다. 그래서 주간 데이터는 한 번 만들어 여기 저장하고,
-- 카드 라우트 7개는 이 행을 읽어서 그림만 그린다.
--
-- 멱등: week_end에 unique를 걸어 같은 주가 두 번 저장되지 않게 한다.
-- (일간 briefings가 date에 unique를 건 것과 같은 이유 — 2026-07-02 개편)

create table if not exists weekly_briefings (
  id          bigserial primary key,
  week_start  date not null,
  week_end    date not null unique,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists weekly_briefings_week_end_idx on weekly_briefings (week_end desc);

-- RLS: 카드 라우트가 anon 키로 읽으므로 공개 읽기만 연다.
-- 쓰기는 서버(supabaseAdmin, service_role)만 하므로 정책을 따로 만들지 않는다.
-- (2026-07-22 RLS 적용 때 세운 원칙 그대로 — 공개 콘텐츠만 public read)
alter table weekly_briefings enable row level security;

drop policy if exists "public read weekly_briefings" on weekly_briefings;
create policy "public read weekly_briefings"
  on weekly_briefings for select
  using (true);
