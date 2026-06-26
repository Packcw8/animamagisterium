alter table public.map_markers
add column if not exists marker_size numeric not null default 100;

update public.map_markers
set marker_size = 100
where marker_size is null;
