update public.game_progression_settings
set
  daily_training_limit = 2,
  updated_at = now()
where id = true;

update public.training_attribute_configs
set
  effect = case attribute_key
    when 'strength' then 'Increases physical attack bonus and carry capacity.'
    when 'endurance' then 'Increases max stamina and long-form survivability.'
    when 'agility' then 'Improves initiative, hit chance, critical chance, and evasion.'
    else effect
  end,
  updated_at = now()
where attribute_key in ('strength', 'endurance', 'agility');
