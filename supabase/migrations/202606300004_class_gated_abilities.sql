alter table public.combat_abilities
  add column if not exists required_class_key text references public.class_definitions(class_key) on delete set null;
