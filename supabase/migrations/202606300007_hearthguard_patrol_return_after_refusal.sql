do $$
declare
  v_patrol_marker_id uuid;
  v_road_story_marker_id uuid;
  n7 uuid;
  n10 uuid;
begin
  select id into v_patrol_marker_id
  from public.map_markers
  where quest_key = 'npc_hearthguard_patrol_opening'
     or lower(coalesce(title, '')) = 'hearthguard patrol'
  order by
    case when quest_key = 'npc_hearthguard_patrol_opening' then 0 else 1 end,
    created_at
  limit 1;

  select id into v_road_story_marker_id
  from public.map_markers
  where quest_key = 'campaign_into_forgotten_marches_opening'
     or lower(coalesce(title, '')) = 'into the forgotten marches'
  order by created_at
  limit 1;

  if v_patrol_marker_id is null or v_road_story_marker_id is null then
    raise notice 'Hearthguard return dialogue was skipped because required markers were not found.';
    return;
  end if;

  select id into n7
  from public.story_dialogue_nodes
  where marker_id = v_patrol_marker_id
    and node_key = 'forgotten_marches_opening_07_toll_paid'
  order by created_at
  limit 1;

  if n7 is null then
    raise notice 'Hearthguard return dialogue was skipped because the toll-paid node was not found.';
    return;
  end if;

  delete from public.story_dialogue_nodes
  where marker_id = v_patrol_marker_id
    and node_key = 'forgotten_marches_opening_10_return_after_refusal';

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_10_return_after_refusal',
      '10 - Returned To The Gate',
      'Hearthguard Patrol',
      $dialogue$Back again.

The old tracks changed your mind, did they?

The King's Road is still open to those who pay the toll.

Ten gold, same as before.$dialogue$,
      false,
      false,
      false,
      false,
      10
    )
  returning id into n10;

  insert into public.story_dialogue_choices (
    node_id,
    button_text,
    player_dialogue_text,
    action,
    next_node_id,
    consume_gold,
    requirement_type,
    requirement_quantity,
    requirement_operator,
    hide_if_unmet,
    disable_if_unmet,
    requirement_failure_message,
    unlock_marker_id,
    update_notification_title,
    update_notification_body,
    set_story_flag_key,
    set_story_flag_value,
    repeatable,
    hide_after_selected,
    disable_after_selected,
    selected_message,
    sort_order
  )
  values
    (
      n10,
      'Pay the 10 gold toll.',
      'I changed my mind. I will pay.',
      'go_to_node',
      n7,
      10,
      'gold',
      10,
      '>=',
      false,
      true,
      'Requires 10 Gold',
      v_road_story_marker_id,
      'Story Unlocked',
      'Into the Forgotten Marches is now available.',
      'iron_pass_toll_paid',
      true,
      false,
      true,
      true,
      'You have already paid the toll.',
      1
    ),
    (
      n10,
      'I will stay off the road.',
      'I will stay off the road.',
      'end_conversation',
      null,
      0,
      'none',
      1,
      '>=',
      false,
      true,
      null,
      null,
      null,
      null,
      null,
      true,
      true,
      true,
      false,
      null,
      2
    );
end $$;
