alter table public.map_markers
  add column if not exists access_rule text not null default 'always',
  add column if not exists required_item_id uuid references public.item_definitions(id) on delete set null,
  add column if not exists required_item_quantity integer not null default 1,
  add column if not exists access_hint text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'map_markers_access_rule_check'
      and conrelid = 'public.map_markers'::regclass
  ) then
    alter table public.map_markers
      add constraint map_markers_access_rule_check
      check (access_rule in ('always', 'story_flag', 'puzzle_unlock', 'item_required', 'admin_only'));
  end if;
end $$;

update public.map_markers
set
  access_rule = case
    when access_rule is not null and access_rule <> 'always' then access_rule
    when visible_story_flag_key is not null then 'story_flag'
    when is_unlocked = false then 'puzzle_unlock'
    else 'always'
  end,
  required_item_quantity = greatest(1, coalesce(required_item_quantity, 1));

create index if not exists map_markers_access_rule_idx
  on public.map_markers(access_rule);

create index if not exists map_markers_required_item_idx
  on public.map_markers(required_item_id)
  where required_item_id is not null;
