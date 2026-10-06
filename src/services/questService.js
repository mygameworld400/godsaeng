import { supabase, unwrap } from '../lib/supabase'

/* 챌린지(gs_quests) — 플랜 템플릿을 함께 하는 단위. 참여·진도는 gs_quest_members. */

const toApp = r => ({ id: r.id, title: r.title, description: r.description, templateId: r.template_id, baseId: r.base_id, optionId: r.option_id, sort: r.sort, kind: r.kind || 'plan' })

/** 챌린지 목록 + 참여자(진도 포함) */
export async function listQuests() {
  const [qs, ms] = await Promise.all([
    supabase.from('gs_quests').select('*').order('sort').order('created_at').then(unwrap),
    supabase.from('gs_quest_members').select('quest_id,user_id,progress,joined_at').then(unwrap),
  ])
  return qs.map(q => ({ ...toApp(q), members: ms.filter(m => m.quest_id === q.id).map(m => ({ userId: m.user_id, progress: m.progress || {}, joinedAt: m.joined_at })) }))
}

/** 참여 (처음 진도를 같이 넣을 수 있다: 미라클모닝 목표 시간 등) */
export async function joinQuest(questId, uid, progress = {}) {
  unwrap(await supabase.from('gs_quest_members').upsert({ quest_id: questId, user_id: uid, progress }, { onConflict: 'quest_id,user_id', ignoreDuplicates: true }))
}

export async function leaveQuest(questId, uid) {
  unwrap(await supabase.from('gs_quest_members').delete().eq('quest_id', questId).eq('user_id', uid))
}

export async function saveQuestProgress(questId, uid, progress) {
  unwrap(await supabase.from('gs_quest_members').update({ progress, updated_at: new Date().toISOString() }).eq('quest_id', questId).eq('user_id', uid))
}

/** 템플릿 내용 (멤버 읽기) */
export async function getTemplate(id) {
  const rows = unwrap(await supabase.from('gs_plan_templates').select('data').eq('id', id))
  return rows[0]?.data || null
}

/* ---------- 관리자 ---------- */
export const adminListQuests = async code => unwrap(await supabase.rpc('gs_admin_quests', { p_code: code })).map(toApp)
export const adminSaveQuest = async (code, q) => unwrap(await supabase.rpc('gs_admin_quest_save', {
  p_code: code, p_id: q.id || '', p_title: q.title, p_description: q.description || '',
  p_template_id: q.templateId || '', p_base_id: q.baseId || '', p_option_id: q.optionId || '', p_sort: q.sort ?? 0,
  ...(q.kind ? { p_kind: q.kind } : {}),
}))
export const adminDeleteQuest = async (code, id) => unwrap(await supabase.rpc('gs_admin_quest_delete', { p_code: code, p_id: id }))
