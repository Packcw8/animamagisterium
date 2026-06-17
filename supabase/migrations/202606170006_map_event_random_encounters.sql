alter table public.map_events
add column if not exists trigger_mode text not null default 'fixed',
add column if not exists random_chance_percent numeric not null default 0;

alter table public.map_events
drop constraint if exists map_events_trigger_mode_check;

alter table public.map_events
add constraint map_events_trigger_mode_check
check (trigger_mode in ('fixed', 'random'));

update public.map_events
set trigger_mode = 'fixed'
where trigger_mode is null;
