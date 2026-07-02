alter table public.item_definitions
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.combat_abilities
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.enemy_definitions
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.npc_definitions
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

create index if not exists item_definitions_season_chapter_idx
  on public.item_definitions(season_number, chapter_number, type, name);

create index if not exists combat_abilities_season_chapter_idx
  on public.combat_abilities(season_number, chapter_number, type, name);

create index if not exists enemy_definitions_season_chapter_idx
  on public.enemy_definitions(season_number, chapter_number, type, name);

create index if not exists npc_definitions_season_chapter_idx
  on public.npc_definitions(season_number, chapter_number, type, name);
