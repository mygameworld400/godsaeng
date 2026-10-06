import { supabase, unwrap } from '../lib/supabase'

/* 플랜 템플릿 (gs_plan_templates). 관리자 화면은 로그인 없이 열리므로 관리자 코드로 조회한다. */

export async function adminListPlans(code) {
  return unwrap(await supabase.rpc('gs_admin_plan_list', { p_code: code }))
}

export async function adminGetPlan(code, id) {
  return unwrap(await supabase.rpc('gs_admin_plan_get', { p_code: code, p_id: id }))
}
