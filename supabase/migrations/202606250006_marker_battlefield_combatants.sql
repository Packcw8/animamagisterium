create table if not exists public.marker_battle_combatants (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  side text not null default 'enemy' check (side in ('player', 'companion', 'enemy')),
  enemy_id uuid references public.enemy_definitions(id) on delete set null,
  npc_id uuid references public.npc_definitions(id) on delete set null,
  label text,
  x_percent numeric not null default 75,
  y_percent numeric not null default 30,
  size_percent numeric not null default 14,
  sort_order integer not null default 1,
  is_boss boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists marker_battle_combatants_marker_idx
  on public.marker_battle_combatants(marker_id, sort_order);

create index if not exists marker_battle_combatants_enemy_idx
  on public.marker_battle_combatants(enemy_id);

create index if not exists marker_battle_combatants_npc_idx
  on public.marker_battle_combatants(npc_id);

alter table public.marker_battle_combatants enable row level security;

drop policy if exists "Marker battle layouts are readable" on public.marker_battle_combatants;
create policy "Marker battle layouts are readable"
on public.marker_battle_combatants
for select
to authenticated
using (true);

drop policy if exists "Admins can create marker battle layouts" on public.marker_battle_combatants;
create policy "Admins can create marker battle layouts"
on public.marker_battle_combatants
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update marker battle layouts" on public.marker_battle_combatants;
create policy "Admins can update marker battle layouts"
on public.marker_battle_combatants
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete marker battle layouts" on public.marker_battle_combatants;
create policy "Admins can delete marker battle layouts"
on public.marker_battle_combatants
for delete
to authenticated
using (public.is_admin());

grant select, insert, update, delete on public.marker_battle_combatants to authenticated;
