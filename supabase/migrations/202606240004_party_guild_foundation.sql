create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  leader_id uuid not null references auth.users(id) on delete cascade,
  max_members integer not null default 5,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  status text not null default 'active' check (status in ('pending', 'active', 'declined', 'left')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (party_id, user_id)
);

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  leader_id uuid not null references auth.users(id) on delete cascade,
  max_members integer not null default 20,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.guild_members (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'officer', 'member')),
  status text not null default 'active' check (status in ('pending', 'active', 'declined', 'left')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (guild_id, user_id)
);

create table if not exists public.social_group_goals (
  id uuid primary key default gen_random_uuid(),
  group_type text not null check (group_type in ('party', 'guild')),
  group_id uuid not null,
  title text not null,
  description text,
  metric_type text not null default 'custom',
  target_value numeric not null default 1,
  reward_title text,
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  reward_item_id uuid references public.item_definitions(id) on delete set null,
  reward_item_quantity integer not null default 1,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.social_group_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.social_group_goals(id) on delete cascade,
  group_type text not null check (group_type in ('party', 'guild')),
  group_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null default 0,
  source_type text,
  source_id text,
  created_at timestamp with time zone not null default now()
);

create index if not exists party_members_user_idx on public.party_members(user_id, status);
create index if not exists party_members_party_idx on public.party_members(party_id, status);
create index if not exists guild_members_user_idx on public.guild_members(user_id, status);
create index if not exists guild_members_guild_idx on public.guild_members(guild_id, status);
create index if not exists social_group_goals_group_idx on public.social_group_goals(group_type, group_id, is_active);
create index if not exists social_group_goal_contributions_goal_idx on public.social_group_goal_contributions(goal_id, user_id);

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.social_group_goals enable row level security;
alter table public.social_group_goal_contributions enable row level security;

grant select, insert, update, delete on public.parties to authenticated;
grant select, insert, update, delete on public.party_members to authenticated;
grant select, insert, update, delete on public.guilds to authenticated;
grant select, insert, update, delete on public.guild_members to authenticated;
grant select, insert, update, delete on public.social_group_goals to authenticated;
grant select, insert, update, delete on public.social_group_goal_contributions to authenticated;

drop policy if exists "parties_member_read" on public.parties;
create policy "parties_member_read"
  on public.parties for select
  to authenticated
  using (
    public.is_map_admin()
    or leader_id = auth.uid()
    or exists (
      select 1 from public.party_members
      where party_members.party_id = parties.id
        and party_members.user_id = auth.uid()
        and party_members.status in ('pending', 'active')
    )
  );

drop policy if exists "parties_leader_insert" on public.parties;
create policy "parties_leader_insert"
  on public.parties for insert
  to authenticated
  with check (leader_id = auth.uid() or public.is_map_admin());

drop policy if exists "parties_leader_update" on public.parties;
create policy "parties_leader_update"
  on public.parties for update
  to authenticated
  using (leader_id = auth.uid() or public.is_map_admin())
  with check (leader_id = auth.uid() or public.is_map_admin());

drop policy if exists "party_members_related_read" on public.party_members;
create policy "party_members_related_read"
  on public.party_members for select
  to authenticated
  using (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.parties
      where parties.id = party_members.party_id
        and parties.leader_id = auth.uid()
    )
    or exists (
      select 1 from public.party_members pm
      where pm.party_id = party_members.party_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

drop policy if exists "party_members_leader_insert" on public.party_members;
create policy "party_members_leader_insert"
  on public.party_members for insert
  to authenticated
  with check (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.parties
      where parties.id = party_members.party_id
        and parties.leader_id = auth.uid()
    )
  );

drop policy if exists "party_members_self_or_leader_update" on public.party_members;
create policy "party_members_self_or_leader_update"
  on public.party_members for update
  to authenticated
  using (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.parties
      where parties.id = party_members.party_id
        and parties.leader_id = auth.uid()
    )
  )
  with check (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.parties
      where parties.id = party_members.party_id
        and parties.leader_id = auth.uid()
    )
  );

drop policy if exists "guilds_member_read" on public.guilds;
create policy "guilds_member_read"
  on public.guilds for select
  to authenticated
  using (
    public.is_map_admin()
    or leader_id = auth.uid()
    or exists (
      select 1 from public.guild_members
      where guild_members.guild_id = guilds.id
        and guild_members.user_id = auth.uid()
        and guild_members.status in ('pending', 'active')
    )
  );

drop policy if exists "guilds_leader_insert" on public.guilds;
create policy "guilds_leader_insert"
  on public.guilds for insert
  to authenticated
  with check (leader_id = auth.uid() or public.is_map_admin());

drop policy if exists "guilds_leader_update" on public.guilds;
create policy "guilds_leader_update"
  on public.guilds for update
  to authenticated
  using (leader_id = auth.uid() or public.is_map_admin())
  with check (leader_id = auth.uid() or public.is_map_admin());

drop policy if exists "guild_members_related_read" on public.guild_members;
create policy "guild_members_related_read"
  on public.guild_members for select
  to authenticated
  using (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.guilds
      where guilds.id = guild_members.guild_id
        and guilds.leader_id = auth.uid()
    )
    or exists (
      select 1 from public.guild_members gm
      where gm.guild_id = guild_members.guild_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "guild_members_leader_insert" on public.guild_members;
create policy "guild_members_leader_insert"
  on public.guild_members for insert
  to authenticated
  with check (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.guilds
      where guilds.id = guild_members.guild_id
        and guilds.leader_id = auth.uid()
    )
  );

drop policy if exists "guild_members_self_or_leader_update" on public.guild_members;
create policy "guild_members_self_or_leader_update"
  on public.guild_members for update
  to authenticated
  using (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.guilds
      where guilds.id = guild_members.guild_id
        and guilds.leader_id = auth.uid()
    )
  )
  with check (
    public.is_map_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.guilds
      where guilds.id = guild_members.guild_id
        and guilds.leader_id = auth.uid()
    )
  );

drop policy if exists "social_group_goals_member_read" on public.social_group_goals;
create policy "social_group_goals_member_read"
  on public.social_group_goals for select
  to authenticated
  using (
    public.is_map_admin()
    or (
      group_type = 'party'
      and exists (
        select 1 from public.party_members
        where party_members.party_id = social_group_goals.group_id
          and party_members.user_id = auth.uid()
          and party_members.status = 'active'
      )
    )
    or (
      group_type = 'guild'
      and exists (
        select 1 from public.guild_members
        where guild_members.guild_id = social_group_goals.group_id
          and guild_members.user_id = auth.uid()
          and guild_members.status = 'active'
      )
    )
  );

drop policy if exists "social_group_goals_admin_write" on public.social_group_goals;
create policy "social_group_goals_admin_write"
  on public.social_group_goals for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "social_group_goal_contributions_member_read" on public.social_group_goal_contributions;
create policy "social_group_goal_contributions_member_read"
  on public.social_group_goal_contributions for select
  to authenticated
  using (
    public.is_map_admin()
    or (
      group_type = 'party'
      and exists (
        select 1 from public.party_members
        where party_members.party_id = social_group_goal_contributions.group_id
          and party_members.user_id = auth.uid()
          and party_members.status = 'active'
      )
    )
    or (
      group_type = 'guild'
      and exists (
        select 1 from public.guild_members
        where guild_members.guild_id = social_group_goal_contributions.group_id
          and guild_members.user_id = auth.uid()
          and guild_members.status = 'active'
      )
    )
  );

drop policy if exists "social_group_goal_contributions_owner_insert" on public.social_group_goal_contributions;
create policy "social_group_goal_contributions_owner_insert"
  on public.social_group_goal_contributions for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_map_admin());
