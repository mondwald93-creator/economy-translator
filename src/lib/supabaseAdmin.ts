import { createClient } from '@supabase/supabase-js'

// ⚠️ 서버 전용 관리자 클라이언트 — 절대 브라우저(클라이언트 컴포넌트)에서 import 금지.
// service_role 키는 RLS(행 수준 보안)를 통과하는 관리자 열쇠라, 노출되면 전체 DB가 열린다.
// NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에 포함되지 않는다(서버에서만 존재).
//
// 용도: 쓰기(발행·수집·채점) + 구독자(subscribers) 테이블 접근.
// 공개 콘텐츠(briefings·news_articles·terms)의 '읽기'는 anon 키(supabase.ts)로 두고
// RLS의 public SELECT 정책으로 연다. 이 모듈을 import하는 파일 = 쓰기 권한 보유 목록.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
