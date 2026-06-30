alter table public.story_dialogue_choices
  add column if not exists consume_gold integer not null default 0,
  add column if not exists unlock_marker_id uuid references public.map_markers(id) on delete set null,
  add column if not exists update_notification_title text,
  add column if not exists update_notification_body text,
  add column if not exists choice_group_key text,
  add column if not exists choice_group_lock_message text,
  add column if not exists hide_when_group_locked boolean not null default false,
  add column if not exists set_story_flag_key text,
  add column if not exists set_story_flag_value boolean not null default true,
  add column if not exists repeatable boolean not null default true,
  add column if not exists hide_after_selected boolean not null default false,
  add column if not exists disable_after_selected boolean not null default false,
  add column if not exists selected_message text;

alter table public.map_markers
  add column if not exists dialogue_event_id uuid references public.map_events(id) on delete set null,
  add column if not exists battle_event_id uuid references public.map_events(id) on delete set null,
  add column if not exists visible_story_flag_key text,
  add column if not exists visible_story_flag_value boolean not null default true;

do $$
declare
  v_road_route_id uuid;
  v_avoid_route_id uuid;
  v_patrol_marker_id uuid;
  v_road_story_marker_id uuid;
  v_avoid_story_marker_id uuid;
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
  select id into v_road_route_id
  from public.map_routes
  where lower(name) in ('travel to raven''s rest', 'travel to ravens rest', 'iron watch pass to raven''s rest')
     or lower(name) like '%raven%rest%'
  order by sort_order, created_at
  limit 1;

  if v_road_route_id is null then
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
      'Iron Watch Pass to Raven''s Rest',
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
    returning id into v_road_route_id;
  end if;

  select id into v_avoid_route_id
  from public.map_routes
  where lower(name) in ('avoid the toll', 'avoid the toll route', 'around iron pass')
     or lower(name) like '%avoid%toll%'
  order by sort_order, created_at
  limit 1;

  if v_avoid_route_id is null then
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
      'Avoid the Toll',
      1,
      'Steep woodland, hidden goat tracks, Crown patrols',
      'High',
      3219,
      4,
      '[{"x":32,"y":76},{"x":28,"y":70},{"x":31,"y":63},{"x":42,"y":58},{"x":56,"y":59}]'::jsonb,
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
    returning id into v_avoid_route_id;
  end if;

  select id into v_patrol_marker_id
  from public.map_markers
  where quest_key = 'npc_hearthguard_patrol_opening'
     or lower(coalesce(title, '')) = 'hearthguard patrol'
     or lower(coalesce(title, '')) = 'the marches patrol'
  order by
    case
      when quest_key = 'npc_hearthguard_patrol_opening' then 0
      when lower(coalesce(title, '')) = 'hearthguard patrol' then 1
      else 2
    end,
    created_at
  limit 1;

  if v_patrol_marker_id is null then
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
      'NPC',
      'Hearthguard Patrol',
      'A Crown road guard watches the entrance into the Forgotten Marches.',
      34,
      74,
      true,
      true,
      true,
      'npc_hearthguard_patrol_opening',
      4,
      0,
      0,
      1,
      'on_interact',
      false,
      true,
      null,
      false,
      'G',
      '#d9a441',
      'public',
      null,
      0,
      false,
      false,
      1,
      1
    )
    returning id into v_patrol_marker_id;
  else
    update public.map_markers
    set
      type = 'NPC',
      title = 'Hearthguard Patrol',
      description = 'A Crown road guard watches the entrance into the Forgotten Marches.',
      quest_key = 'npc_hearthguard_patrol_opening',
      is_active = true,
      is_unlocked = true,
      is_interactable = true,
      linked_route_id = null,
      starts_route_on_accept = false,
      dialogue_event_id = null,
      battle_event_id = null,
      visible_story_flag_key = null,
      visible_story_flag_value = true,
      lock_type = 'public',
      lock_message = null,
      repeatable = false,
      reward_once_per_player = true,
      hide_when_completed = false,
      story_order = 0,
      season_number = 1,
      chapter_number = 1,
      updated_at = now()
    where id = v_patrol_marker_id;
  end if;

  select id into v_road_story_marker_id
  from public.map_markers
  where quest_key = 'campaign_into_forgotten_marches_opening'
     or lower(coalesce(title, '')) = 'into the forgotten marches'
  order by created_at
  limit 1;

  if v_road_story_marker_id is null then
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
      visible_story_flag_key,
      visible_story_flag_value,
      season_number,
      chapter_number
    )
    values (
      'Story',
      'Into the Forgotten Marches',
      'The Crown road into the Forgotten Marches lies open.',
      36,
      73,
      true,
      true,
      true,
      'campaign_into_forgotten_marches_opening',
      100,
      0,
      0,
      1,
      'on_interact',
      false,
      true,
      v_road_route_id,
      true,
      '!',
      '#d9a441',
      'story_locked',
      'Speak with the Hearthguard Patrol at Iron Pass.',
      1,
      true,
      false,
      'iron_pass_toll_paid',
      true,
      1,
      1
    )
    returning id into v_road_story_marker_id;
  else
    update public.map_markers
    set
      type = 'Story',
      title = 'Into the Forgotten Marches',
      description = 'The Crown road into the Forgotten Marches lies open.',
      quest_key = 'campaign_into_forgotten_marches_opening',
      linked_route_id = v_road_route_id,
      starts_route_on_accept = true,
      dialogue_event_id = null,
      battle_event_id = null,
      is_active = true,
      is_unlocked = true,
      is_interactable = true,
      interaction_radius_percent = greatest(coalesce(interaction_radius_percent, 4), 100),
      visible_story_flag_key = 'iron_pass_toll_paid',
      visible_story_flag_value = true,
      lock_type = 'story_locked',
      lock_message = 'Speak with the Hearthguard Patrol at Iron Pass.',
      repeatable = false,
      reward_once_per_player = true,
      hide_when_completed = true,
      require_all_linked_routes = false,
      story_order = 1,
      season_number = 1,
      chapter_number = 1,
      updated_at = now()
    where id = v_road_story_marker_id;
  end if;

  select id into v_avoid_story_marker_id
  from public.map_markers
  where quest_key = 'campaign_avoid_the_toll'
     or lower(coalesce(title, '')) = 'avoid the toll'
  order by created_at
  limit 1;

  if v_avoid_story_marker_id is null then
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
      visible_story_flag_key,
      visible_story_flag_value,
      season_number,
      chapter_number
    )
    values (
      'Story',
      'Avoid the Toll',
      'A dangerous way around Iron Pass avoids the Crown road.',
      31,
      75,
      true,
      true,
      true,
      'campaign_avoid_the_toll',
      100,
      0,
      0,
      1,
      'on_interact',
      false,
      true,
      v_avoid_route_id,
      true,
      '!',
      '#f0a0a0',
      'story_locked',
      'Refuse the Hearthguard Patrol toll to find another route.',
      1,
      true,
      false,
      'iron_pass_toll_avoided',
      true,
      1,
      1
    )
    returning id into v_avoid_story_marker_id;
  else
    update public.map_markers
    set
      type = 'Story',
      title = 'Avoid the Toll',
      description = 'A dangerous way around Iron Pass avoids the Crown road.',
      quest_key = 'campaign_avoid_the_toll',
      linked_route_id = v_avoid_route_id,
      starts_route_on_accept = true,
      dialogue_event_id = null,
      battle_event_id = null,
      is_active = true,
      is_unlocked = true,
      is_interactable = true,
      interaction_radius_percent = greatest(coalesce(interaction_radius_percent, 4), 100),
      visible_story_flag_key = 'iron_pass_toll_avoided',
      visible_story_flag_value = true,
      lock_type = 'story_locked',
      lock_message = 'Refuse the Hearthguard Patrol toll to find another route.',
      repeatable = false,
      reward_once_per_player = true,
      hide_when_completed = true,
      require_all_linked_routes = false,
      story_order = 1,
      season_number = 1,
      chapter_number = 1,
      updated_at = now()
    where id = v_avoid_story_marker_id;
  end if;

  delete from public.story_dialogue_nodes
  where marker_id = v_patrol_marker_id;

  delete from public.story_dialogue_nodes
  where marker_id in (v_road_story_marker_id, v_avoid_story_marker_id)
    and node_key like 'forgotten_marches_opening_%';

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_01_gate_question',
      '01 - Gate Question',
      'Hearthguard Patrol',
      $dialogue$Halt there, traveler.

By order of King Aldric Ashbourne, every name entering the Forgotten Marches is written in the ledger.

Name.

Business.

Where have you come from?

Anyone traveling with you?$dialogue$,
      true,
      false,
      false,
      false,
      1
    )
  returning id into n1;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_02_work',
      '02 - Looking For Work',
      'Hearthguard Patrol',
      $dialogue$Very well.

The King always has need of hard workers in the Marches.

Road hands. Stable hands. Hunters. Folk who know how to keep moving.

The closest town is Raven's Rest.

You'll find work there if work is truly what you're after.$dialogue$,
      false,
      false,
      false,
      false,
      2
    )
  returning id into n2;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_03_questions',
      '03 - Questions',
      'Hearthguard Patrol',
      $dialogue$No.

Three mornings ago we started.

Haven't stopped since.

Orders changed. Every traveler answers. Every wagon is searched. Every name goes in the ledger.

That's all you need to know.$dialogue$,
      false,
      false,
      false,
      false,
      3
    )
  returning id into n3;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_04_crown',
      '04 - Crown Skeptic',
      'Hearthguard Patrol',
      $dialogue$Careful where you place your trust.

Taverns are full of men who know how kingdoms should be run.

Few have ever stood the watch.

Whatever you've heard, keep your voice measured at this gate.

The roads are being checked closely, and I have little patience for loose talk.$dialogue$,
      false,
      false,
      false,
      false,
      4
    )
  returning id into n4;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_05_nearest_town',
      '05 - Nearest Town',
      'Hearthguard Patrol',
      $dialogue$Raven's Rest.

Follow the King's Road through Iron Pass and keep east until the smoke from the town chimneys shows over the trees.

It is not far if you stay on the road.$dialogue$,
      false,
      false,
      false,
      false,
      5
    )
  returning id into n5;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_06_crown_toll',
      '06 - Crown Toll',
      'Hearthguard Patrol',
      $dialogue$One last matter.

The Crown maintains the pass, the patrols, and the road stones beneath your boots.

Ten gold for passage into the Forgotten Marches.$dialogue$,
      false,
      false,
      false,
      false,
      6
    )
  returning id into n6;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_07_toll_paid',
      '07 - Toll Paid',
      'Hearthguard Patrol',
      $dialogue$Your toll is paid.

Head east through Iron Pass. Follow the road to Raven's Rest.

Stay on the road.

The Marches have grown less forgiving than they look.$dialogue$,
      false,
      true,
      false,
      false,
      7
    )
  returning id into n7;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_08_toll_questioned',
      '08 - Toll Questioned',
      'Hearthguard Patrol',
      $dialogue$The roads do not guard themselves.

Neither do the people who walk them.

You can pay the toll and use the King's Road, or you can turn around.

Ten gold.$dialogue$,
      false,
      false,
      false,
      false,
      8
    )
  returning id into n8;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (
      null,
      v_patrol_marker_id,
      'forgotten_marches_opening_09_refuse_toll',
      '09 - Refuse Toll',
      'Hearthguard Patrol',
      $dialogue$Then you do not pass this road.

There are old tracks through the trees if you're foolish enough to trust them.

Longer walk. Worse footing. Fewer patrols.

And if something finds you out there, it will not ask for your name first.$dialogue$,
      false,
      true,
      false,
      false,
      9
    )
  returning id into n9;

  insert into public.story_dialogue_choices
    (node_id, button_text, player_dialogue_text, action, next_node_id, sort_order)
  values
    (n1, 'I''ve come looking for work.', 'I''ve come looking for work.', 'go_to_node', n2, 1),
    (n1, 'I''ve come to judge the King''s works for myself. Some say every stone was bought with another man''s coin.', 'I''ve come to judge the King''s works for myself. Some say every stone was bought with another man''s coin.', 'go_to_node', n4, 2),
    (n1, 'Do you question everyone entering like this?', 'Do you question everyone entering like this?', 'go_to_node', n3, 3),
    (n1, 'I''m looking for the nearest town.', 'I''m looking for the nearest town.', 'go_to_node', n5, 4),
    (n2, 'I understand.', 'I understand.', 'go_to_node', n6, 1),
    (n3, 'Fine. I''ve answered enough.', 'Fine. I''ve answered enough.', 'go_to_node', n6, 1),
    (n4, 'I''ll keep my voice measured.', 'I''ll keep my voice measured.', 'go_to_node', n6, 1),
    (n5, 'Then I''ll take the road.', 'Then I''ll take the road.', 'go_to_node', n6, 1),
    (n6, 'Why is there a toll?', 'Why is there a toll?', 'go_to_node', n8, 2),
    (n6, 'What if I refuse?', 'What if I refuse?', 'go_to_node', n9, 3),
    (n8, 'And if I still refuse?', 'And if I still refuse?', 'go_to_node', n9, 2);

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
    choice_group_key,
    choice_group_lock_message,
    hide_when_group_locked,
    repeatable,
    hide_after_selected,
    disable_after_selected,
    selected_message,
    sort_order
  )
  values
    (
      n6,
      'Pay the 10 gold toll.',
      'Pay the toll.',
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
      'iron_pass_toll_decision',
      'You have already chosen how to pass Iron Watch.',
      true,
      false,
      true,
      true,
      'You have already paid the toll.',
      1
    ),
    (
      n8,
      'Pay the 10 gold toll.',
      'Pay the toll.',
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
      'iron_pass_toll_decision',
      'You have already chosen how to pass Iron Watch.',
      true,
      false,
      true,
      true,
      'You have already paid the toll.',
      1
    ),
    (
      n9,
      'Find another way around the pass.',
      'I''ll find another way around.',
      'end_conversation',
      null,
      0,
      'none',
      1,
      '>=',
      false,
      true,
      null,
      v_avoid_story_marker_id,
      'Story Unlocked',
      'Avoid the Toll is now available.',
      'iron_pass_toll_avoided',
      true,
      'iron_pass_toll_decision',
      'You have already chosen how to pass Iron Watch.',
      true,
      false,
      true,
      true,
      'You already chose the dangerous way around.',
      1
    ),
    (
      n9,
      'Fine. I''ll pay the toll.',
      'Fine. I''ll pay the toll.',
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
      'iron_pass_toll_decision',
      'You have already chosen how to pass Iron Watch.',
      true,
      false,
      true,
      true,
      'You have already paid the toll.',
      2
    );

  insert into public.story_dialogue_choices
    (node_id, button_text, player_dialogue_text, action, repeatable, hide_after_selected, disable_after_selected, sort_order)
  values
    (n7, 'Continue.', 'I''ll follow the road.', 'end_conversation', false, true, true, 1);
end $$;
