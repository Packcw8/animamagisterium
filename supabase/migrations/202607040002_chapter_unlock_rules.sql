alter table public.map_chapters
  add column if not exists access_type text not null default 'free',
  add column if not exists unlock_story_flag_key text,
  add column if not exists unlock_story_flag_value boolean not null default true,
  add column if not exists completion_story_flag_key text,
  add column if not exists completion_story_flag_value boolean not null default true,
  add column if not exists transition_title text,
  add column if not exists transition_body text,
  add column if not exists unlock_message text,
  add column if not exists subscription_prompt text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'map_chapters_access_type_check'
      and conrelid = 'public.map_chapters'::regclass
  ) then
    alter table public.map_chapters
      add constraint map_chapters_access_type_check
      check (access_type in ('free', 'story_locked', 'subscription_locked', 'admin_test'));
  end if;
end $$;

update public.map_chapters
set
  access_type = coalesce(access_type, 'free'),
  unlock_story_flag_value = coalesce(unlock_story_flag_value, true),
  completion_story_flag_value = coalesce(completion_story_flag_value, true),
  transition_title = coalesce(transition_title, case when season_number = 1 and chapter_number = 1 then 'Chapter 1 Complete' else transition_title end),
  transition_body = coalesce(transition_body, case when season_number = 1 and chapter_number = 1 then 'The first chapter is complete. The next chapter will unlock when its story and access rules are ready.' else transition_body end)
where season_number = 1
  and chapter_number = 1;

create index if not exists map_chapters_scope_idx
  on public.map_chapters (season_number, chapter_number);

