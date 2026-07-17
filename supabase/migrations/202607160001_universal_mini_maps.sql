alter table public.mini_maps
  add column if not exists content_scope text not null default 'universal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mini_maps_content_scope_check'
      and conrelid = 'public.mini_maps'::regclass
  ) then
    alter table public.mini_maps
      add constraint mini_maps_content_scope_check
      check (content_scope in ('universal', 'chapter'));
  end if;
end $$;

update public.mini_maps
set content_scope = 'universal'
where content_scope is null;

create index if not exists mini_maps_content_scope_idx
  on public.mini_maps(content_scope, season_number, chapter_number);
