alter table public.social_group_goals
  add column if not exists metric_filter text;

create table if not exists public.social_group_goal_rewards (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.social_group_goals(id) on delete cascade,
  reward_item_id uuid not null references public.item_definitions(id) on delete cascade,
  reward_item_quantity integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.social_group_goal_completions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.social_group_goals(id) on delete cascade,
  group_type text not null check (group_type in ('party', 'guild')),
  group_id uuid not null,
  completed_at timestamp with time zone not null default now(),
  unique (goal_id, group_type, group_id)
);

create index if not exists social_group_goal_rewards_goal_idx
  on public.social_group_goal_rewards(goal_id, sort_order);

create index if not exists social_group_goal_completions_goal_idx
  on public.social_group_goal_completions(goal_id, group_type, group_id);

alter table public.social_group_goal_rewards enable row level security;
alter table public.social_group_goal_completions enable row level security;

grant select, insert, update, delete on public.social_group_goal_rewards to authenticated;
grant select, insert, update, delete on public.social_group_goal_completions to authenticated;

drop policy if exists "social_group_goal_rewards_member_read" on public.social_group_goal_rewards;
create policy "social_group_goal_rewards_member_read"
  on public.social_group_goal_rewards for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1
      from public.social_group_goals
      where social_group_goals.id = social_group_goal_rewards.goal_id
        and (
          (
            social_group_goals.group_type = 'party'
            and public.is_party_member(social_group_goals.group_id, auth.uid())
          )
          or (
            social_group_goals.group_type = 'guild'
            and public.is_guild_member(social_group_goals.group_id, auth.uid())
          )
        )
    )
  );

drop policy if exists "social_group_goal_rewards_admin_write" on public.social_group_goal_rewards;
create policy "social_group_goal_rewards_admin_write"
  on public.social_group_goal_rewards for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "social_group_goal_completions_member_read" on public.social_group_goal_completions;
create policy "social_group_goal_completions_member_read"
  on public.social_group_goal_completions for select
  to authenticated
  using (
    public.is_map_admin()
    or (
      group_type = 'party'
      and public.is_party_member(group_id, auth.uid())
    )
    or (
      group_type = 'guild'
      and public.is_guild_member(group_id, auth.uid())
    )
  );

drop policy if exists "social_group_goal_completions_admin_or_system_insert" on public.social_group_goal_completions;
create policy "social_group_goal_completions_admin_or_system_insert"
  on public.social_group_goal_completions for insert
  to authenticated
  with check (
    public.is_map_admin()
    or (
      group_type = 'party'
      and public.is_party_member(group_id, auth.uid())
    )
    or (
      group_type = 'guild'
      and public.is_guild_member(group_id, auth.uid())
    )
  );

create or replace function public.grant_social_group_goal_rewards(
  p_goal_id uuid,
  p_group_type text,
  p_group_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_row public.social_group_goals%rowtype;
  member_row record;
  reward_row record;
  inserted_completion_id uuid;
begin
  select *
  into goal_row
  from public.social_group_goals
  where id = p_goal_id
    and group_type = p_group_type
    and group_id = p_group_id
    and is_active = true;

  if not found then
    return false;
  end if;

  if p_group_type = 'party' and not public.is_party_member(p_group_id, auth.uid()) and not public.is_map_admin() then
    return false;
  end if;

  if p_group_type = 'guild' and not public.is_guild_member(p_group_id, auth.uid()) and not public.is_map_admin() then
    return false;
  end if;

  insert into public.social_group_goal_completions(goal_id, group_type, group_id)
  values (p_goal_id, p_group_type, p_group_id)
  on conflict (goal_id, group_type, group_id) do nothing
  returning id into inserted_completion_id;

  if inserted_completion_id is null then
    return false;
  end if;

  for member_row in
    select user_id
    from public.party_members
    where p_group_type = 'party'
      and party_id = p_group_id
      and status = 'active'
    union all
    select user_id
    from public.guild_members
    where p_group_type = 'guild'
      and guild_id = p_group_id
      and status = 'active'
  loop
    if goal_row.reward_xp > 0 or goal_row.reward_gold > 0 then
      insert into public.player_inbox_rewards(
        user_id,
        character_id,
        title,
        body,
        reward_xp,
        reward_gold,
        reward_item_id,
        reward_item_quantity
      )
      values (
        member_row.user_id,
        null,
        coalesce(goal_row.reward_title, goal_row.title || ' Complete'),
        'Your ' || p_group_type || ' completed: ' || goal_row.title || '.',
        goal_row.reward_xp,
        goal_row.reward_gold,
        null,
        1
      );
    end if;

    for reward_row in
      select reward_item_id, reward_item_quantity
      from public.social_group_goal_rewards
      where goal_id = p_goal_id
      order by sort_order asc, created_at asc
    loop
      insert into public.player_inbox_rewards(
        user_id,
        character_id,
        title,
        body,
        reward_xp,
        reward_gold,
        reward_item_id,
        reward_item_quantity
      )
      values (
        member_row.user_id,
        null,
        coalesce(goal_row.reward_title, goal_row.title || ' Reward'),
        'Your ' || p_group_type || ' earned an item reward from: ' || goal_row.title || '.',
        0,
        0,
        reward_row.reward_item_id,
        greatest(1, reward_row.reward_item_quantity)
      );
    end loop;
  end loop;

  return true;
end;
$$;

grant execute on function public.grant_social_group_goal_rewards(uuid, text, uuid) to authenticated;
