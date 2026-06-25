alter table public.story_dialogue_choices
  add column if not exists consume_gold integer not null default 0;

alter table public.map_markers
  add column if not exists dialogue_event_id uuid references public.map_events(id) on delete set null,
  add column if not exists battle_event_id uuid references public.map_events(id) on delete set null;

do $$
declare
  v_route_id uuid;
  v_marker_id uuid;
  n1 uuid;
  n2 uuid;
  n3 uuid;
  n4 uuid;
  n5 uuid;
  n6 uuid;
  n7 uuid;
  n8 uuid;
  n9 uuid;
begin
  select id into v_route_id
  from public.map_routes
  where lower(name) in ('travel to raven''s rest', 'travel to ravens rest')
     or lower(name) like '%raven%rest%'
  order by sort_order, created_at
  limit 1;

  if v_route_id is null then
    insert into public.map_routes (
      name,
      sort_order,
      terrain,
      danger_level,
      distance_required_meters,
      estimated_encounters,
      path_points,
      path_segments,
      image_url,
      mini_map_id,
      parent_marker_id,
      lock_type,
      lock_message,
      season_number,
      chapter_number,
      is_active
    )
    values (
      'Travel to Raven''s Rest',
      1,
      'King''s Road, iron pass, wolf-haunted foothills',
      'Low',
      1609,
      2,
      '[{"x":34,"y":74},{"x":42,"y":70},{"x":52,"y":66},{"x":62,"y":60}]'::jsonb,
      '[]'::jsonb,
      null,
      null,
      null,
      'public',
      null,
      1,
      1,
      true
    )
    returning id into v_route_id;
  end if;

  select id into v_marker_id
  from public.map_markers
  where quest_key = 'campaign_into_forgotten_marches_opening'
     or title = 'Into the Forgotten Marches'
  order by created_at
  limit 1;

  if v_marker_id is null then
    insert into public.map_markers (
      type,
      title,
      description,
      x_percent,
      y_percent,
      is_active,
      is_unlocked,
      is_interactable,
      quest_key,
      interaction_radius_percent,
      reward_xp,
      reward_gold,
      reward_item_quantity,
      reward_full_heal,
      reward_timing,
      repeatable,
      reward_once_per_player,
      linked_route_id,
      starts_route_on_accept,
      icon_label,
      icon_color,
      lock_type,
      lock_message,
      story_order,
      hide_when_completed,
      require_all_linked_routes,
      season_number,
      chapter_number
    )
    values (
      'Story',
      'Into the Forgotten Marches',
      'A Marches Patrol guard questions travelers at Iron Pass Gate.',
      34,
      74,
      true,
      true,
      true,
      'campaign_into_forgotten_marches_opening',
      4,
      0,
      0,
      1,
      false,
      'on_interact',
      false,
      true,
      v_route_id,
      true,
      '!',
      '#d9a441',
      'public',
      null,
      1,
      true,
      false,
      1,
      1
    )
    returning id into v_marker_id;
  else
    update public.map_markers
    set
      type = 'Story',
      title = 'Into the Forgotten Marches',
      description = 'A Marches Patrol guard questions travelers at Iron Pass Gate.',
      quest_key = 'campaign_into_forgotten_marches_opening',
      linked_route_id = v_route_id,
      starts_route_on_accept = true,
      dialogue_event_id = null,
      battle_event_id = null,
      is_active = true,
      is_unlocked = true,
      is_interactable = true,
      repeatable = false,
      reward_once_per_player = true,
      hide_when_completed = true,
      story_order = 1,
      season_number = 1,
      chapter_number = 1,
      updated_at = now()
    where id = v_marker_id;
  end if;

  delete from public.story_dialogue_nodes
  where marker_id = v_marker_id;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_01_gate_question', '01 - Gate Question', 'The Marches Patrol',
    'Halt there, traveler.' || E'\n\n' ||
    'What business brings you to the Forgotten Marches?' || E'\n\n' ||
    'I serve His Majesty, King Aldric Ashbourne, and it is my duty to know who enters the King''s frontier.' || E'\n\n' ||
    'State your business.',
    true, false, false, false, 1)
  returning id into n1;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_02_honest_traveler', '02 - Honest Traveler', 'The Marches Patrol',
    'Then you''ve chosen a hard land to earn an honest living.' || E'\n\n' ||
    'Still... honest folk are welcome in the Marches.' || E'\n\n' ||
    'Raven''s Rest lies just up the King''s Road.' || E'\n\n' ||
    'Mind the wolves, and you''ll likely make it there before dusk.',
    false, false, false, false, 2)
  returning id into n2;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_03_skeptical_traveler', '03 - Skeptical Traveler', 'The Marches Patrol',
    'Careful where you place your trust.' || E'\n\n' ||
    'Taverns are full of men who know how kingdoms should be run.' || E'\n\n' ||
    'Few have ever stood the watch.' || E'\n\n' ||
    'Whatever you''ve heard...' || E'\n\n' ||
    'Judge the Marches with your own eyes.',
    false, false, false, false, 3)
  returning id into n3;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_04_curious_traveler', '04 - Curious Traveler', 'The Marches Patrol',
    'Then see them for yourself.' || E'\n\n' ||
    'The Marches have a way of proving rumors wrong.' || E'\n\n' ||
    'Follow the King''s Road to Raven''s Rest, and keep your eyes open.',
    false, false, false, false, 4)
  returning id into n4;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_05_defiant_traveler', '05 - Defiant Traveler', 'The Marches Patrol',
    'Only those who wish to enter the Marches.' || E'\n\n' ||
    'Answer, or turn back.',
    false, false, false, false, 5)
  returning id into n5;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_06_crown_toll', '06 - Crown Toll', 'The Marches Patrol',
    'Very well.' || E'\n\n' ||
    'One last matter.' || E'\n\n' ||
    'By decree of King Aldric Ashbourne, all who enter the Forgotten Marches must pay the Crown''s road toll.' || E'\n\n' ||
    'Ten gold.',
    false, false, false, false, 6)
  returning id into n6;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_09_begin_journey', '09 - Begin Journey', 'The Marches Patrol',
    'Your toll is paid.' || E'\n\n' ||
    'Head east through Iron Pass. Follow the trail into Raven''s Rest.' || E'\n\n' ||
    'Stay on the road.' || E'\n\n' ||
    'The wolves have changed. Don''t give them a reason to notice you.',
    false, false, false, false, 9)
  returning id into n7;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_07_toll_complaint', '07 - Toll Complaint', 'The Marches Patrol',
    'The roads do not guard themselves.' || E'\n\n' ||
    'Neither do the people who walk them.' || E'\n\n' ||
    'Ten gold.',
    false, false, false, false, 7)
  returning id into n8;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_marker_id, 'forgotten_marches_opening_08_refuse_toll', '08 - Refuse Toll', 'The Marches Patrol',
    'Then you turn back.' || E'\n\n' ||
    'This road belongs to the Crown.',
    false, false, false, false, 8)
  returning id into n9;

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, next_node_id, sort_order)
  values
    (n1, 'I''m just a traveler seeking honest work and a place to rest.', 'I''m just a traveler seeking honest work and a place to rest.', 'go_to_node', n2, 1),
    (n1, 'I''ve come to judge the King''s works for myself. Some say every stone was bought with another man''s coin.', 'I''ve come to judge the King''s works for myself. Some say every stone was bought with another man''s coin.', 'go_to_node', n3, 2),
    (n1, 'I''ve heard much about the Marches. I wanted to see them with my own eyes.', 'I''ve heard much about the Marches. I wanted to see them with my own eyes.', 'go_to_node', n4, 3),
    (n1, 'My business is my own. Does every traveler answer to the Crown?', 'My business is my own. Does every traveler answer to the Crown?', 'go_to_node', n5, 4),
    (n2, 'I''ll keep that in mind.', 'I''ll keep that in mind.', 'go_to_node', n6, 1),
    (n2, 'I''ve handled worse.', 'I''ve handled worse.', 'go_to_node', n6, 2),
    (n3, 'Fair enough.', 'Fair enough.', 'go_to_node', n6, 1),
    (n3, 'We''ll see.', 'We''ll see.', 'go_to_node', n6, 2),
    (n4, 'I will.', 'I will.', 'go_to_node', n6, 1),
    (n4, 'Anything else I should know?', 'Anything else I should know?', 'go_to_node', n6, 2),
    (n5, 'Very well... I''m just passing through.', 'Very well... I''m just passing through.', 'go_to_node', n6, 1),
    (n5, 'Fine. I''ve come to see the Marches for myself.', 'Fine. I''ve come to see the Marches for myself.', 'go_to_node', n6, 2),
    (n5, 'I''ve heard much about the King''s works. I wanted to judge them myself.', 'I''ve heard much about the King''s works. I wanted to judge them myself.', 'go_to_node', n6, 3);

  insert into public.story_dialogue_choices (
    node_id,
    button_text,
    player_dialogue_text,
    action,
    next_node_id,
    reward_xp,
    reward_gold,
    reward_item_quantity,
    consume_gold,
    requirement_type,
    requirement_value,
    requirement_quantity,
    requirement_operator,
    hide_if_unmet,
    disable_if_unmet,
    requirement_failure_message,
    sort_order
  )
  values
    (n6, 'Pay the toll.', 'Pay the toll.', 'go_to_node', n7, 0, 0, 1, 10, 'gold', null, 10, '>=', false, true, 'Requires 10 Gold', 1),
    (n6, 'Ten gold just to enter?', 'Ten gold just to enter?', 'go_to_node', n8, 0, 0, 1, 0, 'none', null, 1, '>=', false, true, null, 2),
    (n6, 'What if I refuse?', 'What if I refuse?', 'go_to_node', n9, 0, 0, 1, 0, 'none', null, 1, '>=', false, true, null, 3),
    (n8, 'Pay the toll.', 'Pay the toll.', 'go_to_node', n7, 0, 0, 1, 10, 'gold', null, 10, '>=', false, true, 'Requires 10 Gold', 1),
    (n9, 'Fine. I''ll pay.', 'Fine. I''ll pay.', 'go_to_node', n7, 0, 0, 1, 10, 'gold', null, 10, '>=', false, true, 'Requires 10 Gold', 1),
    (n7, 'Begin journey to Raven''s Rest.', 'I''ll follow the road.', 'start_quest', null, 0, 0, 1, 0, 'none', null, 1, '>=', false, true, null, 1);
end $$;
