create table if not exists public.battle_board_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  background_image_url text,
  content_scope text not null default 'chapter',
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.battle_board_templates
  drop constraint if exists battle_board_templates_content_scope_check;

alter table public.battle_board_templates
  add constraint battle_board_templates_content_scope_check
  check (content_scope in ('chapter', 'universal'));

create table if not exists public.battle_board_template_slots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.battle_board_templates(id) on delete cascade,
  side text not null default 'enemy',
  enemy_id uuid references public.enemy_definitions(id) on delete set null,
  npc_id uuid references public.npc_definitions(id) on delete set null,
  label text,
  x_percent numeric not null default 75,
  y_percent numeric not null default 30,
  size_percent numeric not null default 14,
  sort_order integer not null default 1,
  is_boss boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.battle_board_template_slots
  drop constraint if exists battle_board_template_slots_side_check;

alter table public.battle_board_template_slots
  add constraint battle_board_template_slots_side_check
  check (side in ('player', 'companion', 'enemy', 'player_summon', 'enemy_summon'));

create index if not exists battle_board_templates_scope_idx
  on public.battle_board_templates(content_scope, season_number, chapter_number, is_active);

create index if not exists battle_board_template_slots_template_idx
  on public.battle_board_template_slots(template_id, sort_order, created_at);

alter table public.battle_board_templates enable row level security;
alter table public.battle_board_template_slots enable row level security;

grant select on public.battle_board_templates to anon, authenticated;
grant select on public.battle_board_template_slots to anon, authenticated;
grant insert, update, delete on public.battle_board_templates to authenticated;
grant insert, update, delete on public.battle_board_template_slots to authenticated;

drop policy if exists "battle board templates are readable" on public.battle_board_templates;
create policy "battle board templates are readable"
  on public.battle_board_templates
  for select
  using (is_active = true or public.is_map_admin());

drop policy if exists "admins manage battle board templates" on public.battle_board_templates;
create policy "admins manage battle board templates"
  on public.battle_board_templates
  for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "battle board template slots are readable" on public.battle_board_template_slots;
create policy "battle board template slots are readable"
  on public.battle_board_template_slots
  for select
  using (
    exists (
      select 1
      from public.battle_board_templates t
      where t.id = template_id
        and (t.is_active = true or public.is_map_admin())
    )
  );

drop policy if exists "admins manage battle board template slots" on public.battle_board_template_slots;
create policy "admins manage battle board template slots"
  on public.battle_board_template_slots
  for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());
