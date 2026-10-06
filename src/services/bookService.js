import { supabase, unwrap } from '../lib/supabase'

/* 북 컬렉션 (gs_books, 본인만). 표지가 없으면 관리자가 넣어 줄 수 있다. */
const toApp = r => ({ id: r.id, title: r.title, author: r.author, cover: r.cover || '', readAt: r.read_at, catId: r.cat_id,
  ...(r.public !== undefined ? { oneLine: r.one_line || '', review: r.review || '', public: !!r.public } : {}) })
const extra = b => ('public' in b ? { one_line: b.oneLine || '', review: b.review || '', public: !!b.public } : {})

export async function listBooks(uid, catId) {
  return unwrap(await supabase.from('gs_books').select('*').eq('user_id', uid).eq('cat_id', catId).order('created_at', { ascending: false })).map(toApp)
}
export async function addBook(uid, catId, b) {
  unwrap(await supabase.from('gs_books').insert({ id: b.id, user_id: uid, cat_id: catId, title: b.title, author: b.author || '', cover: b.cover || null, read_at: b.readAt || null, ...extra(b) }))
}
export async function updateBook(id, b) {
  unwrap(await supabase.from('gs_books').update({ title: b.title, author: b.author || '', cover: b.cover || null, read_at: b.readAt || null, ...extra(b) }).eq('id', id))
}
export async function removeBook(id) {
  unwrap(await supabase.from('gs_books').delete().eq('id', id))
}

/** 친구 미니홈피: 그 사람이 공개한 컬렉션 (후기 칸이 없으면 빈 목록) */
export async function listPublicBooks(uid) {
  const r = await supabase.from('gs_books').select('id,cat_id,title,author,cover,read_at,one_line,review,public').eq('user_id', uid).eq('public', true).order('read_at', { ascending: false })
  return r.error ? [] : r.data.map(toApp)
}

/** 후기 칸(022)이 있는지 */
export async function hasReviewCols() {
  const r = await supabase.from('gs_books').select('public').limit(1)
  return !r.error
}

/* 관리자 */
export const adminBookRequests = async code => unwrap(await supabase.rpc('gs_admin_book_requests', { p_code: code }))
export const adminBookCover = async (code, id, cover) => unwrap(await supabase.rpc('gs_admin_book_cover', { p_code: code, p_id: id, p_cover: cover }))
