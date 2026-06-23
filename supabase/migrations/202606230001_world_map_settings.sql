create table if not exists public.world_map_settings (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  name text not null default 'Overworld Map',
  image_url text,
  draft_image_url text,
  notes text,
  aspect_ratio text not null default 'current',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (season_number, chapter_number)
);

alter table public.world_map_settings enable row level security;

grant select, insert, update, delete on public.world_map_settings to authenticated;

drop policy if exists "world_map_settings_read" on public.world_map_settings;
drop policy if exists "world_map_settings_admin_insert" on public.world_map_settings;
drop policy if exists "world_map_settings_admin_update" on public.world_map_settings;
drop policy if exists "world_map_settings_admin_delete" on public.world_map_settings;

create policy "world_map_settings_read"
  on public.world_map_settings for select
  to authenticated
  using (is_active = true or public.is_admin(auth.uid()));

create policy "world_map_settings_admin_insert"
  on public.world_map_settings for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "world_map_settings_admin_update"
  on public.world_map_settings for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "world_map_settings_admin_delete"
  on public.world_map_settings for delete
  to authenticated
  using (public.is_admin(auth.uid()));

insert into public.world_map_settings (season_number, chapter_number, name, image_url, draft_image_url, notes, aspect_ratio, is_active)
values (1, 1, 'The Forgotten Marches', null, null, 'Uses the bundled default map until an admin publishes a replacement image.', 'current', true)
on conflict (season_number, chapter_number) do nothing;

notify pgrst, 'reload schema';
