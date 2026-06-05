-- 경제번역기 데이터베이스 스키마
-- Supabase > SQL Editor에 붙여넣고 실행하세요

-- 1. 뉴스 기사 테이블
create table if not exists news_articles (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  title       text not null,
  summary     text,           -- AI가 생성한 쉬운 설명
  original_url text,
  source      text,           -- 뉴스 출처 (네이버, 한겨레 등)
  created_at  timestamptz default now()
);

-- 2. 일별 브리핑 테이블
create table if not exists briefings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  summary     text,           -- 오늘의 전체 경제 요약 글
  daily_term  text,           -- 오늘의 경제 용어 (JSON 형태: {"term": "...", "explanation": "..."})
  indicators  jsonb,          -- 핵심 지표 배열 (JSON)
  created_at  timestamptz default now()
);

-- 인덱스
create index if not exists news_articles_date_idx on news_articles(date);
create index if not exists briefings_date_idx on briefings(date);
