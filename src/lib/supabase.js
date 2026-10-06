import { createClient } from '@supabase/supabase-js'

/* 환경변수는 빌드 시점에 주입된다.
   publishable(anon) 키만 쓴다 — service_role 키는 절대 프론트에 두지 않는다.
   실제 접근 제어는 Supabase RLS 가 담당한다. */
const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = URL && KEY ? createClient(URL, KEY) : null
export const hasServer = !!supabase

/** 쿼리 결과를 풀어주고 에러는 그대로 던진다. */
export function unwrap({ data, error }) {
  if (error) throw error
  return data
}
