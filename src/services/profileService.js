import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({
  id: r.id, handle: r.handle || '', nick: r.nick, emoji: r.emoji, bio: r.bio,
  cats: r.cats || [], routines: r.routines || [], rCount: r.r_count || 0, friends: r.friends || [],
})

/** RLS 상 gs_profiles 가 있는 사람만 전체 목록을 받는다. routines 는 공개 루틴만 들어 있다. */
export async function listProfiles() {
  const rows = unwrap(await supabase.from('gs_profiles').select('*'))
  return Object.fromEntries(rows.map(r => [r.id, toApp(r)]))
}

/** 내 전체 루틴 (비공개 포함). 없으면 null */
export async function myRoutines(uid) {
  const rows = unwrap(await supabase.from('gs_private').select('routines').eq('user_id', uid))
  return rows[0]?.routines ?? null
}

/** 공개 프로필에는 공개 루틴과 개수만, 전체 목록은 gs_private 에. */
export async function saveProfile(uid, p) {
  const now = new Date().toISOString()
  unwrap(await supabase.from('gs_profiles').upsert({
    id: uid, nick: p.nick, emoji: p.emoji, bio: p.bio || '', cats: p.cats, friends: p.friends,
    routines: p.routines.filter(r => r.pub), r_count: p.routines.length, updated_at: now,
  }))
  unwrap(await supabase.from('gs_private').upsert({ user_id: uid, routines: p.routines, updated_at: now }))
}
