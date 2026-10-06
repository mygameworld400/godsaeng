-- 기본 카테고리 이미지 아이콘
-- 관리자 모드는 Supabase 로그인 없이 관리자 코드로만 들어가므로 Storage 권한을 걸기 어렵다.
-- 그래서 이미지는 브라우저에서 256px PNG(누끼 제거 후)로 줄인 data URL 을 그대로 저장한다.
-- 사용자 카테고리는 base id 로 원본을 참조해서 그리므로 이미지가 각자 복사되지 않는다.

alter table gs_base_cats add column if not exists image text
  check (image is null or (image like 'data:image/%' and char_length(image) <= 400000));

drop function if exists gs_admin_base_cat_save(text, text, text, text, text, int);

-- p_image: null 이면 그대로, '' 이면 이미지 삭제, 그 외에는 교체
create or replace function gs_admin_base_cat_save(p_code text, p_id text, p_name text, p_icon text, p_color text, p_sort int, p_image text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 12 then raise exception 'bad_input'; end if;
  if p_id is null or p_id = '' then
    insert into gs_base_cats (name, icon, color, sort, image)
    values (trim(p_name), coalesce(nullif(p_icon, ''), '🏷️'), coalesce(nullif(p_color, ''), 'c1'), coalesce(p_sort, 0), nullif(p_image, ''));
  else
    update gs_base_cats
       set name = trim(p_name), icon = coalesce(nullif(p_icon, ''), icon),
           color = coalesce(nullif(p_color, ''), color), sort = coalesce(p_sort, sort),
           image = case when p_image is null then image when p_image = '' then null else p_image end
     where id = p_id;
  end if;
end $$;

revoke all on function gs_admin_base_cat_save(text, text, text, text, text, int, text) from public;
grant execute on function gs_admin_base_cat_save(text, text, text, text, text, int, text) to anon, authenticated;
