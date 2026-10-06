import { createClient } from '@supabase/supabase-js'

/* 환경변수는 빌드 시점에 주입된다.
   publishable(anon) 키만 쓴다 — service_role 키는 절대 프론트에 두지 않는다.
   실제 접근 제어는 Supabase RLS 가 담당한다. */
const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/* 미니홈·메롱과 같은 출처(mygameworld400.github.io) + 같은 Supabase 프로젝트라
   기본 저장 키를 쓰면 로그인 세션이 앱끼리 공유된다. 갓생홈피 전용 키로 분리한다. */
export const supabase = URL && KEY ? createClient(URL, KEY, { auth: { storageKey: 'godsaeng-auth' } }) : null
export const hasServer = !!supabase

/** 쿼리 결과를 풀어주고 에러는 그대로 던진다. */
export function unwrap({ data, error }) {
  if (error) throw error
  return data
}
