alter table public.map_markers
  drop constraint if exists map_markers_access_rule_check;

alter table public.map_markers
  add constraint map_markers_access_rule_check
  check (access_rule in ('always', 'story_flag', 'story_flag_unset', 'puzzle_unlock', 'item_required', 'admin_only'));

comment on constraint map_markers_access_rule_check on public.map_markers is
  'Marker access modes. story_flag_unset means visible only while the selected story flag has no player row.';
