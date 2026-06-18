grant insert on public.game_progression_settings to authenticated;
grant insert on public.training_attribute_configs to authenticated;

drop policy if exists "game_progression_settings_admin_insert" on public.game_progression_settings;
drop policy if exists "training_attribute_configs_admin_insert" on public.training_attribute_configs;

create policy "game_progression_settings_admin_insert"
  on public.game_progression_settings for insert
  to authenticated
  with check (public.is_map_admin());

create policy "training_attribute_configs_admin_insert"
  on public.training_attribute_configs for insert
  to authenticated
  with check (public.is_map_admin());
