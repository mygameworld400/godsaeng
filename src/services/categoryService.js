import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({ id: r.id, name: r.name, icon: r.icon, color: r.color, sort: r.sort, image: r.image || '', options: r.options || [], kind: r.page_kind || 'default', subtitle: r.subtitle || '' })

/** 관리자가 정해 둔 기본 활동 (멤버만 읽힘) */
export async function listBaseCats() {
  return unwrap(await supabase.from('gs_base_cats').select('*').order('sort').order('created_at')).map(toApp)
}

/* ---------- 관리자 ---------- */
export async function adminListBaseCats(code) {
  return unwrap(await supabase.rpc('gs_admin_base_cats', { p_code: code })).map(toApp)
}
/** c.image: undefined 면 그대로, '' 면 삭제, data URL 이면 교체. c.options: undefined 면 그대로 */
export async function adminSaveBaseCat(code, c) {
  unwrap(await supabase.rpc('gs_admin_base_cat_save', {
    p_code: code, p_id: c.id || null, p_name: c.name, p_icon: c.icon, p_color: c.color, p_sort: c.sort ?? 0,
    p_image: c.image === undefined ? null : c.image,
    p_options: c.options === undefined ? null : c.options,
    ...(c.kind ? { p_kind: c.kind } : {}),
    ...(c.subtitle !== undefined ? { p_subtitle: c.subtitle } : {}),
  }))
}
export async function adminDeleteBaseCat(code, id) {
  unwrap(await supabase.rpc('gs_admin_base_cat_delete', { p_code: code, p_id: id }))
}
