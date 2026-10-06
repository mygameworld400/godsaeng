import { supabase, unwrap } from '../lib/supabase'

/* 관리자 함수는 매번 관리자 코드를 같이 보낸다. 코드 확인은 DB(gs_secrets)에서 한다. */

const toApp = r => ({ id: r.id, login: r.login || '', nick: r.nick, emoji: r.emoji, createdAt: r.created_at, lastSignIn: r.last_sign_in_at, otherApp: !!r.other_app })

export async function listAccounts(code) {
  return unwrap(await supabase.rpc('gs_admin_list', { p_code: code })).map(toApp)
}

/** 빈 값은 그대로 둔다 */
export async function updateAccount(code, id, { login, nick, password }) {
  unwrap(await supabase.rpc('gs_admin_update', { p_code: code, p_id: id, p_login: login || '', p_nick: nick || '', p_password: password || '' }))
}

export async function deleteAccount(code, id) {
  unwrap(await supabase.rpc('gs_admin_delete', { p_code: code, p_id: id }))
}
