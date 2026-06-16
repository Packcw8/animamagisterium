alter table public.marker_market_items
  add column if not exists listing_mode text;

update public.marker_market_items
set listing_mode = 'buy_and_sell'
where listing_mode is null;

alter table public.marker_market_items
  alter column listing_mode set default 'buy_and_sell';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marker_market_items_listing_mode_check'
  ) then
    alter table public.marker_market_items
      add constraint marker_market_items_listing_mode_check
      check (listing_mode in ('buy_and_sell', 'buy_only', 'sell_only'));
  end if;
end $$;
