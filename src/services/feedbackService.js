import { supabase, unwrap } from '../lib/supabase'

/* 우체통 (gs_feedback). 목록은 함수로만 읽는다 (익명 작성자 보호) */
export const listFeedback = async () => unwrap(await supabase.rpc('gs_feedback_list'))
export async function sendFeedback(uid, f) {
  unwrap(await supabase.from('gs_feedback').insert({ user_id: uid, body: f.body, anonymous: !!f.anonymous, public: !!f.public }))
}
export const deleteFeedback = async id => unwrap(await supabase.from('gs_feedback').delete().eq('id', id))

/* 관리자 */
export const adminFeedback = async code => unwrap(await supabase.rpc('gs_admin_feedback', { p_code: code }))
export const adminUpdateFeedback = async (code, id, status, reply) => unwrap(await supabase.rpc('gs_admin_feedback_update', { p_code: code, p_id: id, p_status: status, p_reply: reply }))
