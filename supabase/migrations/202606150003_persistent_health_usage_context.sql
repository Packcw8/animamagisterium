alter table public.characters
  add column if not exists current_health integer;

update public.characters c
set current_health = least(
  greatest(coalesce(c.current_health, 30 + coalesce(a.endurance, 0) * 8 + coalesce(a.strength, 0) * 2), 0),
  30 + coalesce(a.endurance, 0) * 8 + coalesce(a.strength, 0) * 2
)
from public.attributes a
where a.character_id = c.id
  and c.current_health is null;

update public.characters
set current_health = 30
where current_health is null;

alter table public.item_definitions
  add column if not exists usage_context text;

update public.item_definitions
set usage_context = case
  when usable_in_battle and usable_outside_battle then 'both'
  when usable_outside_battle then 'outside_battle_only'
  else 'battle_only'
end
where usage_context is null;

alter table public.item_definitions
  alter column usage_context set default 'battle_only';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'item_definitions_usage_context_check'
  ) then
    alter table public.item_definitions
      add constraint item_definitions_usage_context_check
      check (usage_context in ('battle_only', 'outside_battle_only', 'both'));
  end if;
end $$;

alter table public.combat_abilities
  add column if not exists usage_context text;

update public.combat_abilities
set usage_context = 'battle_only'
where usage_context is null;

alter table public.combat_abilities
  alter column usage_context set default 'battle_only';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'combat_abilities_usage_context_check'
  ) then
    alter table public.combat_abilities
      add constraint combat_abilities_usage_context_check
      check (usage_context in ('battle_only', 'outside_battle_only', 'both'));
  end if;
end $$;
