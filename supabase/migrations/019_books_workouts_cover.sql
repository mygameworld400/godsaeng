-- 1) 다이어리 표지를 친구도 볼 수 있게 공개 프로필에도 둔다 (내용은 여전히 본인만)
alter table gs_profiles add column if not exists diary_cover jsonb;
update gs_profiles p set diary_cover = v.diary_cover
  from gs_private v where v.user_id = p.id and v.diary_cover <> '{}' and p.diary_cover is null;

-- 2) 활동 페이지 종류에 독서·운동 추가
alter table gs_base_cats drop constraint if exists gs_base_cats_page_kind_check;
alter table gs_base_cats add constraint gs_base_cats_page_kind_check check (page_kind in ('default', 'ledger', 'reading', 'workout'));

create or replace function gs_admin_base_cat_save(p_code text, p_id text, p_name text, p_icon text, p_color text, p_sort int,
                                                  p_image text default null, p_options jsonb default null, p_kind text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 12 then raise exception 'bad_input'; end if;
  if p_kind is not null and p_kind not in ('default', 'ledger', 'reading', 'workout') then raise exception 'bad_input'; end if;
  if p_options is not null and (jsonb_typeof(p_options) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_options) o
        where char_length(trim(coalesce(o->>'name', ''))) not between 1 and 12
           or coalesce(o->>'id', '') = ''
           or (coalesce(o->>'image', '') <> '' and o->>'image' not like 'data:image/%'))) then
    raise exception 'bad_input';
  end if;
  if p_id is null or p_id = '' then
    insert into gs_base_cats (name, icon, color, sort, image, options, page_kind)
    values (trim(p_name), coalesce(nullif(p_icon, ''), '🏷️'), coalesce(nullif(p_color, ''), 'c1'), coalesce(p_sort, 0),
            nullif(p_image, ''), coalesce(p_options, '[]'), coalesce(p_kind, 'default'));
  else
    update gs_base_cats
       set name = trim(p_name), icon = coalesce(nullif(p_icon, ''), icon),
           color = coalesce(nullif(p_color, ''), color), sort = coalesce(p_sort, sort),
           image = case when p_image is null then image when p_image = '' then null else p_image end,
           options = coalesce(p_options, options),
           page_kind = coalesce(p_kind, page_kind)
     where id = p_id;
  end if;
end $$;

-- 3) 북 컬렉션 (읽은 책). 표지가 없으면 관리자가 넣어 줄 수 있다. 본인만 읽고 쓴다.
create table if not exists gs_books (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  cat_id     text not null,
  title      text not null check (char_length(title) between 1 and 80),
  author     text not null default '' check (char_length(author) <= 60),
  cover      text check (cover is null or (cover like 'data:image/%' and char_length(cover) <= 400000)),
  read_at    date,
  created_at timestamptz not null default now()
);
create index if not exists gs_books_user_idx on gs_books (user_id, cat_id, created_at);
alter table gs_books enable row level security;
drop policy if exists gs_books_own on gs_books;
create policy gs_books_own on gs_books for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 관리자: 표지 없는 책 목록 / 표지 넣기
create or replace function gs_admin_book_requests(p_code text)
returns table (id uuid, title text, author text, nick text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  return query select b.id, b.title, b.author, p.nick, b.created_at
    from gs_books b join gs_profiles p on p.id = b.user_id where b.cover is null order by b.created_at;
end $$;

create or replace function gs_admin_book_cover(p_code text, p_id uuid, p_cover text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if p_cover is null or p_cover not like 'data:image/%' then raise exception 'bad_input'; end if;
  update gs_books set cover = p_cover where id = p_id;
end $$;

-- 4) 운동 일지. 본인만. cat_id = 내 운동 활동 id
create table if not exists gs_workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  cat_id     text not null,
  date       date not null,
  what       text not null check (char_length(what) between 1 and 40),
  minutes    int not null default 0 check (minutes between 0 and 1440),
  memo       text not null default '' check (char_length(memo) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists gs_workouts_user_idx on gs_workouts (user_id, date);
alter table gs_workouts enable row level security;
drop policy if exists gs_workouts_own on gs_workouts;
create policy gs_workouts_own on gs_workouts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on function gs_admin_book_requests(text) from public;
revoke all on function gs_admin_book_cover(text, uuid, text) from public;
grant execute on function gs_admin_book_requests(text) to anon, authenticated;
grant execute on function gs_admin_book_cover(text, uuid, text) to anon, authenticated;

-- 백업에 책·운동 포함
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
    'gs_quest_members',  (select coalesce(jsonb_agg(t), '[]') from gs_quest_members t)
  );
end $$;
