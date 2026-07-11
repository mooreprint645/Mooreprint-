-- ============================================================
-- MOOREPRINT: catálogo, proveedores, inventario y productos
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- Requiere haber ejecutado antes supabase/schema.sql.
-- Es seguro volver a ejecutarlo.
-- ============================================================

-- PROVEEDORES
create table if not exists public.suppliers (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  supplier_id text not null,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  products text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, supplier_id)
);

-- MATERIALES E INVENTARIO
create table if not exists public.materials (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  material_id text not null,
  name text not null,
  sku text not null default '',
  category text not null default '',
  unit text not null default 'pieza',
  stock numeric(16,3) not null default 0,
  min_stock numeric(16,3) not null default 0,
  unit_cost numeric(16,4) not null default 0,
  supplier_id text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, material_id)
);

-- PRODUCTOS QUE VENDE MOOREPRINT
create table if not exists public.products (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null,
  name text not null,
  category text not null default '',
  sale_price numeric(16,2) not null default 0,
  tax_percent numeric(8,3) not null default 0,
  recipe jsonb not null default '[]'::jsonb,
  labor_cost numeric(16,4) not null default 0,
  design_cost numeric(16,4) not null default 0,
  electricity_cost numeric(16,4) not null default 0,
  packaging_cost numeric(16,4) not null default 0,
  transport_cost numeric(16,4) not null default 0,
  external_cost numeric(16,4) not null default 0,
  extra_cost numeric(16,4) not null default 0,
  waste_percent numeric(8,3) not null default 0,
  commission_percent numeric(8,3) not null default 0,
  auto_price boolean not null default false,
  target_margin_percent numeric(8,3) not null default 40,
  price_rounding numeric(12,2) not null default 1,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- PRODUCTOS Y PRECIOS DE CADA PROVEEDOR
create table if not exists public.supplier_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id text not null,
  supplier_id text not null,
  material_id text not null default '',
  name text not null,
  sku text not null default '',
  category text not null default '',
  unit text not null default 'pieza',
  presentation_qty numeric(16,3) not null default 1,
  package_price numeric(16,2) not null default 0,
  shipping_cost numeric(16,2) not null default 0,
  other_cost numeric(16,2) not null default 0,
  unit_cost numeric(16,4) not null default 0,
  preferred boolean not null default false,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- HISTORIAL DE CAMBIOS DE PRECIO
create table if not exists public.supplier_price_history (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  history_id text not null,
  supplier_item_id text not null,
  supplier_id text not null,
  material_id text not null default '',
  old_unit_cost numeric(16,4),
  new_unit_cost numeric(16,4) not null default 0,
  package_price numeric(16,2) not null default 0,
  shipping_cost numeric(16,2) not null default 0,
  other_cost numeric(16,2) not null default 0,
  changed_at timestamptz not null default now(),
  primary key (user_id, history_id)
);

create index if not exists suppliers_user_name_idx on public.suppliers (user_id, name);
create index if not exists materials_user_name_idx on public.materials (user_id, name);
create index if not exists products_user_name_idx on public.products (user_id, name);
create index if not exists supplier_items_user_supplier_idx on public.supplier_items (user_id, supplier_id);
create index if not exists supplier_items_user_material_idx on public.supplier_items (user_id, material_id);
create index if not exists supplier_history_user_item_idx on public.supplier_price_history (user_id, supplier_item_id, changed_at desc);

alter table public.suppliers enable row level security;
alter table public.materials enable row level security;
alter table public.products enable row level security;
alter table public.supplier_items enable row level security;
alter table public.supplier_price_history enable row level security;

-- Elimina políticas anteriores para que este archivo sea repetible.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array['suppliers','materials','products','supplier_items','supplier_price_history'] loop
    foreach policy_name in array array['Authorized users can read','Authorized users can create','Authorized users can update','Authorized users can delete'] loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end $$;

-- Políticas idénticas: usuario autorizado y dueño de la fila.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers','materials','products','supplier_items','supplier_price_history'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_mooreprint_user()) and (select auth.uid()) = user_id)',
      'Authorized users can read', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_mooreprint_user()) and (select auth.uid()) = user_id)',
      'Authorized users can create', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_mooreprint_user()) and (select auth.uid()) = user_id) with check ((select public.is_mooreprint_user()) and (select auth.uid()) = user_id)',
      'Authorized users can update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_mooreprint_user()) and (select auth.uid()) = user_id)',
      'Authorized users can delete', table_name
    );
  end loop;
end $$;

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.supplier_items to authenticated;
grant select, insert, update, delete on public.supplier_price_history to authenticated;

revoke all on public.suppliers from anon;
revoke all on public.materials from anon;
revoke all on public.products from anon;
revoke all on public.supplier_items from anon;
revoke all on public.supplier_price_history from anon;

-- Comprobación opcional después de ejecutar:
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- and table_name in ('suppliers','materials','products','supplier_items','supplier_price_history')
-- order by table_name;
