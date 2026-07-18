alter table public.combat_abilities
  drop constraint if exists combat_abilities_status_effect_check;

alter table public.combat_abilities
  add constraint combat_abilities_status_effect_check
  check (status_effect in ('none', 'poison', 'burn', 'regen', 'shield', 'weakness', 'slow', 'stun', 'taunt'));
