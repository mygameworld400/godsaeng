import { supabase, unwrap } from '../lib/supabase'

const toApp = r => ({
  id: r.id, handle: r.handle || '', nick: r.nick, emoji: r.emoji, bio: r.bio,
  cats: r.cats || [], routines: r.routines || [], rCount: r.r_count || 0, friends: r.friends || [],
  // avatar 칸(011)이 있을 때만 키를 둔다 → 마이그레이션 전에도 저장이 깨지지 않게
  ...(r.avatar !== undefined ? { avatar: r.avatar || '' } : {}),
})

/** RLS 상 gs_profiles 가 있는 사람만 전체 목록을 받는다. routines 는 공개 루틴만 들어 있다. */
export async function listProfiles() {
  const rows = unwrap(await supabase.from('gs_profiles').select('*'))
  return Object.fromEntries(rows.map(r => [r.id, toApp(r)]))
}

/** 본인 전용 데이터: 전체 루틴(비공개 포함) + 활동 세부 + 다이어리 표지. 없으면 null
    (select * : 다이어리 표지 칸(013)이 아직 없어도 깨지지 않게) */
export async function myPrivate(uid) {
  const rows = unwrap(await supabase.from('gs_private').select('*').eq('user_id', uid))
  const r = rows[0]
  return r ? { routines: r.routines, catDetails: r.cat_details || {}, ...(r.diary_cover !== undefined ? { diaryCover: r.diary_cover || {} } : {}),
    ...(r.ui !== undefined ? { ui: r.ui || {} } : {}) } : null
}

/** 공개 프로필에는 공개 루틴과 개수만, 전체 목록과 활동 세부는 gs_private 에. */
export async function saveProfile(uid, p, catDetails = {}, diaryCover, ui) {
  const now = new Date().toISOString()
  unwrap(await supabase.from('gs_profiles').upsert({
    id: uid, nick: p.nick, emoji: p.emoji, bio: p.bio || '', cats: p.cats, friends: p.friends,
    ...('avatar' in p ? { avatar: p.avatar || null } : {}),
    routines: p.routines.filter(r => r.pub), r_count: p.routines.length, updated_at: now,
  }))
  unwrap(await supabase.from('gs_private').upsert({ user_id: uid, routines: p.routines, cat_details: catDetails, ...(diaryCover ? { diary_cover: diaryCover } : {}), ...(ui ? { ui } : {}), updated_at: now }))
}
