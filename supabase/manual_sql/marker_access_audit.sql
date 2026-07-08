-- Marker access audit.
-- Read-only. Run this in Supabase SQL Editor to find markers whose unlock rules are confusing or broken.

-- 1. Full marker access map.
select
  m.id,
  m.title,
  m.type,
  coalesce(mm.name, 'Overworld') as map_scope,
  m.season_number,
  m.chapter_number,
  m.is_active,
  m.is_unlocked,
  m.is_interactable,
  coalesce(m.access_rule, 'legacy') as access_rule,
  m.lock_type,
  m.lock_message,
  m.visible_story_flag_key,
  m.visible_story_flag_value,
  m.required_item_id,
  item.name as required_item_name,
  m.required_item_quantity,
  m.access_hint,
  m.linked_route_id,
  linked_route.name as linked_route_name,
  m.starts_route_on_accept,
  m.linked_route_start_direction,
  m.story_order,
  m.unlock_after_marker_id,
  unlock_after.title as unlock_after_marker_title,
  m.hide_when_completed,
  count(mrl.id) as route_requirement_count,
  string_agg(req_route.name || ' [' || coalesce(mrl.completion_condition, 'either') || ']', ', ' order by req_route.sort_order, req_route.name) as route_requirements,
  string_agg(p.title, ', ' order by p.title) filter (where p.id is not null) as unlocked_by_puzzles,
  string_agg(c.button_text, ', ' order by c.sort_order, c.button_text) filter (where c.id is not null) as unlocked_by_dialogue_choices
from public.map_markers m
left join public.mini_maps mm on mm.id = m.mini_map_id
left join public.item_definitions item on item.id = m.required_item_id
left join public.map_routes linked_route on linked_route.id = m.linked_route_id
left join public.map_markers unlock_after on unlock_after.id = m.unlock_after_marker_id
left join public.marker_route_links mrl on mrl.marker_id = m.id
left join public.map_routes req_route on req_route.id = mrl.route_id
left join public.puzzle_definitions p on p.unlock_marker_id = m.id
left join public.story_dialogue_choices c on c.unlock_marker_id = m.id
group by
  m.id,
  mm.name,
  item.name,
  linked_route.name,
  unlock_after.title
order by
  map_scope,
  m.season_number,
  m.chapter_number,
  m.type,
  m.story_order,
  m.title;

-- 2. High-signal problems.
with marker_audit as (
  select
    m.*,
    mm.name as mini_map_name,
    linked_route.id is not null as linked_route_exists,
    item.id is not null as required_item_exists,
    unlock_after.id is not null as unlock_after_exists,
    count(mrl.id) as route_requirement_count,
    count(mrl.id) filter (where req_route.id is null) as missing_route_requirement_count,
    count(p.id) as puzzle_unlock_count,
    count(c.id) as dialogue_unlock_count
  from public.map_markers m
  left join public.mini_maps mm on mm.id = m.mini_map_id
  left join public.map_routes linked_route on linked_route.id = m.linked_route_id
  left join public.item_definitions item on item.id = m.required_item_id
  left join public.map_markers unlock_after on unlock_after.id = m.unlock_after_marker_id
  left join public.marker_route_links mrl on mrl.marker_id = m.id
  left join public.map_routes req_route on req_route.id = mrl.route_id
  left join public.puzzle_definitions p on p.unlock_marker_id = m.id
  left join public.story_dialogue_choices c on c.unlock_marker_id = m.id
  group by m.id, mm.name, linked_route.id, item.id, unlock_after.id
)
select
  severity,
  problem,
  id,
  title,
  type,
  coalesce(mini_map_name, 'Overworld') as map_scope,
  access_rule,
  is_unlocked,
  lock_type,
  visible_story_flag_key,
  required_item_id,
  linked_route_id,
  route_requirement_count,
  missing_route_requirement_count,
  puzzle_unlock_count,
  dialogue_unlock_count
from (
  select
    'HIGH' as severity,
    'Story flag marker is still statically locked. Usually set lock_type = public.' as problem,
    *
  from marker_audit
  where visible_story_flag_key is not null
    and lock_type <> 'public'

  union all

  select
    'HIGH' as severity,
    'Access rule is story_flag but no visible_story_flag_key is set.' as problem,
    *
  from marker_audit
  where access_rule = 'story_flag'
    and visible_story_flag_key is null

  union all

  select
    'HIGH' as severity,
    'Marker is hidden but has no puzzle unlock, dialogue unlock, or story flag source.' as problem,
    *
  from marker_audit
  where is_unlocked = false
    and visible_story_flag_key is null
    and puzzle_unlock_count = 0
    and dialogue_unlock_count = 0

  union all

  select
    'HIGH' as severity,
    'Item required marker has no valid required item.' as problem,
    *
  from marker_audit
  where access_rule = 'item_required'
    and (required_item_id is null or required_item_exists = false)

  union all

  select
    'HIGH' as severity,
    'Marker linked_route_id points to a missing route.' as problem,
    *
  from marker_audit
  where linked_route_id is not null
    and linked_route_exists = false

  union all

  select
    'HIGH' as severity,
    'Marker has route requirement links pointing to missing routes.' as problem,
    *
  from marker_audit
  where missing_route_requirement_count > 0

  union all

  select
    'MEDIUM' as severity,
    'Story/NPC/Battle/Sign Post has path requirements. Usually avoid this unless intentional.' as problem,
    *
  from marker_audit
  where route_requirement_count > 0
    and type in ('Story', 'Quest', 'Side Quest', 'NPC', 'Battle', 'Battle Zone', 'Sign Post')

  union all

  select
    'MEDIUM' as severity,
    'Puzzle unlock marker is already globally unlocked and no puzzle points to it.' as problem,
    *
  from marker_audit
  where access_rule = 'puzzle_unlock'
    and is_unlocked = true
    and puzzle_unlock_count = 0
) problems
order by
  case severity when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end,
  map_scope,
  type,
  title;

-- 3. Quick cleanup candidates for your newer simplified rules.
-- Review these rows before changing anything.
select
  id,
  title,
  type,
  coalesce(access_rule, 'legacy') as access_rule,
  lock_type,
  visible_story_flag_key,
  is_unlocked,
  linked_route_id,
  starts_route_on_accept
from public.map_markers
where
  (visible_story_flag_key is not null and lock_type <> 'public')
  or (access_rule = 'story_flag' and visible_story_flag_key is null)
  or (access_rule = 'item_required' and required_item_id is null)
  or (type in ('Story', 'Quest', 'Side Quest', 'NPC', 'Battle', 'Battle Zone', 'Sign Post')
      and exists (select 1 from public.marker_route_links l where l.marker_id = map_markers.id))
order by type, title;
