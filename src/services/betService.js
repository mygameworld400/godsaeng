import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({
  id: r.id, title: r.title, penalty: r.penalty, by: r.by_id,
  start: r.start_date, end: r.end_date, members: r.members || {}, checks: r.checks || {},
})

/** RLS 가 내가 members 에 있는 내기만 돌려준다. */
export async function listBets() {
  const rows = unwrap(await supabase.from('gs_challenges').select('*'))
  return Object.fromEntries(rows.map(r => [r.id, toApp(r)]))
}

export async function createBet(c) {
  unwrap(await supabase.from('gs_challenges').insert({
    id: c.id, title: c.title, penalty: c.penalty, by_id: c.by,
    start_date: c.start, end_date: c.end, members: c.members, checks: {},
  }))
}

export const setMember = (id, status) => supabase.rpc('gs_bet_set_member', { p_id: id, p_status: status }).then(unwrap)
export const checkBet = (id, date, on) => supabase.rpc('gs_bet_check', { p_id: id, p_date: date, p_on: on }).then(unwrap)
export const removeBet = id => supabase.from('gs_challenges').delete().eq('id', id).then(unwrap)
