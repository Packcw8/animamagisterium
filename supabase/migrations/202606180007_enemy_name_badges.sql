alter table public.badge_definitions
  drop constraint if exists badge_definitions_badge_type_check;

alter table public.badge_definitions
  add constraint badge_definitions_badge_type_check
  check (badge_type in ('distance', 'enemy_name_kills', 'enemy_type_kills', 'story_completion', 'training_sessions'));

update public.badge_definitions
set
  badge_type = 'enemy_name_kills',
  description = 'Defeat five Forest Boars.',
  metric_key = null
where title = 'Beast Breaker'
  and badge_type = 'enemy_type_kills';
