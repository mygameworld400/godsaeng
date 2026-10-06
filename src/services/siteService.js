import { supabase, unwrap } from '../lib/supabase'

/* 사이트 설정 (gs_site): 관리자만 쓰고 멤버는 읽는다. { weble, cursors, stickers } */
export async function loadSite() {
  const rows = unwrap(await supabase.from('gs_site').select('key,value'))
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}
export async function adminLoadSite(code) {
  const rows = unwrap(await supabase.rpc('gs_admin_site', { p_code: code }))
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}
export async function adminSetSite(code, key, value) {
  unwrap(await supabase.rpc('gs_admin_site_set', { p_code: code, p_key: key, p_value: value }))
}
