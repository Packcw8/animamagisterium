drop policy if exists "Players can claim arena holder slots" on public.arena_holders;
create policy "Players can claim arena holder slots"
  on public.arena_holders for insert
  with check (holder_user_id = auth.uid() or public.is_admin());
