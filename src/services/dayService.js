import { supabase, unwrap } from '../lib/supabase'
import { normDay } from '../lib/stats'

const toApp = r => normDay({
  checks: r.checks, todos: r.todos, mood: r.mood, pub: r.pub, diary: r.diary,
  rTotal: r.r_total, rDone: r.r_done, tTotal: r.t_total, tDone: r.t_done,
}, r.date)

/** 공개 기록 (친구도 보는 것: 공개 항목 + 개수) */
export async function listDays(uid, since, until) {
  let q = supabase.from('gs_days').select('*').eq('user_id', uid).gte('date', since)
  if (until) q = q.lte('date', until)
  const rows = unwrap(await q)
  return Object.fromEntries(rows.map(r => [r.date, toApp(r)]))
}

/** 내 기록 전체: 공개 기록에 비공개 체크·투두를 덮어쓴다. */
export async function listMyDays(uid, since, until) {
  let pq = supabase.from('gs_day_private').select('date,checks,todos').eq('user_id', uid).gte('date', since)
  if (until) pq = pq.lte('date', until)
  const [pub, priv] = await Promise.all([listDays(uid, since, until), pq.then(unwrap)])
  priv.forEach(p => { pub[p.date] = normDay({ ...pub[p.date], checks: p.checks, todos: p.todos }, p.date) })
  return pub
}

/** 친구 여러 명의 특정 날짜 기록. {uid: day} */
export async function daysOn(uids, date) {
  if (!uids.length) return {}
  const rows = unwrap(await supabase.from('gs_days').select('*').in('user_id', uids).eq('date', date))
  return Object.fromEntries(rows.map(r => [r.user_id, toApp(r)]))
}

/** d = buildDay() 결과(공개분), priv = 전체 체크·투두 */
export async function saveDay(uid, d, priv) {
  const now = new Date().toISOString()
  unwrap(await supabase.from('gs_days').upsert({
    user_id: uid, date: d.date, checks: d.checks, todos: d.todos, mood: d.mood, pub: d.pub, diary: d.diary,
    r_total: d.rTotal, r_done: d.rDone, t_total: d.tTotal, t_done: d.tDone, updated_at: now,
  }))
  unwrap(await supabase.from('gs_day_private').upsert({ user_id: uid, date: d.date, checks: priv.checks, todos: priv.todos, updated_at: now }))
}

export async function listDiaries(uid, since) {
  const rows = unwrap(await supabase.from('gs_diaries').select('date,text').eq('user_id', uid).gte('date', since))
  return Object.fromEntries(rows.map(r => [r.date, r.text]))
}

export async function saveDiary(uid, date, text) {
  unwrap(await supabase.from('gs_diaries').upsert({ user_id: uid, date, text, updated_at: new Date().toISOString() }))
}
