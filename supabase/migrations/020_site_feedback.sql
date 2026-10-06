-- 1) 사이트 설정 (관리자만 쓰기, 멤버는 읽기)
--    weble   : { users: [uid...], icon: dataURL, link: url }    위블 계정에게만 왼쪽 위 아이콘
--    cursors : [{ id, name, image }]                             설정에서 고르는 커서
--    stickers: [{ id, image }]                                   다이어리 표지 스티커
create table if not exists gs_site (
  key        text primary key check (key ~ '^[a-z_]{2,30}$'),
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table gs_site enable row level security;
drop policy if exists gs_site_select on gs_site;
create policy gs_site_select on gs_site for select to authenticated using (gs_is_member());

create or replace function gs_admin_site_set(p_code text, p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(p_value::text) > 4000000 then raise exception 'bad_input'; end if;
  insert into gs_site (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function gs_admin_site(p_code text)
returns setof gs_site language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return query select * from gs_site;
end $$;

-- 2) 우체통 (피드백). 익명이면 다른 사람에게 작성자를 숨기고, 비공개면 본인·관리자만.
create table if not exists gs_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  anonymous  boolean not null default false,
  public     boolean not null default true,
  body       text not null check (char_length(body) between 1 and 2000),
  status     text not null default 'new' check (status in ('new', 'checking', 'done')),
  reply      text not null default '' check (char_length(reply) <= 2000),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
alter table gs_feedback enable row level security;
drop policy if exists gs_feedback_insert on gs_feedback;
drop policy if exists gs_feedback_delete on gs_feedback;
-- 직접 select 는 막고(익명 작성자 보호) 아래 함수로만 읽는다
create policy gs_feedback_insert on gs_feedback for insert to authenticated with check (user_id = auth.uid() and gs_is_member());
create policy gs_feedback_delete on gs_feedback for delete to authenticated using (user_id = auth.uid());

create or replace function gs_feedback_list()
returns table (id uuid, mine boolean, author text, anonymous boolean, public boolean, body text, status text, reply text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not gs_is_member() then raise exception 'not_member'; end if;
  return query
    select f.id, f.user_id = auth.uid(), case when f.anonymous then null else p.nick end, f.anonymous, f.public, f.body, f.status, f.reply, f.created_at
      from gs_feedback f join gs_profiles p on p.id = f.user_id
     where f.public or f.user_id = auth.uid()
     order by f.created_at desc;
end $$;

create or replace function gs_admin_feedback(p_code text)
returns table (id uuid, author text, anonymous boolean, public boolean, body text, status text, reply text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return query select f.id, p.nick, f.anonymous, f.public, f.body, f.status, f.reply, f.created_at
    from gs_feedback f join gs_profiles p on p.id = f.user_id order by f.created_at desc;
end $$;

create or replace function gs_admin_feedback_update(p_code text, p_id uuid, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if p_status not in ('new', 'checking', 'done') then raise exception 'bad_input'; end if;
  update gs_feedback set status = p_status, reply = coalesce(p_reply, ''),
    replied_at = case when coalesce(p_reply, '') <> '' then now() else replied_at end
   where id = p_id;
end $$;

revoke all on function gs_admin_site_set(text, text, jsonb) from public;
revoke all on function gs_admin_site(text) from public;
revoke all on function gs_feedback_list() from public, anon;
revoke all on function gs_admin_feedback(text) from public;
revoke all on function gs_admin_feedback_update(text, uuid, text, text) from public;
grant execute on function gs_admin_site_set(text, text, jsonb) to anon, authenticated;
grant execute on function gs_admin_site(text) to anon, authenticated;
grant execute on function gs_feedback_list() to authenticated;
grant execute on function gs_admin_feedback(text) to anon, authenticated;
grant execute on function gs_admin_feedback_update(text, uuid, text, text) to anon, authenticated;

-- 백업에 사이트 설정·피드백 포함
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
    'gs_books',          (select coalesce(jsonb_agg(t), '[]') from gs_books t),
    'gs_workouts',       (select coalesce(jsonb_agg(t), '[]') from gs_workouts t),
    'gs_cheers',         (select coalesce(jsonb_agg(t), '[]') from gs_cheers t),
    'gs_challenges',     (select coalesce(jsonb_agg(t), '[]') from gs_challenges t),
    'gs_events',         (select coalesce(jsonb_agg(t), '[]') from gs_events t),
    'gs_base_cats',      (select coalesce(jsonb_agg(t), '[]') from gs_base_cats t),
    'gs_plan_templates', (select coalesce(jsonb_agg(t), '[]') from gs_plan_templates t),
    'gs_quests',         (select coalesce(jsonb_agg(t), '[]') from gs_quests t),
    'gs_quest_members',  (select coalesce(jsonb_agg(t), '[]') from gs_quest_members t),
    'gs_site',           (select coalesce(jsonb_agg(t), '[]') from gs_site t),
    'gs_feedback',       (select coalesce(jsonb_agg(t), '[]') from gs_feedback t)
  );
end $$;
