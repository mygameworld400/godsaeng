-- 다이어리 책의 메모(줄 노트 글)·낙서(민무늬 종이 그림) 장. 본인만.
-- body: 메모는 글, 낙서는 그림 PNG data URL.
create table if not exists gs_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  kind       text not null check (kind in ('memo', 'doodle')),
  sort       int not null default 0,
  body       text not null default '' check (char_length(body) <= 800000),
  updated_at timestamptz not null default now()
);
create index if not exists gs_notes_user_idx on gs_notes (user_id, kind, sort);
alter table gs_notes enable row level security;
drop policy if exists gs_notes_own on gs_notes;
create policy gs_notes_own on gs_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 백업에도 포함
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
    'gs_notes',          (select coalesce(jsonb_agg(t), '[]') from gs_notes t),
    'gs_cheers',         (select coalesce(jsonb_agg(t), '[]') from gs_cheers t),
    'gs_challenges',     (select coalesce(jsonb_agg(t), '[]') from gs_challenges t),
    'gs_events',         (select coalesce(jsonb_agg(t), '[]') from gs_events t),
    'gs_base_cats',      (select coalesce(jsonb_agg(t), '[]') from gs_base_cats t),
    'gs_plan_templates', (select coalesce(jsonb_agg(t), '[]') from gs_plan_templates t),
    'gs_quests',         (select coalesce(jsonb_agg(t), '[]') from gs_quests t),
    'gs_quest_members',  (select coalesce(jsonb_agg(t), '[]') from gs_quest_members t)
  );
end $$;
