alter table public.battle_event_combatants
  drop constraint if exists battle_event_combatants_side_check;

alter table public.battle_event_combatants
  add constraint battle_event_combatants_side_check
  check (side in ('player', 'companion', 'enemy', 'player_summon', 'enemy_summon'));

alter table public.marker_battle_combatants
  drop constraint if exists marker_battle_combatants_side_check;

alter table public.marker_battle_combatants
  add constraint marker_battle_combatants_side_check
  check (side in ('player', 'companion', 'enemy', 'player_summon', 'enemy_summon'));

create index if not exists battle_event_combatants_summon_anchor_idx
  on public.battle_event_combatants(event_id, side, sort_order)
  where side in ('player_summon', 'enemy_summon');

create index if not exists marker_battle_combatants_summon_anchor_idx
  on public.marker_battle_combatants(marker_id, side, sort_order)
  where side in ('player_summon', 'enemy_summon');
