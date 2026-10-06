-- 관리자 삭제 수정
-- 갓생홈피와 미니홈은 같은 출처(mygameworld400.github.io)라 예전엔 브라우저의 Supabase 로그인이 공유됐다.
-- 그래서 미니홈 계정으로 갓생홈피 프로필이 만들어진 경우가 있다 (handle 이 비어 있음).
-- 이런 "다른 앱 계정"은 auth 계정은 두고 갓생홈피 데이터(gs_profiles → cascade)만 지운다.
-- 지운 게 없으면 조용히 넘어가지 않고 not_found 를 낸다.

drop function if exists gs_admin_list(text);
create or replace function gs_admin_list(p_code text)
returns table (id uuid, login text, nick text, emoji text, created_at timestamptz, last_sign_in_at timestamptz, other_app boolean)
language plpgsql security definer set search_path = public, auth as $$
begin
  perform gs_admin_check(p_code);
  return query
    select p.id, p.handle, p.nick, p.emoji, p.created_at, u.last_sign_in_at,
           (u.email is null or u.email not like 'gs-%@godsaeng.local')
      from gs_profiles p left join auth.users u on u.id = p.id
     order by p.created_at;
end $$;

create or replace function gs_admin_delete(p_code text, p_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  perform gs_admin_check(p_code);
  if not exists (select 1 from gs_profiles where id = p_id) then raise exception 'not_found'; end if;

  -- 갓생홈피로 만든 계정이면 auth 계정째 삭제 (기록은 cascade)
  delete from auth.users where id = p_id and email like 'gs-%@godsaeng.local';
  get diagnostics n = row_count;
  -- 다른 앱 계정이면 갓생홈피 데이터만 삭제
  if n = 0 then
    delete from gs_profiles where id = p_id;
  end if;
end $$;

revoke all on function gs_admin_list(text) from public;
grant execute on function gs_admin_list(text) to anon, authenticated;

-- 다른 앱 계정은 아이디·비밀번호를 못 바꾼다 (바꾸면 그 앱 로그인이 깨진다). 닉네임만 허용.
create or replace function gs_admin_update(p_code text, p_id uuid, p_login text, p_nick text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_login text := lower(trim(coalesce(p_login, '')));
  v_ours  boolean := exists (select 1 from auth.users where id = p_id and email like 'gs-%@godsaeng.local');
begin
  perform gs_admin_check(p_code);
  if not exists (select 1 from gs_profiles where id = p_id) then raise exception 'not_found'; end if;

  if v_login <> '' and v_login is distinct from (select lower(handle) from gs_profiles where id = p_id) then
    if not v_ours then raise exception 'other_app'; end if;
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
    if not v_ours then raise exception 'other_app'; end if;
    if char_length(p_password) < 4 then raise exception 'bad_input'; end if;
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_id;
  end if;
end $$;
