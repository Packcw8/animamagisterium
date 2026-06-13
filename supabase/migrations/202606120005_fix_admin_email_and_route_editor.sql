update public.profiles
set role = 'admin'
where id in (
  select id
  from auth.users
  where lower(email) = 'pack8cw@gmail.com'
);

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    case
      when lower(coalesce(auth.jwt() ->> 'email', '')) = 'pack8cw@gmail.com' then 'admin'
      else null
    end,
    (
      select role
      from public.profiles
      where id = auth.uid()
      limit 1
    ),
    'player'
  );
$$;
