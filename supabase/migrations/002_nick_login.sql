-- 닉네임 + 비밀번호 로그인
-- 공용 프로젝트는 가입 메일 인증이 켜져 있고 기본 SMTP 라 친구들이 이메일로 가입할 수 없다.
-- 그래서 가입은 gs_register() 가 auth.users 에 확인된 계정을 직접 만든다 (프로젝트 설정은 안 건드림).
--
-- 로그인 아이디(handle)는 가입 때 정한 닉네임이고 바뀌지 않는다. 화면에 보이는 nick 은 나중에 바꿔도 된다.
-- auth 이메일은 handle 에서 계산한다:  'gs-' || sha256(lower(trim(handle)))[:32] || '@godsaeng.local'
-- 클라이언트(src/services/authService.js)도 같은 식으로 계산해 signInWithPassword 를 부른다.
--
-- 입장코드는 이 파일(공개 저장소)에 넣지 않는다. 실행 후 아래 한 줄을 따로 돌린다:
--   insert into gs_secrets values ('entry_code', '원하는코드')
--     on conflict (key) do update set value = excluded.value;

alter table gs_profiles add column if not exists handle text;
create unique index if not exists gs_profiles_handle_key on gs_profiles (lower(handle));

-- API 로는 아무도 못 읽는 비밀 값 (정책 없음 = 전부 차단). definer 함수만 읽는다.
create table if not exists gs_secrets (
  key   text primary key,
  value text not null
);
alter table gs_secrets enable row level security;
revoke all on gs_secrets from anon, authenticated;

create or replace function gs_login_email(p_handle text)
returns text language sql immutable set search_path = public, extensions as $$
  select 'gs-' || left(encode(digest(lower(trim(p_handle)), 'sha256'), 'hex'), 32) || '@godsaeng.local'
$$;

create or replace function gs_register(p_code text, p_handle text, p_password text, p_emoji text default '🙂')
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_handle text := trim(p_handle);
  v_email  text := gs_login_email(p_handle);
  v_id     uuid := gen_random_uuid();
begin
  if p_code is null or p_code <> coalesce((select value from gs_secrets where key = 'entry_code'), '') then
    raise exception 'bad_code';
  end if;
  if char_length(v_handle) not between 1 and 16 or char_length(coalesce(p_password, '')) < 4 then
    raise exception 'bad_input';
  end if;
  if exists (select 1 from gs_profiles where lower(handle) = lower(v_handle))
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
    v_id, v_handle, v_handle, coalesce(nullif(p_emoji, ''), '🙂'),
    jsonb_build_array(
      jsonb_build_object('id', left(md5(random()::text), 7), 'name', '운동', 'color', 'c3'),
      jsonb_build_object('id', left(md5(random()::text), 7), 'name', '공부', 'color', 'c4'),
      jsonb_build_object('id', left(md5(random()::text), 7), 'name', '생활', 'color', 'c2')
    )
  );
end $$;

-- 탈퇴: 이 앱으로 만든 계정만 지운다 (다른 앱 계정이 실수로 지워지지 않게).
create or replace function gs_delete_me()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users
   where id = auth.uid() and email like 'gs-%@godsaeng.local';
end $$;

revoke all on function gs_register(text, text, text, text) from public;
revoke all on function gs_delete_me() from public, anon;
grant execute on function gs_register(text, text, text, text) to anon, authenticated;
grant execute on function gs_delete_me() to authenticated;
grant execute on function gs_login_email(text) to anon, authenticated;
