import { supabase, unwrap } from '../lib/supabase'

/* 로그인은 닉네임(handle) + 비밀번호. auth 이메일은 handle 에서 계산한다.
   DB 의 gs_login_email() 과 반드시 같은 식이어야 한다 (002_nick_login.sql). */
export async function loginEmail(handle) {
  const bytes = new TextEncoder().encode(handle.trim().toLowerCase())
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
  return 'gs-' + hex.slice(0, 32) + '@godsaeng.local'
}

export const getSession = async () => (await supabase.auth.getSession()).data.session
export const onAuth = cb => supabase.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription
export const signOut = () => supabase.auth.signOut()

export async function signIn(handle, password) {
  return unwrap(await supabase.auth.signInWithPassword({ email: await loginEmail(handle), password }))
}

/** 입장코드가 맞으면 계정 + 프로필을 만들고 바로 로그인한다. */
export async function register(code, handle, password, emoji) {
  unwrap(await supabase.rpc('gs_register', { p_code: code, p_handle: handle, p_password: password, p_emoji: emoji }))
  return signIn(handle, password)
}

export const deleteMe = () => supabase.rpc('gs_delete_me').then(unwrap)
