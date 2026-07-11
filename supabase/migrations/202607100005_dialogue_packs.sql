create table if not exists public.dialogue_packs (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid references public.map_markers(id) on delete cascade,
  npc_id uuid references public.npc_definitions(id) on delete set null,
  name text not null,
  description text,
  pack_type text not null default 'main',
  content_scope text not null default 'chapter',
  season_number integer,
  chapter_number integer,
  priority integer not null default 0,
  required_story_flag_key text,
  required_story_flag_value boolean not null default true,
  repeatable boolean not null default true,
  is_published boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint dialogue_packs_source_check check (marker_id is not null or npc_id is not null),
  constraint dialogue_packs_type_check check (pack_type in ('main', 'quest', 'ambient', 'repeat', 'fallback')),
  constraint dialogue_packs_content_scope_check check (content_scope in ('chapter', 'universal'))
);

alter table public.story_dialogue_nodes
  add column if not exists dialogue_pack_id uuid references public.dialogue_packs(id) on delete set null;

update public.dialogue_packs
set
  season_number = null,
  chapter_number = null
where content_scope = 'universal';

create index if not exists dialogue_packs_marker_scope_idx
  on public.dialogue_packs(marker_id, content_scope, season_number, chapter_number, priority);

create index if not exists dialogue_packs_npc_scope_idx
  on public.dialogue_packs(npc_id, content_scope, season_number, chapter_number, priority);

create index if not exists story_dialogue_nodes_pack_idx
  on public.story_dialogue_nodes(dialogue_pack_id);

alter table public.dialogue_packs enable row level security;

grant select, insert, update, delete on public.dialogue_packs to authenticated;

drop policy if exists "dialogue_packs_read" on public.dialogue_packs;
drop policy if exists "dialogue_packs_admin_insert" on public.dialogue_packs;
drop policy if exists "dialogue_packs_admin_update" on public.dialogue_packs;
drop policy if exists "dialogue_packs_admin_delete" on public.dialogue_packs;

create policy "dialogue_packs_read"
  on public.dialogue_packs for select
  to authenticated
  using (
    public.is_map_admin()
    or (
      is_active = true
      and is_published = true
      and (
        marker_id is null
        or exists (
          select 1 from public.map_markers
          where map_markers.id = dialogue_packs.marker_id
            and map_markers.is_active = true
        )
      )
    )
  );

create policy "dialogue_packs_admin_insert"
  on public.dialogue_packs for insert
  to authenticated
  with check (public.is_map_admin());

create policy "dialogue_packs_admin_update"
  on public.dialogue_packs for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "dialogue_packs_admin_delete"
  on public.dialogue_packs for delete
  to authenticated
  using (public.is_map_admin());
