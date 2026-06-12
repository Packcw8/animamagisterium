create extension if not exists "pgcrypto";

alter table public.characters
  add column if not exists gender text,
  add column if not exists ancestry text,
  add column if not exists homeland text,
  add column if not exists trait text,
  add column if not exists portrait_url text,
  add column if not exists original_photo_url text;

alter table public.characters
  alter column level set default 1,
  alter column xp set default 0,
  alter column gold set default 0;

alter table public.attributes
  add column if not exists exploration integer default 0,
  add column if not exists spirit integer default 0;

alter table public.attributes
  alter column strength set default 0,
  alter column endurance set default 0,
  alter column knowledge set default 0,
  alter column craft set default 0,
  alter column wealth set default 0,
  alter column influence set default 0,
  alter column exploration set default 0,
  alter column spirit set default 0;

update public.attributes
set
  strength = coalesce(strength, 0),
  endurance = coalesce(endurance, 0),
  knowledge = coalesce(knowledge, 0),
  craft = coalesce(craft, 0),
  wealth = coalesce(wealth, 0),
  influence = coalesce(influence, 0),
  exploration = coalesce(exploration, 0),
  spirit = coalesce(spirit, 0);

insert into storage.buckets (id, name, public)
values
  ('user-selfies', 'user-selfies', true),
  ('character-portraits', 'character-portraits', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "user_selfies_public_read" on storage.objects;
drop policy if exists "user_selfies_owner_insert" on storage.objects;
drop policy if exists "character_portraits_public_read" on storage.objects;
drop policy if exists "character_portraits_owner_insert" on storage.objects;

create policy "user_selfies_public_read"
  on storage.objects for select
  using (bucket_id = 'user-selfies');

create policy "user_selfies_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'user-selfies' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "character_portraits_public_read"
  on storage.objects for select
  using (bucket_id = 'character-portraits');

create policy "character_portraits_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'character-portraits' and auth.uid()::text = (storage.foldername(name))[1]);
