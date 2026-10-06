import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({ id: r.id, nick: r.nick, emoji: r.emoji, bio: r.bio, cats: r.cats || [], routines: r.routines || [], friends: r.friends || [] })

/** RLS 상 gs_profiles 가 있는 사람만 전체 목록을 받는다. */
export async function listProfiles() {
  const rows = unwrap(await supabase.from('gs_profiles').select('*'))
  return Object.fromEntries(rows.map(r => [r.id, toApp(r)]))
}

export async function saveProfile(uid, p) {
  unwrap(await supabase.from('gs_profiles').upsert({
    id: uid, nick: p.nick, emoji: p.emoji, bio: p.bio || '', cats: p.cats, routines: p.routines, friends: p.friends,
    updated_at: new Date().toISOString(),
  }))
}
