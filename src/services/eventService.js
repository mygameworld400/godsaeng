import { supabase, unwrap } from '../lib/supabase'

/* 일정. hidden 이면 달력 칸에는 안 보인다(목록에는 보임). time/endTime 은 'HH:MM' (선택).
   hidden(013)·시간(015) 칸은 서버에 있을 때만 키를 둔다 → 마이그레이션 전 배포에도 저장이 깨지지 않게. */
const hm = t => (t ? String(t).slice(0, 5) : '')
const toApp = r => ({
  id: r.id, title: r.title, start: r.start_date, end: r.end_date || r.start_date, color: r.color,
  ...(r.hidden !== undefined ? { hidden: !!r.hidden } : {}),
  ...(r.start_time !== undefined ? { time: hm(r.start_time), endTime: hm(r.end_time) } : {}),
})
const toRow = e => ({
  title: e.title, start_date: e.start, end_date: e.end && e.end !== e.start ? e.end : null, color: e.color,
  ...('hidden' in e ? { hidden: !!e.hidden } : {}),
  ...('time' in e ? { start_time: e.time || null, end_time: e.time && e.endTime ? e.endTime : null } : {}),
})

/** 내 일정 중 [from, to] 기간과 겹치는 것 */
export async function listEvents(uid, from, to) {
  const rows = unwrap(await supabase.from('gs_events').select('*').eq('user_id', uid)
    .lte('start_date', to).or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`))
  return rows.map(toApp)
}

export async function addEvent(uid, e) {
  unwrap(await supabase.from('gs_events').insert({ id: e.id, user_id: uid, ...toRow(e) }))
}

export async function updateEvent(id, e) {
  unwrap(await supabase.from('gs_events').update(toRow(e)).eq('id', id))
}

export async function removeEvent(id) {
  unwrap(await supabase.from('gs_events').delete().eq('id', id))
}
