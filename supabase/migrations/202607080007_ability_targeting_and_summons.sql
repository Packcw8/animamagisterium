alter table public.combat_abilities
  add column if not exists target_mode text not null default 'single_enemy',
  add column if not exists summon_kind text,
  add column if not exists summon_enemy_id uuid references public.enemy_definitions(id) on delete set null,
  add column if not exists summon_npc_id uuid references public.npc_definitions(id) on delete set null,
  add column if not exists summon_count integer not null default 1,
  add column if not exists summon_duration_turns integer not null default 3;

alter table public.combat_abilities
  drop constraint if exists combat_abilities_type_check;

alter table public.combat_abilities
  add constraint combat_abilities_type_check
  check (type in ('attack', 'heal', 'buff', 'debuff', 'defense', 'passive', 'summon', 'conjure'));

alter table public.combat_abilities
  drop constraint if exists combat_abilities_target_mode_check;

alter table public.combat_abilities
  add constraint combat_abilities_target_mode_check
  check (target_mode in ('single_enemy', 'all_enemies', 'random_enemy', 'self', 'all_allies'));

alter table public.combat_abilities
  drop constraint if exists combat_abilities_summon_kind_check;

alter table public.combat_abilities
  add constraint combat_abilities_summon_kind_check
  check (summon_kind is null or summon_kind in ('enemy', 'npc'));

create index if not exists combat_abilities_target_mode_idx
  on public.combat_abilities(target_mode);

create index if not exists combat_abilities_summon_enemy_idx
  on public.combat_abilities(summon_enemy_id);

create index if not exists combat_abilities_summon_npc_idx
  on public.combat_abilities(summon_npc_id);
