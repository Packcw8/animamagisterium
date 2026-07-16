drop policy if exists "player_trophy_harvests_read_own" on public.player_trophy_harvests;

create policy "player_trophy_harvests_read_leaderboard"
  on public.player_trophy_harvests for select
  to authenticated
  using (true);
