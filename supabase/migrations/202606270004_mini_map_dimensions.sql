alter table public.mini_maps
  add column if not exists width integer not null default 900,
  add column if not exists height integer not null default 650;

update public.mini_maps
set
  width = 900,
  height = 650
where width is null
   or height is null
   or width <= 0
   or height <= 0;
