create table if not exists public.arena_battle_slots (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arena_spots(id) on delete cascade,
  slot_type text not null default 'holder_start'
    check (slot_type in ('challenger_start', 'holder_start')),
  label text,
  x_percent numeric not null default 50,
  y_percent numeric not null default 50,
  size_percent numeric not null default 16,
  sort_order integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arena_battle_slots_arena_id_idx
  on public.arena_battle_slots(arena_id, sort_order, created_at);

alter table public.arena_battle_slots enable row level security;

drop policy if exists "arena battle slots are readable" on public.arena_battle_slots;
create policy "arena battle slots are readable"
  on public.arena_battle_slots
  for select
  to authenticated
  using (true);

drop policy if exists "admins manage arena battle slots" on public.arena_battle_slots;
create policy "admins manage arena battle slots"
  on public.arena_battle_slots
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.arena_battle_slots to anon, authenticated;
grant insert, update, delete on public.arena_battle_slots to authenticated;
