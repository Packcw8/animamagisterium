grant select, insert, update, delete on public.player_mini_map_marker_discoveries to authenticated;

drop policy if exists "player_mini_map_marker_discoveries_owner_update" on public.player_mini_map_marker_discoveries;

create policy "player_mini_map_marker_discoveries_owner_update"
  on public.player_mini_map_marker_discoveries for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
