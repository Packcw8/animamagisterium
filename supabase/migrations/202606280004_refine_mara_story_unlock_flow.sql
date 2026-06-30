update public.map_markers
set
  is_active = true,
  is_unlocked = false,
  is_interactable = true,
  lock_type = 'story_locked',
  lock_message = 'Speak with Mara at Raven''s Perch.',
  story_order = 0,
  interaction_radius_percent = 100,
  updated_at = now()
where quest_key = 'campaign_missing_princess'
   or lower(coalesce(title, '')) = 'the missing princess';

do $$
declare
  v_mini_map_id uuid;
  v_mara_marker_id uuid;
  v_mara_npc_id uuid;
  v_missing_marker_id uuid;
  n1 uuid;
  n2 uuid;
  n3 uuid;
  n4 uuid;
  n5 uuid;
  n6 uuid;
  n7 uuid;
  n8 uuid;
  n9 uuid;
  n10 uuid;
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

  select m.id, m.npc_id
  into v_mara_marker_id, v_mara_npc_id
  from public.map_markers m
  where lower(coalesce(m.title, '')) like '%mara%'
    and (v_mini_map_id is null or m.mini_map_id = v_mini_map_id)
  order by
    case when v_mini_map_id is not null and m.mini_map_id = v_mini_map_id then 0 else 1 end,
    m.created_at
  limit 1;

  if v_mara_marker_id is null then
    select m.id, m.npc_id
    into v_mara_marker_id, v_mara_npc_id
    from public.map_markers m
    where lower(coalesce(m.title, '')) like '%raven%perch%'
       or lower(coalesce(m.description, '')) like '%mara%'
       or lower(coalesce(m.description, '')) like '%raven%perch%'
    order by m.created_at
    limit 1;
  end if;

  select id into v_missing_marker_id
  from public.map_markers
  where quest_key = 'campaign_missing_princess'
     or lower(coalesce(title, '')) = 'the missing princess'
  order by created_at
  limit 1;

  if v_mara_marker_id is null or v_missing_marker_id is null then
    raise notice 'Mara dialogue refinement skipped because Mara or The Missing Princess marker was not found.';
    return;
  end if;

  update public.story_dialogue_nodes
  set is_start = false,
      updated_at = now()
  where marker_id = v_mara_marker_id;

  delete from public.story_dialogue_nodes
  where marker_id = v_mara_marker_id
    and (node_key like 'mara_ravens_perch_%' or npc_name = 'Mara');

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_01_welcome', 'Welcome to Raven''s Perch', 'Mara', v_mara_npc_id,
$dialogue$Welcome to the Raven's Perch.

You look like you've had a long journey.

Take a seat if you'd like. Travelers are always welcome here.$dialogue$,
      true, false, true, false, 1)
  returning id into n1;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_02_about_ravens_rest', 'About Raven''s Rest', 'Mara', v_mara_npc_id,
$dialogue$Raven's Rest isn't much to look at, but it's home.

Most folk passing through are hunters, merchants, and travelers heading into the frontier.

Normally it's a quiet place...

Just not lately.$dialogue$,
      false, false, true, false, 2)
  returning id into n2;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_03_looking_for_work', 'Looking For Work', 'Mara', v_mara_npc_id,
$dialogue$There's always honest work if you're willing.

Hunters earn their keep.

Fishermen work the river.

The mines always need another pair of hands.

But lately every hunter, sellsword, and road-worn hopeful is chasing Crown coin.$dialogue$,
      false, false, true, false, 3)
  returning id into n3;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_04_what_happened', 'What Happened', 'Mara', v_mara_npc_id,
$dialogue$Three days ago Princess Elyse Ashbourne disappeared while traveling the frontier.

No one knows exactly what happened.

Some say wolves took her party in the night.

Others swear it was bandits lying in wait along the road.

And then there are those whispering about the Broken Moon.

Truth is...

No one agrees on anything except that she's gone.$dialogue$,
      false, false, true, false, 4)
  returning id into n4;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_05_missing_princess', 'The Missing Princess', 'Mara', v_mara_npc_id,
$dialogue$The King has offered a generous reward for information leading to Princess Elyse's safe return.

Since then...

It feels like half the kingdom has passed through Raven's Rest looking for her.

Most are chasing coin.

Some are chasing glory.

A few might even be trying to help.$dialogue$,
      false, false, true, false, 5)
  returning id into n5;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_06_princess_elyse', 'Princess Elyse', 'Mara', v_mara_npc_id,
$dialogue$She's the younger daughter of King Aldric.

Unlike most nobles, she'd rather spend her time among the people than inside palace walls.

She visits villages the Crown rarely sees.

Listens more than she speaks.

That's why folk around here have taken her disappearance so personally.$dialogue$,
      false, false, true, false, 6)
  returning id into n6;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_07_royal_family', 'The Royal Family', 'Mara', v_mara_npc_id,
$dialogue$King Aldric has ruled Hearthguard for as long as I can remember.

Most would call him a fair king.

Queen Isolde is well respected throughout the kingdom.

Princess Elyse has always preferred the company of ordinary folk.

Princess Seraphine...

She was born for palace halls.$dialogue$,
      false, false, true, false, 7)
  returning id into n7;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_08_broken_moon', 'The Broken Moon', 'Mara', v_mara_npc_id,
$dialogue$Depends who you ask.

Some call them rebels.

Others call them freedom fighters.

Most are just ordinary folk who think the kingdom's lost its way.

Whatever they are...

Their name gets louder whenever the Crown stumbles.$dialogue$,
      false, false, true, false, 8)
  returning id into n8;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_09_broken_moon_rumors', 'Rumors and Blame', 'Mara', v_mara_npc_id,
$dialogue$Do I think they took her?

I think people reach for names they already fear.

Could be wolves.

Could be bandits.

Could be men wearing a cause like a mask.

Commander Thorn may know which rumors are worth following.$dialogue$,
      false, false, true, false, 9)
  returning id into n9;

  insert into public.story_dialogue_nodes
    (event_id, marker_id, node_key, title, npc_name, npc_id, dialogue_text, is_start, is_ending, allow_end_chat, end_completes_event, sort_order)
  values
    (null, v_mara_marker_id, 'mara_ravens_perch_10_where_to_begin', 'Where To Begin', 'Mara', v_mara_npc_id,
$dialogue$Commander Thorn has established a search headquarters outside Raven's Rest.

He's taking anyone willing to lend a hand.

Three days without answers...

Fresh eyes are worth more than another dozen tired soldiers.

If you're serious about earning that reward, start with the missing princess lead.

That thread should point you toward Thorn.$dialogue$,
      false, false, true, false, 10)
  returning id into n10;

  insert into public.story_dialogue_choices (node_id, button_text, action, next_node_id, sort_order)
  values
    (n1, 'Tell me about Raven''s Rest.', 'go_to_node', n2, 1),
    (n1, 'Any work for a traveler?', 'go_to_node', n3, 2),
    (n2, 'What changed?', 'go_to_node', n4, 1),
    (n2, 'Any work for a traveler?', 'go_to_node', n3, 2),
    (n3, 'Crown coin?', 'go_to_node', n5, 1),
    (n3, 'What has everyone chasing it?', 'go_to_node', n4, 2),
    (n4, 'What reward is the Crown offering?', 'go_to_node', n5, 1),
    (n4, 'Who are the Broken Moon?', 'go_to_node', n8, 2),
    (n5, 'Who is Princess Elyse?', 'go_to_node', n6, 1),
    (n5, 'Tell me about the royal family.', 'go_to_node', n7, 2),
    (n5, 'I''ve heard people mention the Broken Moon.', 'go_to_node', n8, 3),
    (n5, 'Where should I start?', 'go_to_node', n10, 4),
    (n6, 'Tell me about the royal family.', 'go_to_node', n7, 1),
    (n6, 'I''ve heard people mention the Broken Moon.', 'go_to_node', n8, 2),
    (n6, 'Where should I start?', 'go_to_node', n10, 3),
    (n7, 'Tell me about the Broken Moon.', 'go_to_node', n8, 1),
    (n7, 'Where should I start?', 'go_to_node', n10, 2),
    (n8, 'Do you think they took her?', 'go_to_node', n9, 1),
    (n8, 'Where should I start?', 'go_to_node', n10, 2),
    (n9, 'Where should I start?', 'go_to_node', n10, 1);

  insert into public.story_dialogue_choices (node_id, button_text, action, restore_health, restore_stamina, restore_mana, sort_order)
  values
    (n1, 'I''d like to rest.', 'end_conversation', true, true, true, 3);

  insert into public.story_dialogue_choices (node_id, button_text, action, sort_order)
  values
    (n1, 'Goodbye.', 'end_conversation', 4),
    (n2, 'Goodbye.', 'end_conversation', 3),
    (n3, 'Maybe another time.', 'end_conversation', 3),
    (n4, 'Goodbye.', 'end_conversation', 3),
    (n5, 'Sounds dangerous.', 'end_conversation', 5),
    (n6, 'Goodbye.', 'end_conversation', 4),
    (n7, 'Goodbye.', 'end_conversation', 3),
    (n8, 'Goodbye.', 'end_conversation', 3),
    (n9, 'Goodbye.', 'end_conversation', 2);

  insert into public.story_dialogue_choices (
    node_id,
    button_text,
    action,
    unlock_marker_id,
    update_notification_title,
    update_notification_body,
    set_story_flag_key,
    set_story_flag_value,
    choice_group_key,
    choice_group_lock_message,
    repeatable,
    hide_after_selected,
    disable_after_selected,
    selected_message,
    sort_order
  )
  values (
    n10,
    'I''ll follow the lead.',
    'end_conversation',
    v_missing_marker_id,
    'Story Unlocked',
    'The Missing Princess is now available.',
    'missing_princess_campaign_started',
    true,
    'mara_missing_princess_lead',
    'The Missing Princess lead is already available.',
    false,
    true,
    true,
    'The Missing Princess lead is already available.',
    1
  );

  insert into public.story_dialogue_choices (node_id, button_text, action, sort_order)
  values
    (n10, 'Thank you.', 'end_conversation', 2);
end $$;
