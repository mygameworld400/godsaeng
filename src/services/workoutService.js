import { supabase, unwrap } from '../lib/supabase'

/* 운동 일지 (gs_workouts, 본인만) */
const toApp = r => ({ id: r.id, catId: r.cat_id, date: r.date, what: r.what, minutes: r.minutes, memo: r.memo })

/** 기간 안의 내 운동 기록 (모든 운동 활동) */
export async function listWorkouts(uid, from, to) {
  return unwrap(await supabase.from('gs_workouts').select('*').eq('user_id', uid).gte('date', from).lte('date', to).order('created_at')).map(toApp)
}
export async function addWorkout(uid, w) {
  unwrap(await supabase.from('gs_workouts').insert({ id: w.id, user_id: uid, cat_id: w.catId, date: w.date, what: w.what, minutes: w.minutes || 0, memo: w.memo || '' }))
}
export async function updateWorkout(id, w) {
  unwrap(await supabase.from('gs_workouts').update({ what: w.what, minutes: w.minutes || 0, memo: w.memo || '' }).eq('id', id))
}
export async function removeWorkout(id) {
  unwrap(await supabase.from('gs_workouts').delete().eq('id', id))
}
