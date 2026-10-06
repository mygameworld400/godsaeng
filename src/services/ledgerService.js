import { supabase, unwrap } from '../lib/supabase'

/* 가계부 기록 (gs_ledger, 본인만). catId = 내 활동 id */
const toApp = r => ({ id: r.id, type: r.type, amount: Number(r.amount), category: r.category, memo: r.memo, date: r.date })

export async function listLedger(uid, catId) {
  return unwrap(await supabase.from('gs_ledger').select('*').eq('user_id', uid).eq('cat_id', catId).order('date', { ascending: false }).order('created_at', { ascending: false })).map(toApp)
}
export async function addLedger(uid, catId, e) {
  unwrap(await supabase.from('gs_ledger').insert({ id: e.id, user_id: uid, cat_id: catId, type: e.type, amount: e.amount, category: e.category || '', memo: e.memo || '', date: e.date }))
}
export async function updateLedger(id, e) {
  unwrap(await supabase.from('gs_ledger').update({ type: e.type, amount: e.amount, category: e.category || '', memo: e.memo || '', date: e.date }).eq('id', id))
}
export async function removeLedger(id) {
  unwrap(await supabase.from('gs_ledger').delete().eq('id', id))
}
