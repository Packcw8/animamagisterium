alter table public.map_markers
  add column if not exists dialogue_event_id uuid references public.map_events(id) on delete set null,
  add column if not exists battle_event_id uuid references public.map_events(id) on delete set null,
  add column if not exists enemy_id uuid references public.enemy_definitions(id) on delete set null,
  add column if not exists npc_id uuid references public.npc_definitions(id) on delete set null;

create index if not exists map_markers_dialogue_event_id_idx
  on public.map_markers(dialogue_event_id);

create index if not exists map_markers_battle_event_id_idx
  on public.map_markers(battle_event_id);

create index if not exists map_markers_enemy_id_idx
  on public.map_markers(enemy_id);

create index if not exists map_markers_npc_id_idx
  on public.map_markers(npc_id);

alter table public.enemy_definitions enable row level security;
alter table public.enemy_abilities enable row level security;
alter table public.enemy_item_drops enable row level security;

grant select, insert, update, delete on public.enemy_definitions to authenticated;
grant select, insert, update, delete on public.enemy_abilities to authenticated;
grant select, insert, update, delete on public.enemy_item_drops to authenticated;

drop policy if exists "enemy_definitions_read" on public.enemy_definitions;
drop policy if exists "enemy_definitions_admin_insert" on public.enemy_definitions;
drop policy if exists "enemy_definitions_admin_update" on public.enemy_definitions;
drop policy if exists "enemy_definitions_admin_delete" on public.enemy_definitions;

create policy "enemy_definitions_read"
  on public.enemy_definitions for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "enemy_definitions_admin_insert"
  on public.enemy_definitions for insert
  to authenticated
  with check (public.is_map_admin());

create policy "enemy_definitions_admin_update"
  on public.enemy_definitions for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "enemy_definitions_admin_delete"
  on public.enemy_definitions for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "enemy_abilities_read" on public.enemy_abilities;
drop policy if exists "enemy_abilities_admin_write" on public.enemy_abilities;
drop policy if exists "enemy_item_drops_read" on public.enemy_item_drops;
drop policy if exists "enemy_item_drops_admin_write" on public.enemy_item_drops;

create policy "enemy_abilities_read"
  on public.enemy_abilities for select
  to authenticated
  using (true);

create policy "enemy_abilities_admin_write"
  on public.enemy_abilities for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "enemy_item_drops_read"
  on public.enemy_item_drops for select
  to authenticated
  using (true);

create policy "enemy_item_drops_admin_write"
  on public.enemy_item_drops for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());
