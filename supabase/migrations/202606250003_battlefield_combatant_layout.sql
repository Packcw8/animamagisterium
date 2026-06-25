create table if not exists public.battle_event_combatants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.map_events(id) on delete cascade,
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
  created_by uuid references auth.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists battle_event_combatants_event_idx on public.battle_event_combatants(event_id, sort_order);
create index if not exists battle_event_combatants_enemy_idx on public.battle_event_combatants(enemy_id);
create index if not exists battle_event_combatants_npc_idx on public.battle_event_combatants(npc_id);

alter table public.battle_event_combatants enable row level security;

drop policy if exists "Battle layouts are readable" on public.battle_event_combatants;
create policy "Battle layouts are readable"
on public.battle_event_combatants
for select
to authenticated
using (is_active = true or public.is_map_admin());

drop policy if exists "Admins can create battle layouts" on public.battle_event_combatants;
create policy "Admins can create battle layouts"
on public.battle_event_combatants
for insert
to authenticated
with check (public.is_map_admin());

drop policy if exists "Admins can update battle layouts" on public.battle_event_combatants;
create policy "Admins can update battle layouts"
on public.battle_event_combatants
for update
to authenticated
using (public.is_map_admin())
with check (public.is_map_admin());

drop policy if exists "Admins can delete battle layouts" on public.battle_event_combatants;
create policy "Admins can delete battle layouts"
on public.battle_event_combatants
for delete
to authenticated
using (public.is_map_admin());

grant select, insert, update, delete on public.battle_event_combatants to authenticated;
