-- 1) 북·영화 컬렉션 후기: 한줄 후기 + 전체 후기, 공개면 친구도 미니홈피에서 본다
alter table gs_books add column if not exists one_line text not null default '' check (char_length(one_line) <= 80);
alter table gs_books add column if not exists review text not null default '' check (char_length(review) <= 4000);
alter table gs_books add column if not exists public boolean not null default false;
drop policy if exists gs_books_public on gs_books;
create policy gs_books_public on gs_books for select to authenticated using (public and gs_is_member());

-- 2) 오늘의 기분은 일기(본인)에만. 공개 기록(gs_days)에는 일기를 공개한 날만 함께 보인다.
alter table gs_day_private add column if not exists mood text not null default '';
update gs_day_private v set mood = d.mood from gs_days d where d.user_id = v.user_id and d.date = v.date and d.mood <> '' and v.mood = '';
update gs_days set mood = '' where not pub and mood <> '';
