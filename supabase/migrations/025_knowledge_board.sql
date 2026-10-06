-- 지식 페이지: 지식 글(관리자) · 형광펜 설명(모두) · 공유 지식/뉴스 게시판 + 댓글(모두) · 지식 퀴즈(관리자)

-- 1) 지식 글. day 가 있으면 그날의 '오늘의 지식', 없으면 둘러보기에만 (오늘 글이 없는 날은 순서대로 돌아감)
create table if not exists gs_knowledge (
  id         uuid primary key default gen_random_uuid(),
  day        date unique,
  category   text not null default '생활' check (char_length(category) between 1 and 20),
  title      text not null check (char_length(title) between 1 and 200),
  summary    text not null default '' check (char_length(summary) <= 1000),
  body       text not null default '' check (char_length(body) <= 20000),          -- 빈 줄로 문단 구분
  key_points jsonb not null default '[]' check (jsonb_typeof(key_points) = 'array'),
  tags       jsonb not null default '[]' check (jsonb_typeof(tags) = 'array'),
  image      text check (image is null or (image like 'data:image/%' and char_length(image) <= 3000000)),
  minutes    int not null default 2 check (minutes between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table gs_knowledge enable row level security;
drop policy if exists gs_knowledge_select on gs_knowledge;
create policy gs_knowledge_select on gs_knowledge for select to authenticated using (gs_is_member());

create or replace function gs_admin_knowledge_save(p_code text, p_id uuid, p_row jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform gs_admin_check(p_code);
  if p_id is null then
    insert into gs_knowledge (day, category, title, summary, body, key_points, tags, image, minutes)
    values (nullif(p_row->>'day', '')::date, coalesce(nullif(p_row->>'category', ''), '생활'), trim(p_row->>'title'),
            coalesce(p_row->>'summary', ''), coalesce(p_row->>'body', ''), coalesce(p_row->'key_points', '[]'),
            coalesce(p_row->'tags', '[]'), nullif(p_row->>'image', ''), coalesce((p_row->>'minutes')::int, 2))
    returning id into v_id;
  else
    update gs_knowledge set day = nullif(p_row->>'day', '')::date, category = coalesce(nullif(p_row->>'category', ''), '생활'),
           title = trim(p_row->>'title'), summary = coalesce(p_row->>'summary', ''), body = coalesce(p_row->>'body', ''),
           key_points = coalesce(p_row->'key_points', '[]'), tags = coalesce(p_row->'tags', '[]'),
           image = nullif(p_row->>'image', ''), minutes = coalesce((p_row->>'minutes')::int, 2), updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  return v_id;
end $$;

create or replace function gs_admin_knowledge_delete(p_code text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  delete from gs_knowledge where id = p_id;
end $$;

-- 2) 형광펜 설명: 글의 문단(para) 안 start 부터 len 글자. quote 는 글이 고쳐졌을 때 다시 찾는 데 쓴다
create table if not exists gs_know_marks (
  id           uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references gs_knowledge(id) on delete cascade,
  user_id      uuid not null references gs_profiles(id) on delete cascade,
  para         int not null check (para >= 0),
  start        int not null check (start >= 0),
  len          int not null check (len between 1 and 500),
  quote        text not null check (char_length(quote) between 1 and 500),
  color        text not null default 'yellow' check (color in ('yellow', 'green', 'blue', 'pink', 'purple', 'orange')),
  note         text not null check (char_length(note) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index if not exists gs_know_marks_k on gs_know_marks (knowledge_id);
alter table gs_know_marks enable row level security;
drop policy if exists gs_know_marks_select on gs_know_marks;
drop policy if exists gs_know_marks_insert on gs_know_marks;
drop policy if exists gs_know_marks_update on gs_know_marks;
drop policy if exists gs_know_marks_delete on gs_know_marks;
create policy gs_know_marks_select on gs_know_marks for select to authenticated using (gs_is_member());
create policy gs_know_marks_insert on gs_know_marks for insert to authenticated with check (user_id = auth.uid() and gs_is_member());
create policy gs_know_marks_update on gs_know_marks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gs_know_marks_delete on gs_know_marks for delete to authenticated using (user_id = auth.uid());

-- 3) 공유 지식(share) · 뉴스 스크랩(news) 게시판 + 댓글. 멤버 모두 읽고, 쓴 사람만 고치거나 지운다
create table if not exists gs_know_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  kind       text not null check (kind in ('share', 'news')),
  category   text not null default '' check (char_length(category) <= 20),
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null default '' check (char_length(body) <= 10000),
  url        text not null default '' check (char_length(url) <= 1000 and (url = '' or url ~* '^https?://')),
  source     text not null default '' check (char_length(source) <= 60),
  image      text check (image is null or (image like 'data:image/%' and char_length(image) <= 3000000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gs_know_posts_kind on gs_know_posts (kind, created_at desc);
alter table gs_know_posts enable row level security;
drop policy if exists gs_know_posts_select on gs_know_posts;
drop policy if exists gs_know_posts_insert on gs_know_posts;
drop policy if exists gs_know_posts_update on gs_know_posts;
drop policy if exists gs_know_posts_delete on gs_know_posts;
create policy gs_know_posts_select on gs_know_posts for select to authenticated using (gs_is_member());
create policy gs_know_posts_insert on gs_know_posts for insert to authenticated with check (user_id = auth.uid() and gs_is_member());
create policy gs_know_posts_update on gs_know_posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gs_know_posts_delete on gs_know_posts for delete to authenticated using (user_id = auth.uid());

create table if not exists gs_know_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references gs_know_posts(id) on delete cascade,
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists gs_know_comments_p on gs_know_comments (post_id, created_at);
alter table gs_know_comments enable row level security;
drop policy if exists gs_know_comments_select on gs_know_comments;
drop policy if exists gs_know_comments_insert on gs_know_comments;
drop policy if exists gs_know_comments_delete on gs_know_comments;
create policy gs_know_comments_select on gs_know_comments for select to authenticated using (gs_is_member());
create policy gs_know_comments_insert on gs_know_comments for insert to authenticated with check (user_id = auth.uid() and gs_is_member());
create policy gs_know_comments_delete on gs_know_comments for delete to authenticated using (user_id = auth.uid());

-- 4) 지식 퀴즈 (관리자가 넣고, 멤버는 읽기만. 각자 푼 기록은 브라우저에)
create table if not exists gs_know_quizzes (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (char_length(question) between 1 and 500),
  choices     jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 5),
  answer      int not null check (answer >= 0),
  explanation text not null default '' check (char_length(explanation) <= 2000),
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table gs_know_quizzes enable row level security;
drop policy if exists gs_know_quizzes_select on gs_know_quizzes;
create policy gs_know_quizzes_select on gs_know_quizzes for select to authenticated using (gs_is_member());

create or replace function gs_admin_quiz_save(p_code text, p_id uuid, p_question text, p_choices jsonb, p_answer int, p_explanation text, p_sort int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform gs_admin_check(p_code);
  if jsonb_typeof(p_choices) <> 'array' or p_answer < 0 or p_answer >= jsonb_array_length(p_choices) then raise exception 'bad_input'; end if;
  if p_id is null then
    insert into gs_know_quizzes (question, choices, answer, explanation, sort)
    values (trim(p_question), p_choices, p_answer, coalesce(p_explanation, ''), coalesce(p_sort, 0)) returning id into v_id;
  else
    update gs_know_quizzes set question = trim(p_question), choices = p_choices, answer = p_answer,
           explanation = coalesce(p_explanation, ''), sort = coalesce(p_sort, 0)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  return v_id;
end $$;

create or replace function gs_admin_quiz_delete(p_code text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  delete from gs_know_quizzes where id = p_id;
end $$;

-- 5) 관리자가 남의 게시글·댓글·형광펜 지우기
create or replace function gs_admin_know_delete(p_code text, p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform gs_admin_check(p_code);
  if p_kind = 'post' then delete from gs_know_posts where id = p_id;
  elsif p_kind = 'comment' then delete from gs_know_comments where id = p_id;
  elsif p_kind = 'mark' then delete from gs_know_marks where id = p_id;
  else raise exception 'bad_input'; end if;
end $$;

-- 6) 백업에 새 표 포함
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
    'gs_quest_members',  (select coalesce(jsonb_agg(t), '[]') from gs_quest_members t),
    'gs_site',           (select coalesce(jsonb_agg(t), '[]') from gs_site t),
    'gs_feedback',       (select coalesce(jsonb_agg(t), '[]') from gs_feedback t),
    'gs_knowledge',      (select coalesce(jsonb_agg(t), '[]') from gs_knowledge t),
    'gs_know_marks',     (select coalesce(jsonb_agg(t), '[]') from gs_know_marks t),
    'gs_know_posts',     (select coalesce(jsonb_agg(t), '[]') from gs_know_posts t),
    'gs_know_comments',  (select coalesce(jsonb_agg(t), '[]') from gs_know_comments t),
    'gs_know_quizzes',   (select coalesce(jsonb_agg(t), '[]') from gs_know_quizzes t)
  );
end $$;
