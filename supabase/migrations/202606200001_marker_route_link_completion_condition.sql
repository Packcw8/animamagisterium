alter table public.marker_route_links
  add column if not exists completion_condition text not null default 'either'
    check (completion_condition in ('start', 'end', 'either'));

update public.marker_route_links
set completion_condition = 'either'
where completion_condition is null;
