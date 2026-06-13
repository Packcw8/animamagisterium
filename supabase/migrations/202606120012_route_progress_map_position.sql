alter table public.route_progress
  add column if not exists current_x_percent numeric,
  add column if not exists current_y_percent numeric;

alter table public.route_progress
  drop constraint if exists route_progress_current_x_percent_check,
  drop constraint if exists route_progress_current_y_percent_check;

alter table public.route_progress
  add constraint route_progress_current_x_percent_check
    check (current_x_percent is null or (current_x_percent >= 0 and current_x_percent <= 100)),
  add constraint route_progress_current_y_percent_check
    check (current_y_percent is null or (current_y_percent >= 0 and current_y_percent <= 100));
