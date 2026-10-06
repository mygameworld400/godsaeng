import { supabase, unwrap } from '../lib/supabase'
import { normDay } from '../lib/stats'

const toApp = r => normDay({
  checks: r.checks, todos: r.todos, mood: r.mood, pub: r.pub, diary: r.diary,
  rTotal: r.r_total, rDone: r.r_done, tTotal: r.t_total, tDone: r.t_done,
}, r.date)

export async function listDays(uid, since) {
  const rows = unwrap(await supabase.from('gs_days').select('*').eq('user_id', uid).gte('date', since))
  return Object.fromEntries(rows.map(r => [r.date, toApp(r)]))
}

/** 친구 여러 명의 특정 날짜 기록. {uid: day} */
export async function daysOn(uids, date) {
  if (!uids.length) return {}
  const rows = unwrap(await supabase.from('gs_days').select('*').in('user_id', uids).eq('date', date))
  return Object.fromEntries(rows.map(r => [r.user_id, toApp(r)]))
}

export async function saveDay(uid, d) {
  unwrap(await supabase.from('gs_days').upsert({
    user_id: uid, date: d.date, checks: d.checks, todos: d.todos, mood: d.mood, pub: d.pub, diary: d.diary,
    r_total: d.rTotal, r_done: d.rDone, t_total: d.tTotal, t_done: d.tDone, updated_at: new Date().toISOString(),
  }))
}

export async function listDiaries(uid, since) {
  const rows = unwrap(await supabase.from('gs_diaries').select('date,text').eq('user_id', uid).gte('date', since))
  return Object.fromEntries(rows.map(r => [r.date, r.text]))
}

export async function saveDiary(uid, date, text) {
  unwrap(await supabase.from('gs_diaries').upsert({ user_id: uid, date, text, updated_at: new Date().toISOString() }))
}
