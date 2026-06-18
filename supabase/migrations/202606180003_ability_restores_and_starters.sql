alter table public.combat_abilities
  add column if not exists stamina_restore integer not null default 0,
  add column if not exists magika_restore integer not null default 0;

alter table public.combat_abilities
  drop constraint if exists combat_abilities_learn_method_check;

alter table public.combat_abilities
  add constraint combat_abilities_learn_method_check
  check (learn_method in ('starter', 'level', 'weapon equipped', 'armor equipped', 'wearable equipped', 'scroll', 'quest', 'admin'));
