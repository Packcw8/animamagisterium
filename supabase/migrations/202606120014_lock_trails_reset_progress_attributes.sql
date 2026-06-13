alter table public.attributes
  add column if not exists agility integer default 0,
  add column if not exists intelligence integer default 0,
  add column if not exists wisdom integer default 0,
  add column if not exists charisma integer default 0;

alter table public.attributes
  alter column strength set default 0,
  alter column endurance set default 0,
  alter column agility set default 0,
  alter column intelligence set default 0,
  alter column wisdom set default 0,
  alter column charisma set default 0,
  alter column spirit set default 0;

update public.attributes
set
  strength = coalesce(strength, 0),
  endurance = coalesce(endurance, 0),
  agility = coalesce(agility, 0),
  intelligence = coalesce(intelligence, knowledge, 0),
  wisdom = coalesce(wisdom, exploration, 0),
  charisma = coalesce(charisma, influence, 0),
  spirit = coalesce(spirit, 0);

delete from public.map_event_completions;
delete from public.route_progress;
