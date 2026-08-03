-- elERP · schema completo (rode no SQL Editor)
-- Projeto: jdkggegrreixywoyhkmb
-- Depois rode também: catalog_bebidas_br.sql

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Produtos da loja (source of truth)
-- ---------------------------------------------------------------------------
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('g', 'kg', 'un')),
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  barcode text,
  sku text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_products_user_idx on public.store_products (user_id);
create index if not exists store_products_barcode_idx on public.store_products (user_id, barcode);

-- ---------------------------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------------------------
create table if not exists public.store_suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists store_suppliers_user_idx on public.store_suppliers (user_id);

-- ---------------------------------------------------------------------------
-- Caixa / turnos
-- ---------------------------------------------------------------------------
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_float numeric(12,2) not null default 0,
  counted_cash numeric(12,2),
  expected_cash numeric(12,2),
  difference numeric(12,2),
  note text not null default '',
  close_note text not null default ''
);

create index if not exists cash_sessions_user_idx on public.cash_sessions (user_id);
create index if not exists cash_sessions_status_idx on public.cash_sessions (user_id, status);

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.cash_sessions (id) on delete restrict,
  status text not null check (status in ('confirmed', 'cancelled')),
  fiscal_status text not null default 'none',
  total numeric(12,2) not null default 0,
  note text not null default '',
  sold_at timestamptz not null default now()
);

create index if not exists sales_user_idx on public.sales (user_id);
create index if not exists sales_session_idx on public.sales (session_id);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete set null,
  name text not null,
  unit text not null,
  qty numeric(14,3) not null,
  unit_price numeric(12,2) not null,
  cost_snapshot numeric(12,2) not null default 0,
  line_total numeric(12,2) not null
);

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method text not null,
  amount numeric(12,2) not null
);

create index if not exists sale_payments_sale_idx on public.sale_payments (sale_id);

-- ---------------------------------------------------------------------------
-- Movimentos de estoque
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete set null,
  qty_delta numeric(14,3) not null,
  type text not null,
  ref_id text,
  note text not null default '',
  at timestamptz not null default now()
);

create index if not exists stock_movements_user_idx on public.stock_movements (user_id);

-- ---------------------------------------------------------------------------
-- Pedidos de compra
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  supplier_id uuid references public.store_suppliers (id) on delete set null,
  supplier_name text not null,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create index if not exists purchase_orders_user_idx on public.purchase_orders (user_id);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete set null,
  name text not null,
  unit text not null,
  qty_ordered numeric(14,3) not null,
  qty_received numeric(14,3) not null default 0,
  unit_cost numeric(12,2) not null default 0
);

create index if not exists purchase_order_items_order_idx on public.purchase_order_items (order_id);

-- ---------------------------------------------------------------------------
-- Carrinho efêmero (opcional; também pode ficar só no browser)
-- ---------------------------------------------------------------------------
create table if not exists public.store_cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete cascade,
  name text not null,
  unit text not null,
  qty numeric(14,3) not null,
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists store_cart_items_user_idx on public.store_cart_items (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.store_products enable row level security;
alter table public.store_suppliers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.store_cart_items enable row level security;

-- helpers: own row by user_id
do $$
declare
  t text;
begin
  foreach t in array array[
    'store_products','store_suppliers','cash_sessions','sales','stock_movements',
    'purchase_orders','store_cart_items'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t||'_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t||'_select_own', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', t||'_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t||'_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t||'_update_own', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', t||'_delete_own', t);
  end loop;
end $$;

-- sale_items / sale_payments / po_items via parent ownership
drop policy if exists sale_items_select_own on public.sale_items;
create policy sale_items_select_own on public.sale_items for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_items_insert_own on public.sale_items;
create policy sale_items_insert_own on public.sale_items for insert to authenticated
with check (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_items_update_own on public.sale_items;
create policy sale_items_update_own on public.sale_items for update to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()))
with check (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_items_delete_own on public.sale_items;
create policy sale_items_delete_own on public.sale_items for delete to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_payments_select_own on public.sale_payments;
create policy sale_payments_select_own on public.sale_payments for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_payments_insert_own on public.sale_payments;
create policy sale_payments_insert_own on public.sale_payments for insert to authenticated
with check (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_payments_update_own on public.sale_payments;
create policy sale_payments_update_own on public.sale_payments for update to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()))
with check (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists sale_payments_delete_own on public.sale_payments;
create policy sale_payments_delete_own on public.sale_payments for delete to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = auth.uid()));

drop policy if exists po_items_select_own on public.purchase_order_items;
create policy po_items_select_own on public.purchase_order_items for select to authenticated
using (exists (select 1 from public.purchase_orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists po_items_insert_own on public.purchase_order_items;
create policy po_items_insert_own on public.purchase_order_items for insert to authenticated
with check (exists (select 1 from public.purchase_orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists po_items_update_own on public.purchase_order_items;
create policy po_items_update_own on public.purchase_order_items for update to authenticated
using (exists (select 1 from public.purchase_orders o where o.id = order_id and o.user_id = auth.uid()))
with check (exists (select 1 from public.purchase_orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists po_items_delete_own on public.purchase_order_items;
create policy po_items_delete_own on public.purchase_order_items for delete to authenticated
using (exists (select 1 from public.purchase_orders o where o.id = order_id and o.user_id = auth.uid()));

-- updated_at trigger for products
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_store_products_updated on public.store_products;
create trigger trg_store_products_updated
before update on public.store_products
for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.store_products;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.store_suppliers;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.cash_sessions;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.sales;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.sale_items;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.sale_payments;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.stock_movements;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.purchase_orders;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.purchase_order_items;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.store_cart_items;
exception when others then null;
end $$;

-- Permitir unidade kg em bases já criadas com o check antigo (g, un)
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
