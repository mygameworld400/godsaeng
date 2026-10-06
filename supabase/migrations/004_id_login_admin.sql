-- 아이디 로그인 + 관리자 모드
-- 1) 로그인은 영문 아이디(gs_profiles.handle) + 비밀번호. 닉네임(nick)은 홈피 안에서 자유롭게 바꾸는 별개 값.
--    auth 이메일 계산식(gs_login_email)은 그대로라 기존 계정도 그대로 로그인된다.
--    한글 handle 로 이미 가입한 계정은 관리자 모드에서 영문 아이디로 바꿔 주면 된다.
-- 2) 관리자 함수는 관리자 코드를 매번 받아 gs_secrets 의 값과 비교한다.
--    관리자 코드는 이 파일(공개 저장소)에 넣지 않는다. 실행 후 따로:
--      insert into gs_secrets values ('admin_code', '원하는코드')
--        on conflict (key) do update set value = excluded.value;
--    비밀번호는 해시로만 저장되므로 관리자도 원래 비밀번호를 볼 수 없고, 새 비밀번호로 재설정만 한다.

-- 아이디 규칙: 영문으로 시작, 영문·숫자 3~16자, 소문자로 저장
create or replace function gs_valid_id(p text)
returns boolean language sql immutable as $$ select p ~ '^[a-z][a-z0-9]{2,15}$' $$;

drop function if exists gs_register(text, text, text, text);

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

  insert into gs_profiles (id, handle, nick, emoji, cats) values (
    v_id, v_login, v_nick, coalesce(nullif(p_emoji, ''), '🙂'),
    jsonb_build_array(
      jsonb_build_object('id', left(md5(random()::text), 7), 'name', '운동', 'color', 'c3'),
      jsonb_build_object('id', left(md5(random()::text), 7), 'name', '공부', 'color', 'c4'),
      jsonb_build_object('id', left(md5(random()::text), 7), 'name', '생활', 'color', 'c2')
    )
  );
end $$;

-- ---------- 관리자 ----------

create or replace function gs_admin_check(p_code text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_code is null or p_code = '' or p_code <> coalesce((select value from gs_secrets where key = 'admin_code'), '') then
    perform pg_sleep(1);  -- 코드 대입 속도 늦추기
    raise exception 'bad_admin';
  end if;
end $$;

create or replace function gs_admin_list(p_code text)
returns table (id uuid, login text, nick text, emoji text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  perform gs_admin_check(p_code);
  return query
    select p.id, p.handle, p.nick, p.emoji, p.created_at, u.last_sign_in_at
      from gs_profiles p join auth.users u on u.id = p.id
     order by p.created_at;
end $$;

-- 아이디·닉네임·비밀번호 수정. null 이나 '' 로 넘긴 값은 그대로 둔다.
create or replace function gs_admin_update(p_code text, p_id uuid, p_login text, p_nick text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_login text := lower(trim(coalesce(p_login, '')));
begin
  perform gs_admin_check(p_code);
  if not exists (select 1 from gs_profiles where id = p_id) then raise exception 'not_found'; end if;

  if v_login <> '' and v_login is distinct from (select lower(handle) from gs_profiles where id = p_id) then
    if not gs_valid_id(v_login) then raise exception 'bad_id'; end if;
    if exists (select 1 from gs_profiles where lower(handle) = v_login and id <> p_id)
       or exists (select 1 from auth.users where email = gs_login_email(v_login) and id <> p_id) then
      raise exception 'taken';
    end if;
    update gs_profiles set handle = v_login, updated_at = now() where id = p_id;
    update auth.users set email = gs_login_email(v_login), updated_at = now() where id = p_id;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', gs_login_email(v_login))
     where user_id = p_id and provider = 'email';
  end if;

  if coalesce(trim(p_nick), '') <> '' then
    if char_length(trim(p_nick)) > 16 then raise exception 'bad_input'; end if;
    update gs_profiles set nick = trim(p_nick), updated_at = now() where id = p_id;
  end if;

  if coalesce(p_password, '') <> '' then
    if char_length(p_password) < 4 then raise exception 'bad_input'; end if;
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_id;
  end if;
end $$;

-- 이 앱 계정만 지운다 (gs_profiles 가 있고 이메일이 godsaeng 형식). 기록은 cascade 로 같이 지워진다.
create or replace function gs_admin_delete(p_code text, p_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform gs_admin_check(p_code);
  delete from auth.users
   where id = p_id and email like 'gs-%@godsaeng.local'
     and exists (select 1 from gs_profiles where gs_profiles.id = p_id);
end $$;

revoke all on function gs_register(text, text, text, text, text) from public;
revoke all on function gs_admin_check(text) from public, anon, authenticated;
revoke all on function gs_admin_list(text) from public;
revoke all on function gs_admin_update(text, uuid, text, text, text) from public;
revoke all on function gs_admin_delete(text, uuid) from public;
grant execute on function gs_register(text, text, text, text, text) to anon, authenticated;
grant execute on function gs_admin_list(text) to anon, authenticated;
grant execute on function gs_admin_update(text, uuid, text, text, text) to anon, authenticated;
grant execute on function gs_admin_delete(text, uuid) to anon, authenticated;
grant execute on function gs_valid_id(text) to anon, authenticated;
