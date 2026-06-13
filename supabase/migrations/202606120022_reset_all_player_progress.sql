delete from public.equipped_abilities;
delete from public.player_abilities;
delete from public.training_sessions;
delete from public.attribute_progress;
delete from public.map_event_completions;
delete from public.route_progress;

update public.attributes
set
  strength = 0,
  endurance = 0,
  agility = 0,
  intelligence = 0,
  wisdom = 0,
  charisma = 0,
  spirit = 0;

update public.characters
set
  level = 1,
  xp = 0,
  gold = 0;
