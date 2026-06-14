alter table public.map_markers
  add column if not exists shop_image_url text,
  add column if not exists shop_background_image_url text,
  add column if not exists interaction_radius_percent numeric not null default 4;
