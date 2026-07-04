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
