create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text,
  created_at timestamp default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text,
  level integer default 1,
  xp integer default 0,
  gold integer default 0,
  created_at timestamp default now()
);

create table if not exists public.attributes (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade,
  strength integer default 1,
  endurance integer default 1,
  knowledge integer default 1,
  craft integer default 1,
  wealth integer default 1,
  influence integer default 1
);

create unique index if not exists attributes_character_id_key
  on public.attributes(character_id);

grant select, insert, update on public.profiles to anon, authenticated;
grant select, insert, update on public.characters to anon, authenticated;
grant select, insert, update on public.attributes to anon, authenticated;
