create table if not exists public.game_toasts (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  trigger_key text,
  title text not null,
  body text not null,
  icon_image_url text,
  sound_url text,
  button_text text not null default 'OK',
  display_once boolean not null default false,
  trigger_condition text,
  sort_order integer not null default 0,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'game_toasts_trigger_type_check'
      and conrelid = 'public.game_toasts'::regclass
  ) then
    alter table public.game_toasts
      add constraint game_toasts_trigger_type_check
      check (trigger_type in (
        'entering_area',
        'leaving_area',
        'starting_path',
        'completing_path',
        'unlocking_marker',
        'completing_chapter',
        'receiving_reward',
        'learning_ability',
        'discovering_npc_enemy',
        'opening_game'
      ));
  end if;
end $$;

create index if not exists game_toasts_lookup_idx
  on public.game_toasts(trigger_type, trigger_key, season_number, chapter_number, is_active, sort_order);

insert into public.game_toasts (
  trigger_type,
  trigger_key,
  title,
  body,
  button_text,
  display_once,
  trigger_condition,
  sort_order,
  season_number,
  chapter_number,
  is_active
)
select
  'opening_game',
  'fresh_start',
  'A Fresh Start',
  'The Forgotten Marches stretch before you. Ten coins left. No name here yet. Maybe that is a mercy. Maybe this road is where you become someone new.',
  'Begin',
  true,
  'Shown once when a new player first opens the map.',
  1,
  1,
  1,
  true
where not exists (
  select 1
  from public.game_toasts
  where trigger_type = 'opening_game'
    and trigger_key = 'fresh_start'
    and season_number = 1
    and chapter_number = 1
);
