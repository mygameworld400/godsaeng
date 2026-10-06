-- 챌린지: 플랜 템플릿을 여러 사람이 함께 하는 단위 (예: 일본어 12주 챌린지)
-- (gs_challenges 는 '내기' 테이블이라 이름을 gs_quests 로 둔다)
-- 추천 활동(+하위 선택지)에 붙는다: 언어 → 일본어 활동에 '12주 챌린지'.
-- 만들기·고치기는 관리자 코드로만. 참여·진도는 각자 (gs_quest_members), 참여자끼리 서로의 진도를 본다.

create table if not exists gs_quests (
  id          text primary key default left(md5(random()::text), 8),
  title       text not null check (char_length(title) between 1 and 40),
  description text not null default '',
  template_id text references gs_plan_templates(id) on delete set null,
  base_id     text,          -- 추천 활동 id (gs_base_cats.id)
  option_id   text,          -- 하위 선택지 id (예: 일본어)
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table gs_quests enable row level security;
drop policy if exists gs_quests_select on gs_quests;
create policy gs_quests_select on gs_quests for select to authenticated using (gs_is_member());

create table if not exists gs_quest_members (
  quest_id   text not null references gs_quests(id) on delete cascade,
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  progress   jsonb not null default '{}',
  joined_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);
alter table gs_quest_members enable row level security;
drop policy if exists gs_quest_members_select on gs_quest_members;
drop policy if exists gs_quest_members_own on gs_quest_members;
create policy gs_quest_members_select on gs_quest_members for select to authenticated using (gs_is_member());
create policy gs_quest_members_own on gs_quest_members for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 관리자: 챌린지 저장(없으면 추가) / 삭제 / 목록
create or replace function gs_admin_quest_save(p_code text, p_id text, p_title text, p_description text,
                                               p_template_id text, p_base_id text, p_option_id text, p_sort int)
returns text language plpgsql security definer set search_path = public as $$
declare v_id text := coalesce(nullif(p_id, ''), left(md5(random()::text), 8));
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 40 then raise exception 'bad_input'; end if;
  insert into gs_quests (id, title, description, template_id, base_id, option_id, sort)
  values (v_id, trim(p_title), coalesce(p_description, ''), nullif(p_template_id, ''), nullif(p_base_id, ''), nullif(p_option_id, ''), coalesce(p_sort, 0))
  on conflict (id) do update set title = excluded.title, description = excluded.description, template_id = excluded.template_id,
    base_id = excluded.base_id, option_id = excluded.option_id, sort = excluded.sort;
  return v_id;
end $$;

create or replace function gs_admin_quest_delete(p_code text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  delete from gs_quests where id = p_id;
end $$;

create or replace function gs_admin_quests(p_code text)
returns setof gs_quests language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return query select * from gs_quests order by sort, created_at;
end $$;

revoke all on function gs_admin_quest_save(text, text, text, text, text, text, text, int) from public;
revoke all on function gs_admin_quest_delete(text, text) from public;
revoke all on function gs_admin_quests(text) from public;
grant execute on function gs_admin_quest_save(text, text, text, text, text, text, text, int) to anon, authenticated;
grant execute on function gs_admin_quest_delete(text, text) to anon, authenticated;
grant execute on function gs_admin_quests(text) to anon, authenticated;
