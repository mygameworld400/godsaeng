-- 일정 시간 (선택). 시작 시간만 있거나, 시작~끝 시간.
alter table gs_events add column if not exists start_time time;
alter table gs_events add column if not exists end_time time;
alter table gs_events drop constraint if exists gs_events_time_order;
alter table gs_events add constraint gs_events_time_order check (end_time is null or (start_time is not null and end_time >= start_time));
