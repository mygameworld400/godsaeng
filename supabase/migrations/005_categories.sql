-- 카테고리 탭
-- 기본 카테고리: 관리자가 만들어 두는 목록. 사용자는 골라서 내 카테고리에 추가한다 (추가는 자유).
-- 개별 카테고리: 사용자가 직접 만든다.
-- 내 카테고리 목록(이름·아이콘·색)은 gs_profiles.cats (친구도 봄, 루틴·투두 묶음용).
-- 카테고리별 세부(시작 날짜·목표·투두리스트)는 본인만 보는 gs_private.cat_details = {catId: {start, goal, todos}}.

create table if not exists gs_base_cats (
  id         text primary key default left(md5(random()::text), 7),
  name       text not null check (char_length(name) between 1 and 12),
  icon       text not null default '🏷️',
  color      text not null default 'c1',
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
alter table gs_base_cats enable row level security;
drop policy if exists gs_base_cats_select on gs_base_cats;
create policy gs_base_cats_select on gs_base_cats for select to authenticated using (gs_is_member());

insert into gs_base_cats (name, icon, color, sort)
  select * from (values ('운동', '🏃', 'c3', 1), ('공부', '📚', 'c4', 2), ('생활', '🏠', 'c2', 3)) v(name, icon, color, sort)
  where not exists (select 1 from gs_base_cats);

alter table gs_private add column if not exists cat_details jsonb not null default '{}';

-- 가입 시 카테고리는 비워서 시작한다 (기본 카테고리는 카테고리 탭에서 골라 추가).
create or replace function gs_register(p_code text, p_login text, p_password text, p_nick text, p_emoji text default '🙂')
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_login text := lower(trim(p_login));
  v_nick  text := trim(p_nick);
  v_email text := gs_login_email(v_login);
  v_id    uuid := gen_random_uuid();
begin
  if p_code is null or p_code <> coalesce((select value from gs_secrets where key = 'entry_code'), '') then
    raise exception 'bad_code';
  end if;
  if not gs_valid_id(v_login) then raise exception 'bad_id'; end if;
  if char_length(v_nick) not between 1 and 16 or char_length(coalesce(p_password, '')) < 4 then
    raise exception 'bad_input';
  end if;
  if exists (select 1 from gs_profiles where lower(handle) = v_login)
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'taken';
  end if;

  -- 토큰 계열 컬럼은 반드시 ''. NULL 이면 로그인 시 500 "Database error querying schema".
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"app":"godsaeng"}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());

  insert into gs_profiles (id, handle, nick, emoji, cats)
  values (v_id, v_login, v_nick, coalesce(nullif(p_emoji, ''), '🙂'), '[]');
end $$;

-- ---------- 관리자: 기본 카테고리 ----------

-- p_id 가 null 이면 새로 만들고, 있으면 수정한다.
create or replace function gs_admin_base_cat_save(p_code text, p_id text, p_name text, p_icon text, p_color text, p_sort int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 12 then raise exception 'bad_input'; end if;
  if p_id is null or p_id = '' then
    insert into gs_base_cats (name, icon, color, sort)
    values (trim(p_name), coalesce(nullif(p_icon, ''), '🏷️'), coalesce(nullif(p_color, ''), 'c1'), coalesce(p_sort, 0));
  else
    update gs_base_cats
       set name = trim(p_name), icon = coalesce(nullif(p_icon, ''), icon),
           color = coalesce(nullif(p_color, ''), color), sort = coalesce(p_sort, sort)
     where id = p_id;
  end if;
end $$;

-- 지워도 이미 추가한 사람의 카테고리는 남는다 (각자 복사본).
create or replace function gs_admin_base_cat_delete(p_code text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  delete from gs_base_cats where id = p_id;
end $$;

-- 관리자 화면은 로그인 없이도 열리므로 목록 조회용 함수를 따로 둔다.
create or replace function gs_admin_base_cats(p_code text)
returns setof gs_base_cats language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return query select * from gs_base_cats order by sort, created_at;
end $$;

revoke all on function gs_register(text, text, text, text, text) from public;
revoke all on function gs_admin_base_cat_save(text, text, text, text, text, int) from public;
revoke all on function gs_admin_base_cat_delete(text, text) from public;
revoke all on function gs_admin_base_cats(text) from public;
grant execute on function gs_register(text, text, text, text, text) to anon, authenticated;
grant execute on function gs_admin_base_cat_save(text, text, text, text, text, int) to anon, authenticated;
grant execute on function gs_admin_base_cat_delete(text, text) to anon, authenticated;
grant execute on function gs_admin_base_cats(text) to anon, authenticated;
