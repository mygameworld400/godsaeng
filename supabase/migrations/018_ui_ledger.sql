-- 1) 화면 설정(각자): 배경 색·무늬·이미지, 제목 형광펜 색·모양
alter table gs_private add column if not exists ui jsonb not null default '{}';

-- 2) 추천 활동의 활동 페이지 종류: 'default'(시작 날짜·목표·투두) | 'ledger'(가계부)
alter table gs_base_cats add column if not exists page_kind text not null default 'default' check (page_kind in ('default', 'ledger'));

drop function if exists gs_admin_base_cat_save(text, text, text, text, text, int, text, jsonb);
create or replace function gs_admin_base_cat_save(p_code text, p_id text, p_name text, p_icon text, p_color text, p_sort int,
                                                  p_image text default null, p_options jsonb default null, p_kind text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 12 then raise exception 'bad_input'; end if;
  if p_kind is not null and p_kind not in ('default', 'ledger') then raise exception 'bad_input'; end if;
  if p_options is not null and (jsonb_typeof(p_options) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_options) o
        where char_length(trim(coalesce(o->>'name', ''))) not between 1 and 12
           or coalesce(o->>'id', '') = ''
           or (coalesce(o->>'image', '') <> '' and o->>'image' not like 'data:image/%'))) then
    raise exception 'bad_input';
  end if;
  if p_id is null or p_id = '' then
    insert into gs_base_cats (name, icon, color, sort, image, options, page_kind)
    values (trim(p_name), coalesce(nullif(p_icon, ''), '🏷️'), coalesce(nullif(p_color, ''), 'c1'), coalesce(p_sort, 0),
            nullif(p_image, ''), coalesce(p_options, '[]'), coalesce(p_kind, 'default'));
  else
    update gs_base_cats
       set name = trim(p_name), icon = coalesce(nullif(p_icon, ''), icon),
           color = coalesce(nullif(p_color, ''), color), sort = coalesce(p_sort, sort),
           image = case when p_image is null then image when p_image = '' then null else p_image end,
           options = coalesce(p_options, options),
           page_kind = coalesce(p_kind, page_kind)
     where id = p_id;
  end if;
end $$;
revoke all on function gs_admin_base_cat_save(text, text, text, text, text, int, text, jsonb, text) from public;
grant execute on function gs_admin_base_cat_save(text, text, text, text, text, int, text, jsonb, text) to anon, authenticated;

-- 3) 가계부 기록 (본인만). cat_id = 내 활동 id. 지출 분류는 gs_private.cat_details[cat_id].ledgerCats
create table if not exists gs_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  cat_id     text not null,
  type       text not null check (type in ('in', 'out')),
  amount     bigint not null check (amount > 0 and amount < 10000000000000),
  category   text not null default '',
  memo       text not null default '' check (char_length(memo) <= 100),
  date       date not null,
  created_at timestamptz not null default now()
);
create index if not exists gs_ledger_user_idx on gs_ledger (user_id, cat_id, date);
alter table gs_ledger enable row level security;
drop policy if exists gs_ledger_own on gs_ledger;
create policy gs_ledger_own on gs_ledger for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 백업에 가계부 포함
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
    'gs_ledger',         (select coalesce(jsonb_agg(t), '[]') from gs_ledger t),
    'gs_cheers',         (select coalesce(jsonb_agg(t), '[]') from gs_cheers t),
    'gs_challenges',     (select coalesce(jsonb_agg(t), '[]') from gs_challenges t),
    'gs_events',         (select coalesce(jsonb_agg(t), '[]') from gs_events t),
    'gs_base_cats',      (select coalesce(jsonb_agg(t), '[]') from gs_base_cats t),
    'gs_plan_templates', (select coalesce(jsonb_agg(t), '[]') from gs_plan_templates t),
    'gs_quests',         (select coalesce(jsonb_agg(t), '[]') from gs_quests t),
    'gs_quest_members',  (select coalesce(jsonb_agg(t), '[]') from gs_quest_members t)
  );
end $$;
