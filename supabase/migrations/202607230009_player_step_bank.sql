create table if not exists public.player_step_bank (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  available_steps integer not null default 0,
  lifetime_imported_steps integer not null default 0,
  lifetime_spent_steps integer not null default 0,
  last_imported_at timestamp with time zone,
  import_window_started_at timestamp with time zone,
  import_window_ended_at timestamp with time zone,
  updated_at timestamp with time zone default now(),
  constraint player_step_bank_available_steps_check check (available_steps >= 0),
  constraint player_step_bank_lifetime_imported_steps_check check (lifetime_imported_steps >= 0),
  constraint player_step_bank_lifetime_spent_steps_check check (lifetime_spent_steps >= 0)
);

alter table public.player_step_bank enable row level security;

grant select, insert, update on public.player_step_bank to authenticated;

drop policy if exists "player_step_bank_owner_read" on public.player_step_bank;
create policy "player_step_bank_owner_read"
  on public.player_step_bank for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "player_step_bank_owner_insert" on public.player_step_bank;
create policy "player_step_bank_owner_insert"
  on public.player_step_bank for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "player_step_bank_owner_update" on public.player_step_bank;
create policy "player_step_bank_owner_update"
  on public.player_step_bank for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.ensure_player_step_bank(p_character_id uuid)
returns public.player_step_bank
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.player_step_bank%rowtype;
begin
  select user_id
    into v_user_id
    from public.characters
    where id = p_character_id
      and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'Character not found for current user.';
  end if;

  insert into public.player_step_bank (user_id, character_id, updated_at)
  values (v_user_id, p_character_id, now())
  on conflict (user_id)
  do update set
    character_id = excluded.character_id,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ensure_player_step_bank(uuid) to authenticated;

create or replace function public.import_steps_to_bank(
  p_character_id uuid,
  p_steps integer,
  p_window_started_at timestamp with time zone default null,
  p_window_ended_at timestamp with time zone default null
)
returns public.player_step_bank
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_steps integer := greatest(0, least(20000, coalesce(p_steps, 0)));
  v_row public.player_step_bank%rowtype;
begin
  select user_id
    into v_user_id
    from public.characters
    where id = p_character_id
      and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'Character not found for current user.';
  end if;

  insert into public.player_step_bank (
    user_id,
    character_id,
    available_steps,
    lifetime_imported_steps,
    last_imported_at,
    import_window_started_at,
    import_window_ended_at,
    updated_at
  )
  values (
    v_user_id,
    p_character_id,
    v_steps,
    v_steps,
    now(),
    p_window_started_at,
    p_window_ended_at,
    now()
  )
  on conflict (user_id)
  do update set
    character_id = excluded.character_id,
    available_steps = public.player_step_bank.available_steps + v_steps,
    lifetime_imported_steps = public.player_step_bank.lifetime_imported_steps + v_steps,
    last_imported_at = now(),
    import_window_started_at = excluded.import_window_started_at,
    import_window_ended_at = excluded.import_window_ended_at,
    updated_at = now()
  returning * into v_row;

  if v_steps > 0 then
    perform public.increment_character_distance_walked(p_character_id, v_steps * 0.762);
  end if;

  return v_row;
end;
$$;

grant execute on function public.import_steps_to_bank(uuid, integer, timestamp with time zone, timestamp with time zone) to authenticated;

create or replace function public.spend_steps_from_bank(
  p_character_id uuid,
  p_steps integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_requested integer := greatest(0, coalesce(p_steps, 0));
  v_available integer;
  v_spent integer;
  v_row public.player_step_bank%rowtype;
begin
  select user_id
    into v_user_id
    from public.characters
    where id = p_character_id
      and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'Character not found for current user.';
  end if;

  perform public.ensure_player_step_bank(p_character_id);

  select available_steps
    into v_available
    from public.player_step_bank
    where user_id = v_user_id
    for update;

  v_spent := least(v_requested, coalesce(v_available, 0));

  update public.player_step_bank
  set
    available_steps = greatest(0, available_steps - v_spent),
    lifetime_spent_steps = lifetime_spent_steps + v_spent,
    updated_at = now()
  where user_id = v_user_id
  returning * into v_row;

  return jsonb_build_object(
    'spent_steps', v_spent,
    'available_steps', v_row.available_steps,
    'lifetime_imported_steps', v_row.lifetime_imported_steps,
    'lifetime_spent_steps', v_row.lifetime_spent_steps,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.spend_steps_from_bank(uuid, integer) to authenticated;
