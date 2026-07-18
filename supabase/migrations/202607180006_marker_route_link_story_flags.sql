alter table public.marker_route_links
  add column if not exists access_rule text not null default 'always',
  add column if not exists required_story_flag_key text,
  add column if not exists required_story_flag_value boolean not null default true,
  add column if not exists lock_message text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marker_route_links_access_rule_check'
      and conrelid = 'public.marker_route_links'::regclass
  ) then
    alter table public.marker_route_links
      add constraint marker_route_links_access_rule_check
      check (access_rule in ('always', 'story_flag'));
  end if;
end $$;

create index if not exists marker_route_links_story_flag_idx
  on public.marker_route_links (required_story_flag_key)
  where required_story_flag_key is not null;

comment on column public.marker_route_links.access_rule is
  'Controls whether this marker-to-route option is always visible or gated by a player story flag.';

comment on column public.marker_route_links.required_story_flag_key is
  'Story flag key required before this linked Travel Hub path appears to the player.';
