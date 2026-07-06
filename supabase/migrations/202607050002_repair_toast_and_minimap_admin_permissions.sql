alter table public.mini_maps
  add column if not exists behavior_mode text not null default 'scrollable',
  add column if not exists zoom_enabled boolean not null default false,
  add column if not exists player_avatar_scale numeric not null default 1,
  add column if not exists marker_scale numeric not null default 1,
  add column if not exists entry_toast_title text,
  add column if not exists entry_toast_message text,
  add column if not exists entry_sound_url text,
  add column if not exists entry_video_url text;

update public.mini_maps
set
  behavior_mode = coalesce(nullif(behavior_mode, ''), 'scrollable'),
  zoom_enabled = coalesce(zoom_enabled, false),
  player_avatar_scale = coalesce(player_avatar_scale, 1),
  marker_scale = coalesce(marker_scale, 1);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mini_maps_behavior_mode_check'
      and conrelid = 'public.mini_maps'::regclass
  ) then
    alter table public.mini_maps
      add constraint mini_maps_behavior_mode_check
      check (behavior_mode in ('scrollable', 'follow_player', 'fixed'));
  end if;
end $$;

create table if not exists public.game_toasts (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  trigger_key text,
  title text not null,
  body text not null,
  icon_image_url text,
  sound_url text,
  button_text text not null default 'OK',
  display_once boolean not null default false,
  trigger_condition text,
  sort_order integer not null default 0,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'game_toasts_trigger_type_check'
      and conrelid = 'public.game_toasts'::regclass
  ) then
    alter table public.game_toasts
      add constraint game_toasts_trigger_type_check
      check (trigger_type in (
        'entering_area',
        'leaving_area',
        'starting_path',
        'completing_path',
        'unlocking_marker',
        'completing_chapter',
        'receiving_reward',
        'learning_ability',
        'discovering_npc_enemy',
        'opening_game'
      ));
  end if;
end $$;

alter table public.game_toasts enable row level security;

grant select, insert, update, delete on public.game_toasts to authenticated;

drop policy if exists "game_toasts_read" on public.game_toasts;
drop policy if exists "game_toasts_admin_insert" on public.game_toasts;
drop policy if exists "game_toasts_admin_update" on public.game_toasts;
drop policy if exists "game_toasts_admin_delete" on public.game_toasts;

create policy "game_toasts_read"
  on public.game_toasts for select
  using (is_active = true or public.is_admin());

create policy "game_toasts_admin_insert"
  on public.game_toasts for insert
  with check (public.is_admin());

create policy "game_toasts_admin_update"
  on public.game_toasts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "game_toasts_admin_delete"
  on public.game_toasts for delete
  using (public.is_admin());

create index if not exists game_toasts_lookup_idx
  on public.game_toasts(trigger_type, trigger_key, season_number, chapter_number, is_active, sort_order);
