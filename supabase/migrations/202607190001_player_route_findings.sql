create table if not exists public.player_route_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  route_id uuid not null references public.map_routes(id) on delete cascade,
  route_progress_id uuid references public.route_progress(id) on delete set null,
  event_id uuid references public.map_events(id) on delete set null,
  finding_type text not null default 'item',
  title text not null,
  message text,
  item_id uuid references public.item_definitions(id) on delete set null,
  item_name text,
  item_image_url text,
  quantity integer not null default 1,
  rarity text not null default 'common',
  progress_percent numeric not null default 0,
  sequence_order bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.player_route_findings
  drop constraint if exists player_route_findings_finding_type_check;

alter table public.player_route_findings
  add constraint player_route_findings_finding_type_check
  check (finding_type in ('item', 'battle', 'dialogue', 'reward', 'discovery'));

alter table public.player_route_findings
  drop constraint if exists player_route_findings_rarity_check;

alter table public.player_route_findings
  add constraint player_route_findings_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));

create index if not exists player_route_findings_player_route_idx
  on public.player_route_findings(user_id, character_id, route_id, created_at);

create index if not exists player_route_findings_route_progress_idx
  on public.player_route_findings(route_progress_id, sequence_order);

alter table public.player_route_findings enable row level security;

grant select, insert, update, delete on public.player_route_findings to authenticated;

drop policy if exists "player_route_findings_owner_read" on public.player_route_findings;
drop policy if exists "player_route_findings_owner_insert" on public.player_route_findings;
drop policy if exists "player_route_findings_owner_update" on public.player_route_findings;
drop policy if exists "player_route_findings_owner_delete" on public.player_route_findings;

create policy "player_route_findings_owner_read"
  on public.player_route_findings
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "player_route_findings_owner_insert"
  on public.player_route_findings
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.characters c
      where c.id = character_id
        and c.user_id = auth.uid()
    )
  );

create policy "player_route_findings_owner_update"
  on public.player_route_findings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "player_route_findings_owner_delete"
  on public.player_route_findings
  for delete
  to authenticated
  using (user_id = auth.uid());
