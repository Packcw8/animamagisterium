alter table public.enemy_definitions
  add column if not exists attack_bonus integer not null default 2;

alter table public.npc_definitions
  add column if not exists attack_bonus integer not null default 2;

update public.enemy_definitions
set attack_bonus = 2
where attack_bonus is null;

update public.npc_definitions
set attack_bonus = 2
where attack_bonus is null;
