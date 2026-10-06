-- 공개하고 싶은 것만 공개
-- 루틴·투두에 pub 플래그가 생겼다 (기본 비공개). 비공개 항목은 이름이 친구에게 전달되면 안 되므로
-- 친구가 읽는 테이블(gs_profiles, gs_days)에는 공개 항목과 개수만 남기고,
-- 전체 목록은 본인만 읽는 테이블(gs_private, gs_day_private)에 둔다.

alter table gs_profiles add column if not exists r_count int not null default 0;  -- 전체 루틴 개수 (기록 없는 날 분모)

create table if not exists gs_private (
  user_id    uuid primary key references gs_profiles(id) on delete cascade,
  routines   jsonb not null default '[]',   -- [{id,text,cat,pub}] 전체
  updated_at timestamptz not null default now()
);

create table if not exists gs_day_private (
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  date       date not null,
  checks     jsonb not null default '{}',   -- 전체 루틴 체크
  todos      jsonb not null default '[]',   -- 전체 투두
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table gs_private     enable row level security;
alter table gs_day_private enable row level security;
drop policy if exists gs_private_own on gs_private;
drop policy if exists gs_day_private_own on gs_day_private;
create policy gs_private_own     on gs_private     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gs_day_private_own on gs_day_private for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 기존 데이터 옮기기: 전체 목록은 비공개 테이블로, 공개 테이블에서는 이름을 지운다 (기존 항목은 모두 비공개 취급).
insert into gs_private (user_id, routines)
  select id, routines from gs_profiles
  on conflict (user_id) do nothing;
insert into gs_day_private (user_id, date, checks, todos)
  select user_id, date, checks, todos from gs_days
  on conflict (user_id, date) do nothing;
update gs_profiles set r_count = jsonb_array_length(routines), routines = '[]' where routines <> '[]';
update gs_days set checks = '{}', todos = '[]' where checks <> '{}' or todos <> '[]';
