alter table public.map_markers
  add column if not exists visible_story_flag_key text,
  add column if not exists visible_story_flag_value boolean not null default true;

create index if not exists map_markers_visible_story_flag_idx
  on public.map_markers(visible_story_flag_key)
  where visible_story_flag_key is not null;

update public.map_markers
set
  is_active = true,
  is_unlocked = true,
  is_interactable = true,
  lock_type = 'public',
  lock_message = null,
  visible_story_flag_key = 'missing_princess_campaign_started',
  visible_story_flag_value = true,
  story_order = 0,
  interaction_radius_percent = 100,
  updated_at = now()
where quest_key = 'campaign_missing_princess'
   or lower(coalesce(title, '')) = 'the missing princess';

update public.story_dialogue_choices
set
  action = 'end_conversation',
  unlock_marker_id = null,
  update_notification_title = 'Story Unlocked',
  update_notification_body = 'The Missing Princess is now available.',
  set_story_flag_key = 'missing_princess_campaign_started',
  set_story_flag_value = true,
  choice_group_key = 'mara_missing_princess_lead',
  choice_group_lock_message = 'The Missing Princess lead is already available.',
  hide_when_group_locked = true,
  repeatable = false,
  hide_after_selected = true,
  disable_after_selected = true,
  selected_message = 'The Missing Princess lead is already available.',
  updated_at = now()
where node_id in (
  select id
  from public.story_dialogue_nodes
  where node_key in (
    'mara_ravens_perch_09_commander_thorn',
    'mara_ravens_perch_10_where_to_begin'
  )
)
and (
  lower(button_text) like '%follow%'
  or lower(button_text) like '%commander thorn%'
  or unlock_marker_id is not null
   or set_story_flag_key = 'missing_princess_campaign_started'
);

do $$
declare
  v_mara_marker_id uuid;
  v_mara_npc_id uuid;
  n_repeat uuid;
begin
  select m.id, m.npc_id
  into v_mara_marker_id, v_mara_npc_id
  from public.map_markers m
  where lower(coalesce(m.title, '')) like '%mara%'
     or lower(coalesce(m.description, '')) like '%mara%'
     or lower(coalesce(m.title, '')) like '%raven%perch%'
  order by
    case when lower(coalesce(m.title, '')) like '%mara%' then 0 else 1 end,
    m.created_at
  limit 1;

  if v_mara_marker_id is null then
    raise notice 'Mara repeat dialogue was not created because Mara marker was not found.';
    return;
  end if;

  delete from public.story_dialogue_nodes
  where marker_id = v_mara_marker_id
    and node_key = 'mara_ravens_perch_repeat_after_story_start';

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_mara_marker_id,
      'mara_ravens_perch_repeat_after_story_start',
      'Any News?',
      'Mara',
      v_mara_npc_id,
      $dialogue$Every day another search party leaves.

Every evening they return with another rumor.

If you discover anything...

Commander Thorn should hear it first.$dialogue$,
      false,
      false,
      true,
      false,
      99
    )
  returning id into n_repeat;

  insert into public.story_dialogue_choices
    (node_id, button_text, action, restore_health, restore_stamina, restore_mana, sort_order)
  values
    (n_repeat, 'I''d like to rest.', 'end_conversation', true, true, true, 1);

  insert into public.story_dialogue_choices
    (node_id, button_text, action, sort_order)
  values
    (n_repeat, 'Goodbye.', 'end_conversation', 2);
end $$;
