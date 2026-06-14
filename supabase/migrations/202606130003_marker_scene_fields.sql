alter table public.map_markers
  add column if not exists is_interactable boolean not null default true,
  add column if not exists scene_background_image_url text,
  add column if not exists scene_npc_image_url text;
