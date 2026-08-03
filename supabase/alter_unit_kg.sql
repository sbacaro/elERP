-- Rode se full_schema.sql já foi aplicado sem kg
do $$
declare
  cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.store_products'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%unit%';
  if cname is not null then
    execute format('alter table public.store_products drop constraint %I', cname);
  end if;
  alter table public.store_products
    add constraint store_products_unit_check check (unit in ('g', 'kg', 'un'));
exception when duplicate_object then
  null;
end $$;
