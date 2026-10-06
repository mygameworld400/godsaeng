-- 활동 플랜 템플릿 (예: 일본어 12주 공부 플랜)
-- 자료(수업·시험·카드)는 공개 저장소에 두지 않고 여기에만 둔다. 가입한 사람(멤버)만 읽는다.
-- 넣고 고치는 건 관리자 코드로만 (scripts/plans/import-japanese.mjs 가 올린다).
-- data 형식은 src/components/PlanViewer.jsx 상단 주석 참고.

create table if not exists gs_plan_templates (
  id         text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  title      text not null check (char_length(title) between 1 and 60),
  summary    text not null default '',
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table gs_plan_templates enable row level security;
drop policy if exists gs_plan_templates_select on gs_plan_templates;
create policy gs_plan_templates_select on gs_plan_templates for select to authenticated using (gs_is_member());

create or replace function gs_admin_plan_save(p_code text, p_id text, p_title text, p_summary text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data->'days') <> 'array' then raise exception 'bad_input'; end if;
  insert into gs_plan_templates (id, title, summary, data, updated_at)
  values (p_id, p_title, coalesce(p_summary, ''), p_data, now())
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, data = excluded.data, updated_at = now();
end $$;

-- 관리자 화면은 로그인 없이 열리므로 목록·내용 조회도 관리자 코드로
create or replace function gs_admin_plan_list(p_code text)
returns table (id text, title text, summary text, days int, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return query select t.id, t.title, t.summary, jsonb_array_length(t.data->'days'), t.updated_at from gs_plan_templates t order by t.updated_at desc;
end $$;

create or replace function gs_admin_plan_get(p_code text, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return (select data from gs_plan_templates where id = p_id);
end $$;

revoke all on function gs_admin_plan_save(text, text, text, text, jsonb) from public;
revoke all on function gs_admin_plan_list(text) from public;
revoke all on function gs_admin_plan_get(text, text) from public;
grant execute on function gs_admin_plan_save(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function gs_admin_plan_list(text) to anon, authenticated;
grant execute on function gs_admin_plan_get(text, text) to anon, authenticated;
