-- 캘린더 일정 (본인만 보고 쓴다)
-- end_date 가 없으면 하루짜리, 있으면 start~end 연속 (예: 7일~9일 휴가)

create table if not exists gs_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references gs_profiles(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 40),
  start_date date not null,
  end_date   date check (end_date is null or end_date >= start_date),
  color      text not null default 'c4',
  created_at timestamptz not null default now()
);
create index if not exists gs_events_user_idx on gs_events (user_id, start_date);

alter table gs_events enable row level security;
drop policy if exists gs_events_own on gs_events;
create policy gs_events_own on gs_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
