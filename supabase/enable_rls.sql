-- ─────────────────────────────────────────────────────────────────────────
-- RLS(행 수준 보안) 켜기 — 2026-07-22 Supabase 보안 경고 대응
-- Supabase > SQL Editor에 붙여넣고 실행하세요.
--
-- ⚠️ 실행 순서: 반드시 관리자 키(service_role) 코드가 배포 완료된 뒤 실행할 것.
--    (배포 전에 켜면 발행·구독이 anon 키로 돌다가 막혀 서비스가 멈춤)
--
-- 설계:
--  · 공개 콘텐츠(briefings·news_articles·terms) = 누구나 '읽기'만 허용, 쓰기 불가
--  · 구독자 이메일(subscribers)·채점점수(briefing_scores) = 정책 없음 → anon 완전 차단
--    (서버는 service_role 키로 접근하며, service_role은 RLS를 통과하므로 정상 작동)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 다섯 테이블 모두 RLS 켜기
alter table briefings       enable row level security;
alter table news_articles   enable row level security;
alter table terms           enable row level security;
alter table subscribers     enable row level security;
alter table briefing_scores enable row level security;

-- 2) 공개 콘텐츠 3종 = 익명 '읽기(SELECT)'만 허용 (재실행 안전하게 기존 정책 삭제 후 생성)
drop policy if exists "public read briefings" on briefings;
create policy "public read briefings" on briefings
  for select to anon, authenticated using (true);

drop policy if exists "public read news_articles" on news_articles;
create policy "public read news_articles" on news_articles
  for select to anon, authenticated using (true);

drop policy if exists "public read terms" on terms;
create policy "public read terms" on terms
  for select to anon, authenticated using (true);

-- 3) subscribers / briefing_scores = 정책을 만들지 않음.
--    RLS가 켜졌고 정책이 없으므로 anon·authenticated는 읽기/쓰기 모두 거부됨.
--    서버 코드는 service_role 키(supabaseAdmin.ts)로 접근 → RLS 우회하여 정상 동작.
