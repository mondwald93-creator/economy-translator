-- news_articles에 "기사 실제 발행 시각" 열 추가 (2026-07-24)
--
-- 왜 필요한가:
--   기존 `date` 열은 "발행일"이 아니라 사실상 "수집일"이었다.
--   pubDate 파싱에 실패하거나(네이버 랭킹 스크래핑은 아예 pubDate가 없음)
--   할 때 오늘 날짜로 조용히 대체돼, 오래된 기사가 '오늘 기사'로 둔갑했다.
--   실측: 2026-07-23 브리핑 TOP3 1번 「3년6개월 만의 금리 인상…」의 원본 URL은
--   peoplewatch.co.kr/.../ppw20260716... = 7/16 발행인데 date=2026-07-23으로 저장됨.
--   → 일주일 전 사건이 오늘 헤드라인과 충돌(동결 vs 인상 내부 모순).
--
-- 이 열의 규칙:
--   - 발행 시각을 알아낸 경우에만 채운다.
--   - 모르면 NULL. **오늘 날짜로 추측해서 채우지 않는다.**
--     (채점기의 '판정 불가'와 같은 원리 — 모르는 것을 안다고 하지 않는다)
--
-- 기존 데이터는 손대지 않는다. 전부 NULL로 남고, 새로 수집되는 기사부터 채워진다.
-- `date` 열의 동작·의미는 그대로 둔다(홈 화면·뉴스 목록이 전부 date로 조회하므로).

alter table news_articles
  add column if not exists published_at timestamptz;

comment on column news_articles.published_at is
  '기사 실제 발행 시각(RSS pubDate·네이버 검색 API pubDate 원본). 알 수 없으면 NULL — 수집 시각으로 대체하지 말 것.';

-- 신선도 필터가 매일 후보를 거를 때 쓰는 인덱스
create index if not exists news_articles_published_at_idx
  on news_articles(published_at);
