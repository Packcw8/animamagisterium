alter table public.item_definitions
  add column if not exists target_mode text not null default 'single_enemy';

alter table public.item_definitions
  drop constraint if exists item_definitions_target_mode_check;

alter table public.item_definitions
  add constraint item_definitions_target_mode_check
  check (target_mode in ('single_enemy', 'all_enemies', 'random_enemy', 'self', 'single_ally', 'all_allies'));

create index if not exists item_definitions_target_mode_idx
  on public.item_definitions(target_mode);
