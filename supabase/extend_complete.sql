-- elERP · extensão sistema completo
-- Rode DEPOIS de full_schema.sql (e catalog_bebidas_br.sql se ainda não rodou)
-- Projeto: jdkggegrreixywoyhkmb

-- ---------------------------------------------------------------------------
-- Dados da loja (1 loja por conta)
-- ---------------------------------------------------------------------------
create table if not exists public.store_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trade_name text not null default 'Minha loja',
  legal_name text not null default '',
  cnpj text not null default '',
  ie text not null default '',
  phone text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  receipt_message text not null default 'Obrigado pela preferência!',
  fiscal_mode text not null default 'nao_fiscal'
    check (fiscal_mode in ('nao_fiscal', 'nfce_futuro')),
  csc_id text not null default '',
  csc_token text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;

drop policy if exists store_settings_select_own on public.store_settings;
create policy store_settings_select_own on public.store_settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists store_settings_insert_own on public.store_settings;
create policy store_settings_insert_own on public.store_settings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists store_settings_update_own on public.store_settings;
create policy store_settings_update_own on public.store_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists store_settings_delete_own on public.store_settings;
create policy store_settings_delete_own on public.store_settings
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Equipe (papéis por conta dona)
-- ---------------------------------------------------------------------------
create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_user_id uuid references auth.users (id) on delete set null,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'cashier')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

create index if not exists store_members_user_idx on public.store_members (user_id);
create index if not exists store_members_email_idx on public.store_members (email);

alter table public.store_members enable row level security;

drop policy if exists store_members_select_own on public.store_members;
create policy store_members_select_own on public.store_members
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists store_members_insert_own on public.store_members;
create policy store_members_insert_own on public.store_members
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists store_members_update_own on public.store_members;
create policy store_members_update_own on public.store_members
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists store_members_delete_own on public.store_members;
create policy store_members_delete_own on public.store_members
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Complementos de produto
-- ---------------------------------------------------------------------------
create table if not exists public.product_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.store_products (id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_addons_user_idx on public.product_addons (user_id);
create index if not exists product_addons_product_idx on public.product_addons (product_id);

alter table public.product_addons enable row level security;

drop policy if exists product_addons_select_own on public.product_addons;
create policy product_addons_select_own on public.product_addons
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists product_addons_insert_own on public.product_addons;
create policy product_addons_insert_own on public.product_addons
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists product_addons_update_own on public.product_addons;
create policy product_addons_update_own on public.product_addons
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists product_addons_delete_own on public.product_addons;
create policy product_addons_delete_own on public.product_addons
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Complementos por linha de venda
-- ---------------------------------------------------------------------------
create table if not exists public.sale_item_addons (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id) on delete cascade,
  addon_id uuid references public.product_addons (id) on delete set null,
  name text not null,
  price numeric(12,2) not null default 0
);

create index if not exists sale_item_addons_item_idx on public.sale_item_addons (sale_item_id);

alter table public.sale_item_addons enable row level security;

drop policy if exists sale_item_addons_select_own on public.sale_item_addons;
create policy sale_item_addons_select_own on public.sale_item_addons
  for select to authenticated
  using (
    exists (
      select 1
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
      where i.id = sale_item_id and s.user_id = auth.uid()
    )
  );

drop policy if exists sale_item_addons_insert_own on public.sale_item_addons;
create policy sale_item_addons_insert_own on public.sale_item_addons
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
      where i.id = sale_item_id and s.user_id = auth.uid()
    )
  );

drop policy if exists sale_item_addons_delete_own on public.sale_item_addons;
create policy sale_item_addons_delete_own on public.sale_item_addons
  for delete to authenticated
  using (
    exists (
      select 1
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
      where i.id = sale_item_id and s.user_id = auth.uid()
    )
  );

-- Troco / nota em vendas
alter table public.sales add column if not exists change_amount numeric(12,2) not null default 0;

-- Fiscal status ampliado (mantém valores antigos)
do $$
begin
  -- sem drop de check anônimo: apenas documentamos valores usados pelo app:
  -- none | nao_fiscal | pendente_nfce
  null;
end $$;

-- Realtime
do $$ begin alter publication supabase_realtime add table public.store_settings; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.store_members; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.product_addons; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.sale_item_addons; exception when others then null; end $$;
