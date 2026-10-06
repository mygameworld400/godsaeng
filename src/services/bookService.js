import { supabase, unwrap } from '../lib/supabase'

/* 북 컬렉션 (gs_books, 본인만). 표지가 없으면 관리자가 넣어 줄 수 있다. */
const toApp = r => ({ id: r.id, title: r.title, author: r.author, cover: r.cover || '', readAt: r.read_at })

export async function listBooks(uid, catId) {
  return unwrap(await supabase.from('gs_books').select('*').eq('user_id', uid).eq('cat_id', catId).order('created_at', { ascending: false })).map(toApp)
}
export async function addBook(uid, catId, b) {
  unwrap(await supabase.from('gs_books').insert({ id: b.id, user_id: uid, cat_id: catId, title: b.title, author: b.author || '', cover: b.cover || null, read_at: b.readAt || null }))
}
export async function updateBook(id, b) {
  unwrap(await supabase.from('gs_books').update({ title: b.title, author: b.author || '', cover: b.cover || null, read_at: b.readAt || null }).eq('id', id))
}
export async function removeBook(id) {
  unwrap(await supabase.from('gs_books').delete().eq('id', id))
}

/* 관리자 */
export const adminBookRequests = async code => unwrap(await supabase.rpc('gs_admin_book_requests', { p_code: code }))
export const adminBookCover = async (code, id, cover) => unwrap(await supabase.rpc('gs_admin_book_cover', { p_code: code, p_id: id, p_cover: cover }))
