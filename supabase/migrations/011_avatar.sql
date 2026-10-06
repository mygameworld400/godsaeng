-- 프로필 이미지 (미니홈피에서 각자 업로드). 브라우저에서 256px 정사각으로 잘라 data URL 로 저장.
-- 친구에게도 보여야 하므로 공개 프로필(gs_profiles)에 둔다.
alter table gs_profiles add column if not exists avatar text
  check (avatar is null or (avatar like 'data:image/%' and char_length(avatar) <= 200000));
