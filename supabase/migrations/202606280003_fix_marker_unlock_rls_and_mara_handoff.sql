grant select, insert, update, delete on public.player_marker_unlocks to authenticated;

drop policy if exists "player_marker_unlocks_update" on public.player_marker_unlocks;

create policy "player_marker_unlocks_update"
  on public.player_marker_unlocks for update
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

update public.map_markers
set
  is_active = true,
  is_unlocked = false,
  is_interactable = true,
  lock_type = 'story_locked',
  lock_message = 'Speak with Mara at Raven''s Perch.',
  story_order = 0,
  interaction_radius_percent = 6,
  updated_at = now()
where quest_key = 'campaign_missing_princess'
   or lower(coalesce(title, '')) = 'the missing princess';

do $$
declare
  v_mara_marker_id uuid;
  v_missing_marker_id uuid;
  v_handoff_node_id uuid;
begin
  select id
  into v_mara_marker_id
  from public.map_markers
  where lower(coalesce(title, '')) like '%mara%'
     or lower(coalesce(description, '')) like '%mara%'
     or lower(coalesce(title, '')) like '%raven%perch%'
  order by
    case when lower(coalesce(title, '')) like '%mara%' then 0 else 1 end,
    created_at
  limit 1;

  select id
  into v_missing_marker_id
  from public.map_markers
  where quest_key = 'campaign_missing_princess'
     or lower(coalesce(title, '')) = 'the missing princess'
  order by created_at
  limit 1;

  if v_mara_marker_id is null or v_missing_marker_id is null then
    raise notice 'Mara handoff text was not updated because Mara or The Missing Princess marker was not found.';
    return;
  end if;

  select id
  into v_handoff_node_id
  from public.story_dialogue_nodes
  where marker_id = v_mara_marker_id
    and node_key = 'mara_ravens_perch_09_commander_thorn'
  order by created_at desc
  limit 1;

  if v_handoff_node_id is null then
    raise notice 'Mara handoff text was not updated because the Commander Thorn node was not found.';
    return;
  end if;

  update public.story_dialogue_nodes
  set
    title = 'Where To Begin',
    dialogue_text = $dialogue$Commander Thorn is leading the search from a camp outside Raven's Rest.

If anyone knows where the first real trail begins, it's him.

But do not go chasing rumors blind.

I can mark what folk are calling the missing princess lead.

Follow that thread, and it should point you toward Thorn when you're ready.$dialogue$,
    updated_at = now()
  where id = v_handoff_node_id;

  update public.story_dialogue_choices
  set
    button_text = 'I''ll follow the missing princess lead.',
    unlock_marker_id = v_missing_marker_id,
    update_notification_title = 'Story Updated',
    update_notification_body = 'The Missing Princess lead has been marked nearby.',
    set_story_flag_key = 'missing_princess_campaign_started',
    set_story_flag_value = true,
    choice_group_key = 'mara_missing_princess_lead',
    choice_group_lock_message = 'Mara has already pointed you toward the missing princess lead.',
    repeatable = false,
    hide_after_selected = true,
    disable_after_selected = true,
    selected_message = 'Mara has already pointed you toward the missing princess lead.',
    updated_at = now()
  where node_id = v_handoff_node_id
    and (
      unlock_marker_id is not null
      or lower(button_text) like '%commander thorn%'
      or lower(button_text) like '%missing princess%'
    );
end $$;
