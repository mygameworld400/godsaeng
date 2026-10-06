-- 방명록은 남의 홈피에만 쓸 수 있다 (내 홈피에 내가 쓰기 금지)
drop policy if exists gs_cheers_insert on gs_cheers;
create policy gs_cheers_insert on gs_cheers for insert to authenticated
  with check (from_id = auth.uid() and to_id <> auth.uid() and gs_is_member());
