import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({ id: r.id, title: r.title, start: r.start_date, end: r.end_date || r.start_date, color: r.color })

/** 내 일정 중 [from, to] 기간과 겹치는 것 */
export async function listEvents(uid, from, to) {
  const rows = unwrap(await supabase.from('gs_events').select('*').eq('user_id', uid)
    .lte('start_date', to).or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`))
  return rows.map(toApp)
}

export async function addEvent(uid, e) {
  unwrap(await supabase.from('gs_events').insert({
    id: e.id, user_id: uid, title: e.title, start_date: e.start, end_date: e.end && e.end !== e.start ? e.end : null, color: e.color,
  }))
}

export async function updateEvent(id, e) {
  unwrap(await supabase.from('gs_events').update({
    title: e.title, start_date: e.start, end_date: e.end && e.end !== e.start ? e.end : null, color: e.color,
  }).eq('id', id))
}

export async function removeEvent(id) {
  unwrap(await supabase.from('gs_events').delete().eq('id', id))
}
