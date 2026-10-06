import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({ id: r.id, to: r.to_id, from: r.from_id, text: r.text, at: r.created_at })

export async function listCheers(to) {
  const rows = unwrap(await supabase.from('gs_cheers').select('*').eq('to_id', to).order('created_at', { ascending: false }).limit(30))
  return rows.map(toApp)
}

export async function addCheer(c) {
  return toApp(unwrap(await supabase.from('gs_cheers').insert({ to_id: c.to, from_id: c.from, text: c.text }).select().single()))
}

export async function removeCheer(id) {
  unwrap(await supabase.from('gs_cheers').delete().eq('id', id))
}
