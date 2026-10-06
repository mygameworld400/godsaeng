-- 활동 페이지 종류에 'knowledge'(상식: 오늘의 상식·둘러보기·노트·저장·출석, 전체 화면)
alter table gs_base_cats drop constraint if exists gs_base_cats_page_kind_check;
alter table gs_base_cats add constraint gs_base_cats_page_kind_check check (page_kind in ('default', 'ledger', 'reading', 'workout', 'media', 'miracle', 'knowledge'));

create or replace function gs_admin_base_cat_save(p_code text, p_id text, p_name text, p_icon text, p_color text, p_sort int,
                                                  p_image text default null, p_options jsonb default null, p_kind text default null,
                                                  p_subtitle text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 12 then raise exception 'bad_input'; end if;
  if p_kind is not null and p_kind not in ('default', 'ledger', 'reading', 'workout', 'media', 'miracle', 'knowledge') then raise exception 'bad_input'; end if;
  if char_length(coalesce(p_subtitle, '')) > 20 then raise exception 'bad_input'; end if;
  if p_options is not null and (jsonb_typeof(p_options) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_options) o
        where char_length(trim(coalesce(o->>'name', ''))) not between 1 and 12
           or coalesce(o->>'id', '') = ''
           or (coalesce(o->>'image', '') <> '' and o->>'image' not like 'data:image/%'))) then
    raise exception 'bad_input';
  end if;
  if p_id is null or p_id = '' then
    insert into gs_base_cats (name, icon, color, sort, image, options, page_kind, subtitle)
    values (trim(p_name), coalesce(nullif(p_icon, ''), '🏷️'), coalesce(nullif(p_color, ''), 'c1'), coalesce(p_sort, 0),
            nullif(p_image, ''), coalesce(p_options, '[]'), coalesce(p_kind, 'default'), trim(coalesce(p_subtitle, '')));
  else
    update gs_base_cats
       set name = trim(p_name), icon = coalesce(nullif(p_icon, ''), icon),
           color = coalesce(nullif(p_color, ''), color), sort = coalesce(p_sort, sort),
           image = case when p_image is null then image when p_image = '' then null else p_image end,
           options = coalesce(p_options, options),
           page_kind = coalesce(p_kind, page_kind),
           subtitle = coalesce(trim(p_subtitle), subtitle)
     where id = p_id;
  end if;
end $$;
