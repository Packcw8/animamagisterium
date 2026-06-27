-- Run after 202606260002_dialogue_choice_multiple_rewards.sql.
-- Seeds the existing "The Silent Corpse" event without creating duplicate events or items.
do $$
declare
  v_event_id uuid;
  v_common_sword_id uuid;
  v_healing_potion_id uuid;
  n_opening uuid;
  n_body uuid;
  n_satchel uuid;
  n_surroundings uuid;
  n_leave uuid;
  c_search_satchel uuid;
begin
  select id
    into v_event_id
  from public.map_events
  where lower(title) = lower('The Silent Corpse')
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_event_id is null then
    raise exception 'The Silent Corpse event was not found. Create the event first, then rerun this seed.';
  end if;

  select id
    into v_common_sword_id
  from public.item_definitions
  where lower(name) = lower('Common Sword')
  order by created_at asc
  limit 1;

  if v_common_sword_id is null then
    raise exception 'Common Sword item was not found. Create the item first, then rerun this seed.';
  end if;

  select id
    into v_healing_potion_id
  from public.item_definitions
  where lower(name) in (lower('Healing Potion'), lower('Health Potion'))
  order by case when lower(name) = lower('Healing Potion') then 0 else 1 end, created_at asc
  limit 1;

  if v_healing_potion_id is null then
    raise exception 'Healing Potion / Health Potion item was not found. Create the item first, then rerun this seed.';
  end if;

  delete from public.story_dialogue_nodes
  where event_id = v_event_id;

  insert into public.story_dialogue_nodes (event_id, node_key, title, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (
    v_event_id,
    'silent_corpse_opening',
    'Opening',
    'As you continue along the road toward Raven''s Rest, something catches your eye beside the trail.' || E'\n\n' ||
    'A lone traveler sits slumped against a weathered boulder, his body motionless.' || E'\n\n' ||
    'His cloak is torn, and dried blood stains the ground beneath him.' || E'\n\n' ||
    'The road is silent.' || E'\n\n' ||
    'Whatever happened here, no one remains to tell the story.',
    true,
    false,
    true,
    false,
    1
  )
  returning id into n_opening;

  insert into public.story_dialogue_nodes (event_id, node_key, title, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (
    v_event_id,
    'silent_corpse_body',
    'Examine Body',
    'You kneel beside the traveler.' || E'\n\n' ||
    'His skin has already grown cold.' || E'\n\n' ||
    'Several deep wounds cover his body, but it''s impossible to tell what caused them.' || E'\n\n' ||
    'Some resemble the marks of claws.' || E'\n\n' ||
    'Others appear strangely precise.' || E'\n\n' ||
    'However this traveler met his end, it wasn''t peaceful.',
    false,
    false,
    true,
    false,
    2
  )
  returning id into n_body;

  insert into public.story_dialogue_nodes (event_id, node_key, title, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (
    v_event_id,
    'silent_corpse_satchel',
    'Search Satchel',
    'The worn leather satchel still hangs from his shoulder.' || E'\n\n' ||
    'Inside you find a Common Sword, a small pouch containing 80 Gold, and a single Healing Potion.' || E'\n\n' ||
    'Whoever this traveler was, these supplies will serve you better than they ever could him.',
    false,
    false,
    true,
    false,
    3
  )
  returning id into n_satchel;

  insert into public.story_dialogue_nodes (event_id, node_key, title, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (
    v_event_id,
    'silent_corpse_surroundings',
    'Examine Surroundings',
    'You study the ground around the boulder.' || E'\n\n' ||
    'The dirt has been churned by a violent struggle.' || E'\n\n' ||
    'Broken branches and scattered footprints lead away from the road.' || E'\n\n' ||
    'Whatever happened here...' || E'\n\n' ||
    'It wasn''t simple.' || E'\n\n' ||
    'The trail offers no answers.',
    false,
    false,
    true,
    false,
    4
  )
  returning id into n_surroundings;

  insert into public.story_dialogue_nodes (event_id, node_key, title, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (
    v_event_id,
    'silent_corpse_leave',
    'Leave the Traveler',
    'You take one last look at the silent traveler before returning to the road.' || E'\n\n' ||
    'The mystery of his death remains unsolved.' || E'\n\n' ||
    'Whether he fell to beasts, bandits, or something far worse...' || E'\n\n' ||
    'Only the road ahead may hold the answer.' || E'\n\n' ||
    'You continue toward Raven''s Rest.',
    false,
    true,
    false,
    true,
    5
  )
  returning id into n_leave;

  insert into public.story_dialogue_choices (node_id, button_text, action, next_node_id, sort_order)
  values
    (n_opening, 'Examine the body', 'go_to_node', n_body, 1),
    (n_opening, 'Examine the surroundings', 'go_to_node', n_surroundings, 3),
    (n_opening, 'Continue on your journey', 'go_to_node', n_leave, 4);

  insert into public.story_dialogue_choices (node_id, button_text, action, next_node_id, sort_order)
  values (n_opening, 'Search the satchel', 'give_reward', n_satchel, 2)
  returning id into c_search_satchel;

  insert into public.dialogue_choice_rewards (choice_id, reward_type, amount, sort_order)
  values (c_search_satchel, 'gold', 80, 1);

  insert into public.dialogue_choice_rewards (choice_id, reward_type, item_id, quantity, sort_order)
  values
    (c_search_satchel, 'item', v_common_sword_id, 1, 2),
    (c_search_satchel, 'item', v_healing_potion_id, 1, 3);

  insert into public.story_dialogue_choices (node_id, button_text, action, next_node_id, sort_order)
  values
    (n_body, 'Return', 'go_to_node', n_opening, 1),
    (n_satchel, 'Return', 'go_to_node', n_opening, 1),
    (n_surroundings, 'Return', 'go_to_node', n_opening, 1),
    (n_leave, 'End conversation', 'complete_event', null, 1);
end $$;
