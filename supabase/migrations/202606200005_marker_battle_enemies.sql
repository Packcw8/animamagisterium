alter table public.map_markers
  add column if not exists enemy_id uuid references public.enemy_definitions(id) on delete set null,
  add column if not exists npc_id uuid references public.npc_definitions(id) on delete set null;

create index if not exists map_markers_enemy_id_idx
  on public.map_markers(enemy_id);

create index if not exists map_markers_npc_id_idx
  on public.map_markers(npc_id);
