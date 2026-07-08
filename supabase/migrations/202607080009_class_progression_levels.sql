create table if not exists public.class_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  class_key text not null references public.class_definitions(class_key) on delete cascade,
  current_level integer not null default 0,
  current_xp integer not null default 0,
  last_trained_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (character_id, class_key)
);

alter table public.combat_abilities
  add column if not exists required_class_level integer not null default 0;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'combat_abilities_learn_method_check'
      and conrelid = 'public.combat_abilities'::regclass
  ) then
    alter table public.combat_abilities
      drop constraint combat_abilities_learn_method_check;
  end if;
end $$;

alter table public.combat_abilities
  add constraint combat_abilities_learn_method_check
  check (learn_method in ('starter', 'level', 'class level', 'weapon equipped', 'armor equipped', 'wearable equipped', 'scroll', 'quest', 'admin'));

update public.combat_abilities
set required_class_level = greatest(required_class_level, required_level)
where required_class_key is not null
  and required_class_level = 0
  and required_level > 0;

alter table public.class_progress enable row level security;

grant select, insert, update, delete on public.class_progress to authenticated;

drop policy if exists "class_progress_owner_read" on public.class_progress;
drop policy if exists "class_progress_owner_insert" on public.class_progress;
drop policy if exists "class_progress_owner_update" on public.class_progress;
drop policy if exists "class_progress_owner_delete" on public.class_progress;

create policy "class_progress_owner_read"
  on public.class_progress for select
  to authenticated
  using (user_id = auth.uid());

create policy "class_progress_owner_insert"
  on public.class_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.characters
      where characters.id = class_progress.character_id
        and characters.user_id = auth.uid()
    )
  );

create policy "class_progress_owner_update"
  on public.class_progress for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "class_progress_owner_delete"
  on public.class_progress for delete
  to authenticated
  using (user_id = auth.uid());

create index if not exists class_progress_user_character_idx
  on public.class_progress(user_id, character_id);

create index if not exists combat_abilities_class_unlock_idx
  on public.combat_abilities(required_class_key, required_class_level)
  where required_class_key is not null;
