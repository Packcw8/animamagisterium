-- Correct Harlen marker dialogue flow.
-- This replaces only the dialogue nodes/choices attached to the existing Harlen marker.
-- Final choice sets harlen_following_to_dead_traveler=true and starts Harlen's linked walking path.
-- "Return to the King's Road" is created/fixed as a per-player story-flag-gated marker.
do $$
declare
  v_harlen_marker_id uuid;
  v_return_marker_id uuid;
  v_return_route_id uuid;
  n_step_1 uuid;
  n_step_2 uuid;
  n_step_3 uuid;
  n_step_4 uuid;
  n_step_5 uuid;
  n_step_6a uuid;
  n_step_6b uuid;
  n_step_6c uuid;
  n_step_7 uuid;
begin
  select id
    into v_harlen_marker_id
  from public.map_markers
  where lower(title) like '%harlen%'
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_harlen_marker_id is null then
    raise exception 'Harlen marker was not found. Check the marker title in Admin.';
  end if;

  select id, linked_route_id
    into v_return_marker_id, v_return_route_id
  from public.map_markers
  where lower(title) like '%return%'
    and lower(title) like '%king%'
    and lower(title) like '%road%'
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_return_route_id is null then
    select id
      into v_return_route_id
    from public.map_routes
    where lower(name) like '%king%'
      and lower(name) like '%road%'
    order by sort_order asc nulls last, created_at asc
    limit 1;
  end if;

  if v_return_route_id is null then
    select linked_route_id
      into v_return_route_id
    from public.map_markers
    where id = v_harlen_marker_id;
  end if;

  if v_return_route_id is null then
    raise exception 'No King''s Road walking path was found. Link Harlen or Return to the King''s Road to the intended path in Admin, then rerun this.';
  end if;

  if v_return_marker_id is null then
    insert into public.map_markers (
      type,
      title,
      description,
      x_percent,
      y_percent,
      is_active,
      is_unlocked,
      is_interactable,
      mini_map_id,
      linked_route_id,
      starts_route_on_accept,
      linked_route_start_direction,
      interaction_radius_percent,
      visible_story_flag_key,
      visible_story_flag_value,
      lock_type,
      story_order,
      hide_when_completed,
      require_all_linked_routes,
      season_number,
      chapter_number
    )
    select
      'Story',
      'Return to the King''s Road',
      'Harlen wants to see the dead traveler on the King''s Road.',
      least(98, greatest(2, x_percent + 4)),
      least(98, greatest(2, y_percent + 4)),
      true,
      true,
      true,
      mini_map_id,
      v_return_route_id,
      true,
      'forward',
      100,
      'harlen_following_to_dead_traveler',
      true,
      'public',
      0,
      true,
      false,
      season_number,
      chapter_number
    from public.map_markers
    where id = v_harlen_marker_id
    returning id into v_return_marker_id;
  end if;

  update public.map_markers
    set
      linked_route_id = v_return_route_id,
      starts_route_on_accept = true,
      linked_route_start_direction = 'forward',
      is_active = true,
      is_interactable = true,
      updated_at = now()
    where id = v_harlen_marker_id;

  update public.map_markers
    set
      visible_story_flag_key = 'harlen_following_to_dead_traveler',
      visible_story_flag_value = true,
      is_unlocked = true,
      is_active = true,
      is_interactable = true,
      linked_route_id = v_return_route_id,
      starts_route_on_accept = true,
      linked_route_start_direction = 'forward',
      interaction_radius_percent = 100,
      require_all_linked_routes = false,
      updated_at = now()
    where id = v_return_marker_id;

  delete from public.story_dialogue_nodes
  where marker_id = v_harlen_marker_id;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_start', 'Harlen - Start', 'Harlen',
      'You''re not going to find anything.',
      true, false, false, false, 1)
  returning id into n_step_1;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_who_are_you', 'Who Are You?', 'Harlen',
      'A hunter.',
      false, false, false, false, 2)
  returning id into n_step_2;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_trying_luck', 'Trying My Luck', 'Harlen',
      'Luck''s got nothing to do with it.' || E'\n\n' ||
      'The trail''s gone cold.',
      false, false, false, false, 3)
  returning id into n_step_3;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_searching', 'Searching', 'Harlen',
      'No.' || E'\n\n' ||
      'I''m looking for my brother.' || E'\n\n' ||
      'He rode with her escort.',
      false, false, false, false, 4)
  returning id into n_step_4;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_three_days', 'Three Days', 'Harlen',
      '...' || E'\n\n' ||
      'Could be.' || E'\n\n' ||
      'Could be alive.' || E'\n\n' ||
      'Three days is a long time in these woods.',
      false, false, false, false, 5)
  returning id into n_step_5;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_cold_trail', 'The Cold Trail', 'Harlen',
      'The princess''s trail.' || E'\n\n' ||
      'The escort''s trail.' || E'\n\n' ||
      'Every trail worth following.' || E'\n\n' ||
      'Three days of boots, rain, horses, and fools have buried most of it.',
      false, false, false, false, 6)
  returning id into n_step_6a;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_kings_road', 'The King''s Road', 'Harlen',
      'What did you find?',
      false, false, false, false, 7)
  returning id into n_step_6b;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_what_remains', 'What Remains', 'Harlen',
      'What doesn''t belong.' || E'\n\n' ||
      'A broken branch.' || E'\n\n' ||
      'A quiet bird.' || E'\n\n' ||
      'A track where there shouldn''t be one.' || E'\n\n' ||
      'That''s usually where the truth starts.',
      false, false, false, false, 8)
  returning id into n_step_6c;

  insert into public.story_dialogue_nodes
    (marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (v_harlen_marker_id, 'harlen_show_me', 'Show Me', 'Harlen',
      '...' || E'\n\n' ||
      'Show me.',
      false, true, false, false, 9)
  returning id into n_step_7;

  insert into public.story_dialogue_choices
    (node_id, button_text, player_dialogue_text, action, next_node_id, sort_order)
  values
    (n_step_1, 'Who are you?', 'Who are you?', 'go_to_node', n_step_2, 1),
    (n_step_1, 'Just trying my luck.', 'Just trying my luck.', 'go_to_node', n_step_3, 2),
    (n_step_1, 'Are you searching for the princess?', 'Are you searching for the princess?', 'go_to_node', n_step_4, 3),

    (n_step_2, 'Have you seen the princess?', 'Have you seen the princess?', 'go_to_node', n_step_4, 1),
    (n_step_2, 'Why are you out here alone?', 'Why are you out here alone?', 'go_to_node', n_step_4, 2),

    (n_step_3, 'Are you searching for the princess?', 'Are you searching for the princess?', 'go_to_node', n_step_4, 1),
    (n_step_3, 'What trail?', 'What trail?', 'go_to_node', n_step_6a, 2),

    (n_step_4, 'I''m sorry.', 'I''m sorry.', 'go_to_node', n_step_5, 1),
    (n_step_4, 'You think they''re dead?', 'You think they''re dead?', 'go_to_node', n_step_5, 2),

    (n_step_5, 'Commander Thorn still has hope.', 'Commander Thorn still has hope.', 'go_to_node', n_step_6a, 1),
    (n_step_5, 'I found something on the King''s Road.', 'I found something on the King''s Road.', 'go_to_node', n_step_6b, 2),

    (n_step_6a, 'Then what are you following?', 'Then what are you following?', 'go_to_node', n_step_6c, 1),
    (n_step_6a, 'I found something on the King''s Road.', 'I found something on the King''s Road.', 'go_to_node', n_step_6b, 2),

    (n_step_6c, 'I found something on the King''s Road.', 'I found something on the King''s Road.', 'go_to_node', n_step_6b, 1),
    (n_step_6c, 'I''ll keep looking.', 'I''ll keep looking.', 'end_conversation', null, 2),

    (n_step_6b, 'A dead traveler.', 'A dead traveler. He was leaning against a rock beside the road. I didn''t recognize him. I... didn''t think much of it at the time.', 'go_to_node', n_step_7, 1),
    (n_step_6b, 'Never mind.', 'Never mind.', 'end_conversation', null, 2);

  insert into public.story_dialogue_choices
    (
      node_id,
      button_text,
      player_dialogue_text,
      action,
      next_node_id,
      unlock_marker_id,
      update_notification_title,
      update_notification_body,
      set_story_flag_key,
      set_story_flag_value,
      sort_order
    )
  values
    (
      n_step_7,
      'Take Harlen to the corpse.',
      'Take Harlen to the corpse.',
      'start_quest',
      null,
      v_return_marker_id,
      'Story Updated',
      'Return to the King''s Road is now available.',
      'harlen_following_to_dead_traveler',
      true,
      1
    );
end $$;
