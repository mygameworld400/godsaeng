-- 일정: 날짜 없는 일정 허용 + 달력에 숨기기
alter table gs_events alter column start_date drop not null;
alter table gs_events add column if not exists hidden boolean not null default false;
alter table gs_events drop constraint if exists gs_events_dated_end;
alter table gs_events add constraint gs_events_dated_end check (start_date is not null or end_date is null);

-- 다이어리 표지 꾸미기 (본인만): { color, pattern, shape, title, sub }
alter table gs_private add column if not exists diary_cover jsonb not null default '{}';
