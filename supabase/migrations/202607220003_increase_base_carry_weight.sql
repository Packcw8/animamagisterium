insert into public.game_balance_settings (key, value, updated_at)
values
  ('base_carry_weight', 100, now()),
  ('carry_weight_per_strength_level', 10, now())
on conflict (key) do update
set
  value = excluded.value,
  updated_at = excluded.updated_at;
