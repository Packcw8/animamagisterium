create extension if not exists "pgcrypto";

drop table if exists public.character_appearance cascade;
drop table if exists public.attributes cascade;
drop table if exists public.characters cascade;
drop table if exists public.avatar_assets cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  created_at timestamp default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  origin text,
  path text,
  level integer default 1,
  xp integer default 0,
  gold integer default 0,
  created_at timestamp default now()
);

create table public.attributes (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade,
  strength integer default 1,
  endurance integer default 1,
  knowledge integer default 1,
  craft integer default 1,
  wealth integer default 1,
  influence integer default 1
);

create table public.avatar_assets (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  storage_path text,
  preview_url text,
  sort_order integer default 0,
  is_active boolean default true
);

create table public.character_appearance (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade,
  base_asset_id uuid references public.avatar_assets(id),
  face_asset_id uuid references public.avatar_assets(id),
  hair_asset_id uuid references public.avatar_assets(id),
  armor_asset_id uuid references public.avatar_assets(id),
  weapon_asset_id uuid references public.avatar_assets(id),
  cloak_asset_id uuid references public.avatar_assets(id),
  skin_tone text,
  updated_at timestamp default now()
);

create unique index attributes_character_id_key on public.attributes(character_id);
create unique index character_appearance_character_id_key on public.character_appearance(character_id);
create index characters_user_id_idx on public.characters(user_id);
create index avatar_assets_type_sort_idx on public.avatar_assets(type, sort_order);

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.attributes enable row level security;
alter table public.avatar_assets enable row level security;
alter table public.character_appearance enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

create policy "characters_select_own"
  on public.characters for select
  using (auth.uid() = user_id);

create policy "characters_insert_own"
  on public.characters for insert
  with check (auth.uid() = user_id);

create policy "characters_update_own"
  on public.characters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "characters_delete_own"
  on public.characters for delete
  using (auth.uid() = user_id);

create policy "attributes_select_own"
  on public.attributes for select
  using (
    exists (
      select 1 from public.characters
      where characters.id = attributes.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "attributes_insert_own"
  on public.attributes for insert
  with check (
    exists (
      select 1 from public.characters
      where characters.id = attributes.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "attributes_update_own"
  on public.attributes for update
  using (
    exists (
      select 1 from public.characters
      where characters.id = attributes.character_id
      and characters.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.characters
      where characters.id = attributes.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "attributes_delete_own"
  on public.attributes for delete
  using (
    exists (
      select 1 from public.characters
      where characters.id = attributes.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "avatar_assets_select_authenticated"
  on public.avatar_assets for select
  to authenticated
  using (is_active = true);

create policy "character_appearance_select_own"
  on public.character_appearance for select
  using (
    exists (
      select 1 from public.characters
      where characters.id = character_appearance.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "character_appearance_insert_own"
  on public.character_appearance for insert
  with check (
    exists (
      select 1 from public.characters
      where characters.id = character_appearance.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "character_appearance_update_own"
  on public.character_appearance for update
  using (
    exists (
      select 1 from public.characters
      where characters.id = character_appearance.character_id
      and characters.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.characters
      where characters.id = character_appearance.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "character_appearance_delete_own"
  on public.character_appearance for delete
  using (
    exists (
      select 1 from public.characters
      where characters.id = character_appearance.character_id
      and characters.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('avatar-assets', 'avatar-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatar_assets_public_read" on storage.objects;

create policy "avatar_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'avatar-assets');

insert into public.avatar_assets (type, name, storage_path, preview_url, sort_order) values
  ('base', 'Valewood Human', 'bases/valewood-human.png', null, 1),
  ('base', 'Frostborn Human', 'bases/frostborn-human.png', null, 2),
  ('base', 'Duskwold Human', 'bases/duskwold-human.png', null, 3),
  ('base', 'Sunspire Human', 'bases/sunspire-human.png', null, 4),
  ('face', 'Calm Resolve', 'faces/calm-resolve.png', null, 1),
  ('face', 'Scarred Veteran', 'faces/scarred-veteran.png', null, 2),
  ('face', 'Bright-Eyed', 'faces/bright-eyed.png', null, 3),
  ('face', 'Stern Watcher', 'faces/stern-watcher.png', null, 4),
  ('face', 'Mirthful Rogue', 'faces/mirthful-rogue.png', null, 5),
  ('face', 'Haunted Scholar', 'faces/haunted-scholar.png', null, 6),
  ('hair', 'Ranger Shag', 'hair/ranger-shag.png', null, 1),
  ('hair', 'Braided Crown', 'hair/braided-crown.png', null, 2),
  ('hair', 'Scholar Crop', 'hair/scholar-crop.png', null, 3),
  ('hair', 'Warrior Tail', 'hair/warrior-tail.png', null, 4),
  ('hair', 'Silver Locks', 'hair/silver-locks.png', null, 5),
  ('hair', 'Hoodline Cut', 'hair/hoodline-cut.png', null, 6),
  ('armor', 'Traveler Leathers', 'armor/traveler-leathers.png', null, 1),
  ('armor', 'Ironbound Mail', 'armor/ironbound-mail.png', null, 2),
  ('armor', 'Sage Robes', 'armor/sage-robes.png', null, 3),
  ('armor', 'Artificer Harness', 'armor/artificer-harness.png', null, 4),
  ('armor', 'Merchant Finery', 'armor/merchant-finery.png', null, 5),
  ('armor', 'Guardian Plate', 'armor/guardian-plate.png', null, 6),
  ('weapon', 'Oathblade', 'weapons/oathblade.png', null, 1),
  ('weapon', 'Ranger Bow', 'weapons/ranger-bow.png', null, 2),
  ('weapon', 'Sage Staff', 'weapons/sage-staff.png', null, 3),
  ('weapon', 'Runic Pistol', 'weapons/runic-pistol.png', null, 4),
  ('weapon', 'Trade Dagger', 'weapons/trade-dagger.png', null, 5),
  ('weapon', 'Tower Shield', 'weapons/tower-shield.png', null, 6),
  ('cloak', 'Forest Mantle', 'cloaks/forest-mantle.png', null, 1),
  ('cloak', 'Ashen Cape', 'cloaks/ashen-cape.png', null, 2),
  ('cloak', 'Azure Shroud', 'cloaks/azure-shroud.png', null, 3),
  ('cloak', 'Goldtrim Cloak', 'cloaks/goldtrim-cloak.png', null, 4),
  ('background', 'Greenwold Road', 'backgrounds/greenwold-road.png', null, 1),
  ('background', 'Frostvalley Gate', 'backgrounds/frostvalley-gate.png', null, 2),
  ('background', 'Stonehold Market', 'backgrounds/stonehold-market.png', null, 3),
  ('background', 'Darkwood Edge', 'backgrounds/darkwood-edge.png', null, 4);
