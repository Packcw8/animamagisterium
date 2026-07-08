alter table public.player_battle_snapshots
  add column if not exists updated_at timestamp with time zone not null default now();

drop index if exists public.player_battle_snapshots_one_current_idx;

with ranked_system_snapshots as (
  select
    id,
    row_number() over (
      partition by character_id
      order by is_current desc, updated_at desc, created_at desc
    ) as keep_rank
  from public.player_battle_snapshots
  where snapshot_source = 'system'
)
delete from public.player_battle_snapshots s
using ranked_system_snapshots ranked
where s.id = ranked.id
  and ranked.keep_rank > 1;

create unique index if not exists player_battle_snapshots_one_current_source_idx
  on public.player_battle_snapshots(character_id, snapshot_source)
  where is_current = true;
