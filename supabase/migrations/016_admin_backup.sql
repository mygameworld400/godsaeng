-- 백업: 관리자 코드로 갓생홈피 데이터 전체를 JSON 하나로 받는다 (관리자 모드 → 백업 내려받기).
-- 비밀값(gs_secrets)과 로그인 비밀번호(auth)는 넣지 않는다.
create or replace function gs_admin_backup(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return jsonb_build_object(
    'app', 'godsaeng', 'version', 1, 'at', now(),
    'gs_profiles',       (select coalesce(jsonb_agg(t), '[]') from gs_profiles t),
    'gs_private',        (select coalesce(jsonb_agg(t), '[]') from gs_private t),
    'gs_days',           (select coalesce(jsonb_agg(t), '[]') from gs_days t),
    'gs_day_private',    (select coalesce(jsonb_agg(t), '[]') from gs_day_private t),
    'gs_diaries',        (select coalesce(jsonb_agg(t), '[]') from gs_diaries t),
    'gs_cheers',         (select coalesce(jsonb_agg(t), '[]') from gs_cheers t),
    'gs_challenges',     (select coalesce(jsonb_agg(t), '[]') from gs_challenges t),
    'gs_events',         (select coalesce(jsonb_agg(t), '[]') from gs_events t),
    'gs_base_cats',      (select coalesce(jsonb_agg(t), '[]') from gs_base_cats t),
    'gs_plan_templates', (select coalesce(jsonb_agg(t), '[]') from gs_plan_templates t),
    'gs_quests',         (select coalesce(jsonb_agg(t), '[]') from gs_quests t),
    'gs_quest_members',  (select coalesce(jsonb_agg(t), '[]') from gs_quest_members t)
  );
end $$;
revoke all on function gs_admin_backup(text) from public;
grant execute on function gs_admin_backup(text) to anon, authenticated;
