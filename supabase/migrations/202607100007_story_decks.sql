create table if not exists public.story_decks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  deck_type text not null default 'lore',
  trigger_type text not null default 'manual',
  trigger_key text,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  play_once boolean not null default true,
  save_to_journal boolean not null default true,
  replayable boolean not null default true,
  is_published boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint story_decks_type_check check (deck_type in ('lore', 'chapter_summary', 'cutscene', 'recap', 'tutorial', 'area_intro')),
  constraint story_decks_trigger_type_check check (trigger_type in (
    'manual',
    'opening_game',
    'entering_area',
    'leaving_area',
    'starting_path',
    'completing_path',
    'marker_interaction',
    'dialogue_choice',
    'puzzle_complete',
    'completing_chapter',
    'receiving_reward'
  ))
);

create table if not exists public.story_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.story_decks(id) on delete cascade,
  title text,
  body text not null,
  image_url text,
  text_position text not null default 'bottom',
  text_style text not null default 'dark',
  button_text text not null default 'Continue',
  sound_url text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint story_cards_text_position_check check (text_position in ('top', 'center', 'bottom')),
  constraint story_cards_text_style_check check (text_style in ('dark', 'light', 'gold'))
);

create table if not exists public.player_story_deck_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  story_deck_id uuid not null references public.story_decks(id) on delete cascade,
  first_viewed_at timestamp with time zone default now(),
  last_viewed_at timestamp with time zone default now(),
  view_count integer not null default 0,
  completed_at timestamp with time zone,
  unique (user_id, story_deck_id)
);

alter table public.map_markers
  add column if not exists story_deck_id uuid references public.story_decks(id) on delete set null;

alter table public.map_routes
  add column if not exists story_deck_id uuid references public.story_decks(id) on delete set null;

alter table public.map_events
  add column if not exists story_deck_id uuid references public.story_decks(id) on delete set null;

alter table public.story_dialogue_choices
  add column if not exists story_deck_id uuid references public.story_decks(id) on delete set null;

create index if not exists story_decks_scope_idx
  on public.story_decks(season_number, chapter_number, trigger_type, trigger_key, is_active, is_published, sort_order);

create index if not exists story_cards_deck_order_idx
  on public.story_cards(deck_id, sort_order);

create index if not exists player_story_deck_views_user_idx
  on public.player_story_deck_views(user_id, completed_at);

alter table public.story_decks enable row level security;
alter table public.story_cards enable row level security;
alter table public.player_story_deck_views enable row level security;

grant select, insert, update, delete on public.story_decks to authenticated;
grant select, insert, update, delete on public.story_cards to authenticated;
grant select, insert, update on public.player_story_deck_views to authenticated;

drop policy if exists "story_decks_read" on public.story_decks;
drop policy if exists "story_decks_admin_insert" on public.story_decks;
drop policy if exists "story_decks_admin_update" on public.story_decks;
drop policy if exists "story_decks_admin_delete" on public.story_decks;
drop policy if exists "story_cards_read" on public.story_cards;
drop policy if exists "story_cards_admin_insert" on public.story_cards;
drop policy if exists "story_cards_admin_update" on public.story_cards;
drop policy if exists "story_cards_admin_delete" on public.story_cards;
drop policy if exists "player_story_deck_views_read_own" on public.player_story_deck_views;
drop policy if exists "player_story_deck_views_insert_own" on public.player_story_deck_views;
drop policy if exists "player_story_deck_views_update_own" on public.player_story_deck_views;

create policy "story_decks_read"
  on public.story_decks for select
  to authenticated
  using (public.is_map_admin() or (is_active = true and is_published = true));

create policy "story_decks_admin_insert"
  on public.story_decks for insert
  to authenticated
  with check (public.is_map_admin());

create policy "story_decks_admin_update"
  on public.story_decks for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "story_decks_admin_delete"
  on public.story_decks for delete
  to authenticated
  using (public.is_map_admin());

create policy "story_cards_read"
  on public.story_cards for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1
      from public.story_decks
      where story_decks.id = story_cards.deck_id
        and story_decks.is_active = true
        and story_decks.is_published = true
    )
  );

create policy "story_cards_admin_insert"
  on public.story_cards for insert
  to authenticated
  with check (public.is_map_admin());

create policy "story_cards_admin_update"
  on public.story_cards for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "story_cards_admin_delete"
  on public.story_cards for delete
  to authenticated
  using (public.is_map_admin());

create policy "player_story_deck_views_read_own"
  on public.player_story_deck_views for select
  to authenticated
  using (user_id = auth.uid() or public.is_map_admin());

create policy "player_story_deck_views_insert_own"
  on public.player_story_deck_views for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "player_story_deck_views_update_own"
  on public.player_story_deck_views for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
