alter table public.story_dialogue_choices
  add column if not exists restore_health boolean not null default false,
  add column if not exists restore_stamina boolean not null default false,
  add column if not exists restore_mana boolean not null default false;

do $$
declare
  v_mini_map_id uuid;
  v_mara_marker_id uuid;
  v_mara_npc_id uuid;
  v_commander_marker_id uuid;
  n1 uuid;
  n2 uuid;
  n3 uuid;
  n4 uuid;
  n5 uuid;
  n6 uuid;
  n_repeat uuid;
begin
  select id into v_mini_map_id
  from public.mini_maps
  where lower(name) like '%raven%rest%inn%'
     or lower(name) like '%raven%perch%'
     or lower(name) like '%ravens%rest%inn%'
  order by
    case
      when lower(name) like '%inn%' then 0
      when lower(name) like '%perch%' then 1
      else 2
    end,
    created_at
  limit 1;

  select m.id, m.npc_id into v_mara_marker_id, v_mara_npc_id
  from public.map_markers m
  where lower(coalesce(m.title, '')) like '%mara%'
    and (v_mini_map_id is null or m.mini_map_id = v_mini_map_id)
  order by
    case when v_mini_map_id is not null and m.mini_map_id = v_mini_map_id then 0 else 1 end,
    m.created_at
  limit 1;

  if v_mara_marker_id is null then
    select m.id, m.npc_id into v_mara_marker_id, v_mara_npc_id
    from public.map_markers m
    where lower(coalesce(m.title, '')) like '%raven%perch%'
       or lower(coalesce(m.description, '')) like '%mara%'
       or lower(coalesce(m.description, '')) like '%raven%perch%'
    order by m.created_at
    limit 1;
  end if;

  if v_mara_marker_id is null then
    raise notice 'Mara Raven''s Perch dialogue was not seeded because no existing Mara NPC marker was found.';
    return;
  end if;

  select id into v_commander_marker_id
  from public.map_markers
  where lower(coalesce(title, '')) = 'commander thorn search camp'
     or lower(coalesce(quest_title, '')) = 'commander thorn search camp'
     or lower(coalesce(title, '')) like '%commander%thorn%search%camp%'
  order by created_at
  limit 1;

  if v_commander_marker_id is not null then
    update public.map_markers
    set
      is_unlocked = false,
      lock_type = 'story_locked',
      lock_message = coalesce(lock_message, 'Speak with Mara at Raven''s Perch.'),
      updated_at = now()
    where id = v_commander_marker_id;
  else
    raise notice 'Commander Thorn Search Camp marker was not found. Mara dialogue will seed without a marker unlock target.';
  end if;

  update public.story_dialogue_nodes
  set is_start = false,
      updated_at = now()
  where marker_id = v_mara_marker_id;

  delete from public.story_dialogue_nodes
  where marker_id = v_mara_marker_id
    and (node_key like 'mara_ravens_perch_%' or npc_name = 'Mara');

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_01_welcome', 'Welcome to Raven''s Perch', 'Mara', v_mara_npc_id,
$dialogue$Welcome to the Raven's Perch.

You look like you've had a long journey.

Take a seat if you'd like. Travelers are always welcome here.$dialogue$,
    true, false, true, false, 1)
  returning id into n1;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_02_about_ravens_rest', 'About Raven''s Rest', 'Mara', v_mara_npc_id,
$dialogue$Raven's Rest isn't much to look at, but it's home.

Most folk passing through are hunters, merchants, and travelers heading into the frontier.

Normally it's a quiet place...

Just not lately.$dialogue$,
    false, false, true, false, 2)
  returning id into n2;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_03_looking_for_work', 'Looking For Work', 'Mara', v_mara_npc_id,
$dialogue$There's always honest work if you're willing.

Hunters earn their keep.

Fishermen work the river.

The mines pay decent coin.

She pauses.

But if you're looking for real money...

The Crown is paying far more than any ordinary job.$dialogue$,
    false, false, true, false, 3)
  returning id into n3;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_04_something_happened', 'Something Happened', 'Mara', v_mara_npc_id,
$dialogue$Princess Elyse Ashbourne disappeared three days ago while traveling through the frontier.

Since then...

Search parties leave every morning.

Most come back with nothing.

The whole town has been waiting for good news.$dialogue$,
    false, false, true, false, 4)
  returning id into n4;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_05_missing_princess', 'The Missing Princess', 'Mara', v_mara_npc_id,
$dialogue$Her carriage was found abandoned near the edge of the Hearthlands.

Her escort vanished.

No sign of the princess.

Some blame wolves.

Some blame bandits.

Others think something else happened entirely.

The King has offered a generous reward for anyone who can provide useful information.$dialogue$,
    false, false, true, false, 5)
  returning id into n5;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_06_commander_thorn', 'Commander Thorn', 'Mara', v_mara_npc_id,
$dialogue$Commander Thorn has been leading the search since the princess disappeared.

His search camp is outside Raven's Rest near the old watchtower.

If anyone knows what's already been searched...

It's him.

I only hope someone finds her before it's too late.$dialogue$,
    false, false, true, false, 6)
  returning id into n6;

  insert into public.story_dialogue_nodes (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values (null, v_mara_marker_id, 'mara_ravens_perch_repeat_after_story_start', 'Any News?', 'Mara', v_mara_npc_id,
$dialogue$Every day another search party leaves.

Every evening they return with another rumor.

If you find anything...

Commander Thorn should hear it first.$dialogue$,
    false, false, true, false, 99)
  returning id into n_repeat;

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, next_node_id, sort_order)
  values
    (n1, 'Tell me about Raven''s Rest.', null, 'go_to_node', n2, 1),
    (n1, 'Is there any way to make some gold?', null, 'go_to_node', n3, 2);

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, restore_health, restore_stamina, restore_mana, sort_order)
  values
    (n1, 'I''d like to rest.', null, 'end_conversation', true, true, true, 3),
    (n1, 'Goodbye.', null, 'end_conversation', false, false, false, 4);

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, next_node_id, sort_order)
  values
    (n2, 'What happened?', null, 'go_to_node', n4, 1),
    (n2, 'Is there any way to make some gold?', null, 'go_to_node', n3, 2);

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, restore_health, restore_stamina, restore_mana, sort_order)
  values
    (n2, 'I''d like to rest.', null, 'end_conversation', true, true, true, 3),
    (n2, 'Goodbye.', null, 'end_conversation', false, false, false, 4);

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, next_node_id, sort_order)
  values
    (n3, 'What is the Crown paying for?', null, 'go_to_node', n5, 1),
    (n4, 'Tell me more.', null, 'go_to_node', n5, 1),
    (n5, 'Where should I begin?', null, 'go_to_node', n6, 1);

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, sort_order)
  values
    (n3, 'Maybe another time.', null, 'end_conversation', 2),
    (n4, 'That''s unfortunate.', null, 'end_conversation', 2),
    (n5, 'Sounds dangerous.', null, 'end_conversation', 2);

  insert into public.story_dialogue_choices (
    node_id,
    button_text,
    player_dialogue_text,
    action,
    unlock_marker_id,
    update_notification_title,
    update_notification_body,
    repeatable,
    hide_after_selected,
    disable_after_selected,
    selected_message,
    sort_order
  )
  values (
    n6,
    'I''ll speak with Commander Thorn.',
    null,
    'end_conversation',
    v_commander_marker_id,
    'Story Updated',
    'Commander Thorn Search Camp is now marked on your map.',
    false,
    true,
    false,
    'You already agreed to speak with Commander Thorn.',
    1
  );

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, sort_order)
  values
    (n6, 'Thank you.', null, 'end_conversation', 2);

  insert into public.story_dialogue_choices (node_id, button_text, player_dialogue_text, action, restore_health, restore_stamina, restore_mana, sort_order)
  values
    (n_repeat, 'I''d like to rest.', null, 'end_conversation', true, true, true, 1),
    (n_repeat, 'Goodbye.', null, 'end_conversation', false, false, false, 2);
end $$;
