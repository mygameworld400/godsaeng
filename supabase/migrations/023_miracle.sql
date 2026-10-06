-- 미라클모닝 챌린지
-- 챌린지 종류: 'plan'(플랜 템플릿) | 'miracle'(목표 취침·기상 + 위클리 기록)
-- 미라클모닝 진도(gs_quest_members.progress): { goal: { bed:'23:00', wake:'06:00' }, logs: { 'YYYY-MM-DD': { bed, wake, result:'ok'|'meh'|'fail' } } }
-- 얼굴 캐릭터는 사이트 설정 gs_site.miracle = { default, ok, meh, fail } (관리자 모드에서 올림)

alter table gs_quests add column if not exists kind text not null default 'plan' check (kind in ('plan', 'miracle'));

drop function if exists gs_admin_quest_save(text, text, text, text, text, text, text, int);
create or replace function gs_admin_quest_save(p_code text, p_id text, p_title text, p_description text,
                                               p_template_id text, p_base_id text, p_option_id text, p_sort int, p_kind text default 'plan')
returns text language plpgsql security definer set search_path = public as $$
declare v_id text := coalesce(nullif(p_id, ''), left(md5(random()::text), 8));
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 40 then raise exception 'bad_input'; end if;
  if coalesce(p_kind, 'plan') not in ('plan', 'miracle') then raise exception 'bad_input'; end if;
  insert into gs_quests (id, title, description, template_id, base_id, option_id, sort, kind)
  values (v_id, trim(p_title), coalesce(p_description, ''), nullif(p_template_id, ''), nullif(p_base_id, ''), nullif(p_option_id, ''), coalesce(p_sort, 0), coalesce(p_kind, 'plan'))
  on conflict (id) do update set title = excluded.title, description = excluded.description, template_id = excluded.template_id,
    base_id = excluded.base_id, option_id = excluded.option_id, sort = excluded.sort, kind = excluded.kind;
  return v_id;
end $$;
revoke all on function gs_admin_quest_save(text, text, text, text, text, text, text, int, text) from public;
grant execute on function gs_admin_quest_save(text, text, text, text, text, text, text, int, text) to anon, authenticated;

-- 활동 페이지 종류에 'miracle' (기본 구성 없이 챌린지만)
alter table gs_base_cats drop constraint if exists gs_base_cats_page_kind_check;
alter table gs_base_cats add constraint gs_base_cats_page_kind_check check (page_kind in ('default', 'ledger', 'reading', 'workout', 'media', 'miracle'));

create or replace function gs_admin_base_cat_save(p_code text, p_id text, p_name text, p_icon text, p_color text, p_sort int,
                                                  p_image text default null, p_options jsonb default null, p_kind text default null,
                                                  p_subtitle text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 12 then raise exception 'bad_input'; end if;
  if p_kind is not null and p_kind not in ('default', 'ledger', 'reading', 'workout', 'media', 'miracle') then raise exception 'bad_input'; end if;
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
