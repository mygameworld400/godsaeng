-- 오늘도 해냄 (godsaeng) 스키마
-- 공용 Supabase 프로젝트(grxmlgapajpwowoztuwl)를 메롱(cc_)·미니홈(mh_)·패션아카이브(fa_)와 같이 쓴다.
-- 테이블·함수·정책 이름은 전부 gs_ 접두사. 다른 앱 테이블은 건드리지 않는다.
-- auth.users 도 공유되므로 "로그인했다"만으로는 권한을 주지 않고,
-- gs_profiles 에 행이 있는 사람(= 이 앱에서 닉네임을 정한 사람)만 서로의 기록을 본다.

create extension if not exists pgcrypto;

-- ---------- 테이블 ----------

create table if not exists gs_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nick       text not null check (char_length(nick) between 1 and 16),
  emoji      text not null default '🙂',
  bio        text not null default '',
  cats       jsonb not null default '[]',   -- [{id,name,color}]
  routines   jsonb not null default '[]',   -- [{id,text,cat}]
  friends    uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 하루 기록. 친구가 미니홈피에서 보므로 멤버에게 공개된다.
-- diary 는 pub=true 일 때만 채운다 (비공개 일기는 gs_diaries).
create table if not exists gs_days (
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  date       date not null,
  checks     jsonb not null default '{}',   -- {routineId: true}
  todos      jsonb not null default '[]',   -- [{id,text,cat,done}]
  mood       text not null default '',
  pub        boolean not null default false,
  diary      text not null default '',
  r_total    int not null default 0,
  r_done     int not null default 0,
  t_total    int not null default 0,
  t_done     int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- 일기 원문. 본인만 읽고 쓴다.
create table if not exists gs_diaries (
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  date       date not null,
  text       text not null default '' check (char_length(text) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists gs_cheers (
  id         uuid primary key default gen_random_uuid(),
  to_id      uuid not null references gs_profiles(id) on delete cascade,
  from_id    uuid not null references gs_profiles(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists gs_cheers_to_idx on gs_cheers (to_id, created_at desc);

-- 내기. members = {uid: 'in'|'invited'|'out'}, checks = {uid: {'YYYY-MM-DD': bool}}
create table if not exists gs_challenges (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 30),
  penalty    text not null default '',
  by_id      uuid not null references gs_profiles(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  members    jsonb not null default '{}',
  checks     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- 함수 ----------

-- 정책 안에서 gs_profiles 를 다시 조회하면 재귀가 나므로 security definer 로 뺀다.
create or replace function gs_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from gs_profiles where id = auth.uid())
$$;

-- 내기 참가/거절/나가기: 내 키만 바꾼다.
create or replace function gs_bet_set_member(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('in', 'out') then raise exception 'bad status'; end if;
  update gs_challenges
     set members = jsonb_set(members, array[auth.uid()::text], to_jsonb(p_status))
   where id = p_id and members ? auth.uid()::text;
end $$;

-- 오늘 인증 on/off: 참가 중일 때 내 체크만 바꾼다.
create or replace function gs_bet_check(p_id uuid, p_date date, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare k text := auth.uid()::text;
begin
  update gs_challenges
     set checks = jsonb_set(checks, array[k],
                   coalesce(checks -> k, '{}') || jsonb_build_object(p_date::text, p_on))
   where id = p_id and members ->> k = 'in'
     and p_date between start_date and end_date;
end $$;

revoke all on function gs_bet_set_member(uuid, text) from public, anon;
revoke all on function gs_bet_check(uuid, date, boolean) from public, anon;
grant execute on function gs_bet_set_member(uuid, text) to authenticated;
grant execute on function gs_bet_check(uuid, date, boolean) to authenticated;
grant execute on function gs_is_member() to authenticated;

-- ---------- RLS ----------

alter table gs_profiles   enable row level security;
alter table gs_days       enable row level security;
alter table gs_diaries    enable row level security;
alter table gs_cheers     enable row level security;
alter table gs_challenges enable row level security;

drop policy if exists gs_profiles_select on gs_profiles;
drop policy if exists gs_profiles_insert on gs_profiles;
drop policy if exists gs_profiles_update on gs_profiles;
drop policy if exists gs_profiles_delete on gs_profiles;
create policy gs_profiles_select on gs_profiles for select to authenticated using (id = auth.uid() or gs_is_member());
create policy gs_profiles_insert on gs_profiles for insert to authenticated with check (id = auth.uid());
create policy gs_profiles_update on gs_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy gs_profiles_delete on gs_profiles for delete to authenticated using (id = auth.uid());

drop policy if exists gs_days_select on gs_days;
drop policy if exists gs_days_write on gs_days;
create policy gs_days_select on gs_days for select to authenticated using (gs_is_member());
create policy gs_days_write  on gs_days for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gs_diaries_own on gs_diaries;
create policy gs_diaries_own on gs_diaries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gs_cheers_select on gs_cheers;
drop policy if exists gs_cheers_insert on gs_cheers;
drop policy if exists gs_cheers_delete on gs_cheers;
create policy gs_cheers_select on gs_cheers for select to authenticated using (gs_is_member());
create policy gs_cheers_insert on gs_cheers for insert to authenticated with check (from_id = auth.uid() and gs_is_member());
create policy gs_cheers_delete on gs_cheers for delete to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-- 내기 수정은 위 두 함수로만 한다 (update 정책 없음).
drop policy if exists gs_challenges_select on gs_challenges;
drop policy if exists gs_challenges_insert on gs_challenges;
drop policy if exists gs_challenges_delete on gs_challenges;
create policy gs_challenges_select on gs_challenges for select to authenticated using (members ? auth.uid()::text);
create policy gs_challenges_insert on gs_challenges for insert to authenticated with check (by_id = auth.uid() and members ->> auth.uid()::text = 'in');
create policy gs_challenges_delete on gs_challenges for delete to authenticated using (by_id = auth.uid());
