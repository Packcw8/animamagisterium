alter table public.characters
  add column if not exists portrait_thumb_url text;

alter table public.item_definitions
  add column if not exists thumbnail_path text;

alter table public.enemy_definitions
  add column if not exists image_thumb_url text;

alter table public.npc_definitions
  add column if not exists image_thumb_url text;

alter table public.map_markers
  add column if not exists icon_image_thumb_url text,
  add column if not exists quest_image_thumb_url text,
  add column if not exists shop_image_thumb_url text,
  add column if not exists shop_background_image_thumb_url text,
  add column if not exists scene_background_image_thumb_url text,
  add column if not exists scene_npc_image_thumb_url text,
  add column if not exists journal_image_thumb_url text;

alter table public.mini_maps
  add column if not exists background_image_thumb_url text;

alter table public.world_map_settings
  add column if not exists image_thumb_url text,
  add column if not exists draft_image_thumb_url text;

alter table public.combat_abilities
  add column if not exists image_thumb_path text;

alter table public.travel_modes
  add column if not exists image_thumb_url text;

alter table public.mount_definitions
  add column if not exists image_thumb_url text;

drop view if exists public.player_leaderboards;

create view public.player_leaderboards as
with training_totals as (
  select
    character_id,
    count(*)::integer as training_sessions_completed
  from public.training_sessions
  group by character_id
),
event_totals as (
  select
    user_id,
    count(*)::integer as event_completions
  from public.map_event_completions
  group by user_id
),
enemy_kill_totals as (
  select
    character_id,
    sum(kill_count)::integer as total_enemy_kills
  from public.player_enemy_kill_stats
  group by character_id
)
select
  c.id as character_id,
  c.user_id,
  coalesce(p.username, c.name, 'Adventurer') as display_name,
  c.name as character_name,
  c.portrait_url,
  c.portrait_thumb_url,
  c.level,
  c.xp,
  c.gold,
  coalesce(a.strength, 0) as strength,
  coalesce(a.endurance, 0) as endurance,
  coalesce(a.agility, 0) as agility,
  coalesce(a.intelligence, 0) as intelligence,
  coalesce(a.wisdom, 0) as wisdom,
  coalesce(a.charisma, 0) as charisma,
  coalesce(a.spirit, 0) as spirit,
  (
    coalesce(a.strength, 0) +
    coalesce(a.endurance, 0) +
    coalesce(a.agility, 0) +
    coalesce(a.intelligence, 0) +
    coalesce(a.wisdom, 0) +
    coalesce(a.charisma, 0) +
    coalesce(a.spirit, 0)
  ) as attribute_total,
  coalesce(c.total_distance_walked_meters, 0) as total_distance_walked_meters,
  coalesce(tt.training_sessions_completed, 0) as training_sessions_completed,
  coalesce(et.event_completions, 0) as event_completions,
  coalesce(ekt.total_enemy_kills, 0) as total_enemy_kills
from public.characters c
left join public.profiles p on p.id = c.user_id
left join public.attributes a on a.character_id = c.id
left join training_totals tt on tt.character_id = c.id
left join event_totals et on et.user_id = c.user_id
left join enemy_kill_totals ekt on ekt.character_id = c.id;

grant select on public.player_leaderboards to authenticated;
