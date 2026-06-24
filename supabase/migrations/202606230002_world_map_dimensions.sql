alter table public.world_map_settings
  add column if not exists width integer not null default 1800,
  add column if not exists height integer not null default 1400;

update public.world_map_settings
set width = 1800,
    height = 1400
where width is null
   or height is null
   or width <= 0
   or height <= 0;

notify pgrst, 'reload schema';
