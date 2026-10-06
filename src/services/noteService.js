import { supabase, unwrap } from '../lib/supabase'

/* 다이어리 책 메모·낙서 장 (gs_notes, 본인만) */
const toApp = r => ({ id: r.id, kind: r.kind, sort: r.sort, body: r.body })

export async function listNotes(uid) {
  return unwrap(await supabase.from('gs_notes').select('id,kind,sort,body').eq('user_id', uid).order('sort')).map(toApp)
}
export async function addNote(uid, n) {
  unwrap(await supabase.from('gs_notes').insert({ id: n.id, user_id: uid, kind: n.kind, sort: n.sort, body: n.body }))
}
export async function saveNote(id, body) {
  unwrap(await supabase.from('gs_notes').update({ body, updated_at: new Date().toISOString() }).eq('id', id))
}
export async function removeNote(id) {
  unwrap(await supabase.from('gs_notes').delete().eq('id', id))
}
