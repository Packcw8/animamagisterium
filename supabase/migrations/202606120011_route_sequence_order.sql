alter table public.map_routes
  add column if not exists sort_order integer not null default 1;

with ordered_routes as (
  select
    id,
    row_number() over (order by created_at, id) as next_order
  from public.map_routes
)
update public.map_routes
set sort_order = ordered_routes.next_order
from ordered_routes
where public.map_routes.id = ordered_routes.id;

update public.map_routes
set sort_order = 1
where id = '11111111-1111-4111-8111-111111111111';
