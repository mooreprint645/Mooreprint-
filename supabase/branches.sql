-- =====================================================================
-- MOOREPRINT: SUCURSALES, EMPLEADOS, PERMISOS Y PEDIDOS COMPARTIDOS
-- Ejecuta este archivo DESPUÉS de schema.sql, catalog.sql y monthly-costs.sql.
-- Es seguro volver a ejecutarlo.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. NEGOCIOS Y SUCURSALES
create table if not exists public.businesses (
  business_id uuid primary key default gen_random_uuid(),
  name text not null default 'MoorePrint',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users
  add column if not exists business_id uuid references public.businesses(business_id) on delete cascade,
  add column if not exists display_name text not null default '',
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users
  add constraint app_users_role_check
  check (role in ('owner', 'admin', 'manager', 'staff'));

create table if not exists public.branches (
  branch_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  name text not null,
  code text not null,
  address text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

alter table public.app_users
  add column if not exists branch_id uuid references public.branches(branch_id) on delete set null;

-- Convierte cada usuario autorizado antiguo en propietario de su propio negocio.
do $$
declare
  app_row record;
  new_business_id uuid;
  new_branch_id uuid;
  new_code text;
begin
  for app_row in
    select user_id, email, role
    from public.app_users
    where business_id is null
  loop
    new_business_id := gen_random_uuid();
    new_branch_id := gen_random_uuid();
    new_code := 'S' || upper(substr(replace(new_branch_id::text, '-', ''), 1, 5));

    insert into public.businesses (business_id, name, created_by)
    values (new_business_id, 'MoorePrint', app_row.user_id);

    insert into public.branches (branch_id, business_id, name, code)
    values (new_branch_id, new_business_id, 'Sucursal principal', new_code);

    update public.app_users
    set business_id = new_business_id,
        branch_id = new_branch_id,
        display_name = case when display_name = '' then split_part(app_row.email, '@', 1) else display_name end,
        role = case when app_row.role = 'admin' then 'owner' else app_row.role end,
        updated_at = now()
    where user_id = app_row.user_id;
  end loop;
end $$;

create index if not exists app_users_business_idx on public.app_users (business_id);
create index if not exists app_users_branch_idx on public.app_users (branch_id);
create index if not exists branches_business_idx on public.branches (business_id, active);

-- 2. FUNCIONES DE SEGURIDAD
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.business_id
  from public.app_users as app_user
  where app_user.user_id = (select auth.uid())
    and app_user.active = true
  limit 1;
$$;

create or replace function public.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.branch_id
  from public.app_users as app_user
  where app_user.user_id = (select auth.uid())
    and app_user.active = true
  limit 1;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.role
  from public.app_users as app_user
  where app_user.user_id = (select auth.uid())
    and app_user.active = true
  limit 1;
$$;

create or replace function public.is_business_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.current_app_role() in ('owner', 'admin')), false);
$$;

create or replace function public.has_app_permission(permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  app_role text;
  app_permissions jsonb;
  default_value boolean := false;
begin
  select role, permissions
  into app_role, app_permissions
  from public.app_users
  where user_id = (select auth.uid())
    and active = true
  limit 1;

  if app_role in ('owner', 'admin') then
    return true;
  end if;

  default_value := case permission_key
    when 'view_orders' then true
    when 'create_orders' then true
    when 'edit_orders' then true
    when 'delete_orders' then false
    when 'manage_payments' then app_role = 'manager'
    when 'view_branch_totals' then true
    when 'view_costs' then false
    when 'view_quotes' then app_role = 'manager'
    when 'view_customers' then app_role = 'manager'
    when 'view_production' then true
    when 'view_calendar' then true
    when 'view_inventory' then app_role = 'manager'
    when 'manage_inventory' then false
    when 'view_finances' then false
    when 'manage_catalog' then false
    when 'manage_users' then false
    else false
  end;

  if app_permissions ? permission_key then
    return coalesce((app_permissions ->> permission_key)::boolean, false);
  end if;

  return default_value;
end;
$$;

create or replace function public.can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_business_admin()
    or target_branch_id = public.current_branch_id(),
    false
  );
$$;

revoke all on function public.current_business_id() from public, anon;
revoke all on function public.current_branch_id() from public, anon;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_business_admin() from public, anon;
revoke all on function public.has_app_permission(text) from public, anon;
revoke all on function public.can_access_branch(uuid) from public, anon;

grant execute on function public.current_business_id() to authenticated;
grant execute on function public.current_branch_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_business_admin() to authenticated;
grant execute on function public.has_app_permission(text) to authenticated;
grant execute on function public.can_access_branch(uuid) to authenticated;

-- 3. PERFIL, SUCURSALES Y EMPLEADOS MEDIANTE RPC
create or replace function public.get_my_branch_profile()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  business_id uuid,
  branch_id uuid,
  permissions jsonb,
  business_name text,
  branch_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.user_id,
    app_user.email,
    app_user.display_name,
    app_user.role,
    app_user.business_id,
    app_user.branch_id,
    app_user.permissions,
    business.name,
    branch.name
  from public.app_users as app_user
  join public.businesses as business on business.business_id = app_user.business_id
  left join public.branches as branch on branch.branch_id = app_user.branch_id
  where app_user.user_id = (select auth.uid())
    and app_user.active = true
    and business.active = true
  limit 1;
$$;

create or replace function public.list_branch_members()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  branch_id uuid,
  branch_name text,
  permissions jsonb,
  active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    member.user_id,
    member.email,
    member.display_name,
    member.role,
    member.branch_id,
    branch.name,
    case when public.is_business_admin() then member.permissions else '{}'::jsonb end,
    member.active,
    member.created_at
  from public.app_users as member
  left join public.branches as branch on branch.branch_id = member.branch_id
  where member.business_id = public.current_business_id()
    and (
      public.is_business_admin()
      or member.branch_id = public.current_branch_id()
    )
  order by member.active desc, member.display_name, member.email;
$$;

create or replace function public.save_branch(
  p_branch_id uuid,
  p_name text,
  p_code text,
  p_address text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  current_business uuid := public.current_business_id();
begin
  if not public.is_business_admin() and not public.has_app_permission('manage_users') then
    raise exception 'No tienes permiso para administrar sucursales.';
  end if;

  if nullif(trim(p_name), '') is null or nullif(trim(p_code), '') is null then
    raise exception 'Escribe el nombre y la clave de la sucursal.';
  end if;

  if p_branch_id is null then
    insert into public.branches (business_id, name, code, address)
    values (current_business, trim(p_name), upper(trim(p_code)), coalesce(trim(p_address), ''))
    returning branch_id into result_id;
  else
    update public.branches
    set name = trim(p_name),
        code = upper(trim(p_code)),
        address = coalesce(trim(p_address), ''),
        updated_at = now()
    where branch_id = p_branch_id
      and business_id = current_business
    returning branch_id into result_id;

    if result_id is null then
      raise exception 'Sucursal no encontrada.';
    end if;
  end if;

  return result_id;
end;
$$;

create or replace function public.set_branch_active(
  p_branch_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_admin() and not public.has_app_permission('manage_users') then
    raise exception 'No tienes permiso para administrar sucursales.';
  end if;

  if p_branch_id = public.current_branch_id() and p_active = false then
    raise exception 'No puedes desactivar la sucursal donde está tu usuario.';
  end if;

  update public.branches
  set active = p_active,
      updated_at = now()
  where branch_id = p_branch_id
    and business_id = public.current_business_id();

  return found;
end;
$$;

create or replace function public.save_branch_member(
  p_email text,
  p_display_name text,
  p_branch_id uuid,
  p_role text,
  p_permissions jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_business uuid := public.current_business_id();
  existing_business uuid;
begin
  if not public.is_business_admin() and not public.has_app_permission('manage_users') then
    raise exception 'No tienes permiso para administrar empleados.';
  end if;

  if p_role not in ('admin', 'manager', 'staff') then
    raise exception 'Rol no permitido.';
  end if;

  if not exists (
    select 1 from public.branches
    where branch_id = p_branch_id
      and business_id = target_business
      and active = true
  ) then
    raise exception 'La sucursal seleccionada no es válida.';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'Primero crea este correo en Authentication > Users > Add user.';
  end if;

  select business_id into existing_business
  from public.app_users
  where user_id = target_user_id;

  if existing_business is not null and existing_business <> target_business then
    raise exception 'Ese correo ya pertenece a otro negocio.';
  end if;

  insert into public.app_users (
    user_id, email, display_name, role, active,
    business_id, branch_id, permissions, updated_at
  )
  values (
    target_user_id,
    lower(trim(p_email)),
    coalesce(nullif(trim(p_display_name), ''), split_part(lower(trim(p_email)), '@', 1)),
    p_role,
    true,
    target_business,
    p_branch_id,
    coalesce(p_permissions, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      role = excluded.role,
      active = true,
      business_id = excluded.business_id,
      branch_id = excluded.branch_id,
      permissions = excluded.permissions,
      updated_at = now();

  return target_user_id;
end;
$$;

create or replace function public.set_branch_member_active(
  p_user_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_admin() and not public.has_app_permission('manage_users') then
    raise exception 'No tienes permiso para administrar empleados.';
  end if;

  if p_user_id = (select auth.uid()) and p_active = false then
    raise exception 'No puedes desactivar tu propia cuenta.';
  end if;

  update public.app_users
  set active = p_active,
      updated_at = now()
  where user_id = p_user_id
    and business_id = public.current_business_id();

  return found;
end;
$$;

revoke all on function public.get_my_branch_profile() from public, anon;
revoke all on function public.list_branch_members() from public, anon;
revoke all on function public.save_branch(uuid, text, text, text) from public, anon;
revoke all on function public.set_branch_active(uuid, boolean) from public, anon;
revoke all on function public.save_branch_member(text, text, uuid, text, jsonb) from public, anon;
revoke all on function public.set_branch_member_active(uuid, boolean) from public, anon;

grant execute on function public.get_my_branch_profile() to authenticated;
grant execute on function public.list_branch_members() to authenticated;
grant execute on function public.save_branch(uuid, text, text, text) to authenticated;
grant execute on function public.set_branch_active(uuid, boolean) to authenticated;
grant execute on function public.save_branch_member(text, text, uuid, text, jsonb) to authenticated;
grant execute on function public.set_branch_member_active(uuid, boolean) to authenticated;

-- 4. PEDIDOS COMPARTIDOS POR SUCURSAL
create table if not exists public.branch_orders (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  order_id text not null,
  folio text not null,
  customer_name text not null default '',
  status text not null default 'pendiente',
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  public_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, order_id),
  unique (business_id, branch_id, folio)
);

create table if not exists public.branch_order_financials (
  business_id uuid not null,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  order_id text not null,
  financial_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (business_id, order_id),
  foreign key (business_id, order_id)
    references public.branch_orders(business_id, order_id)
    on delete cascade
);

create index if not exists branch_orders_branch_status_idx
  on public.branch_orders (business_id, branch_id, status, due_date);
create index if not exists branch_orders_assigned_idx
  on public.branch_orders (business_id, branch_id, assigned_to);

-- Catálogo público: empleados ven nombre y precio, nunca el costo interno.
create table if not exists public.branch_products (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  product_id text not null,
  name text not null,
  category text not null default '',
  sale_price numeric(16,2) not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (business_id, product_id)
);

-- 5. RLS
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.branch_orders enable row level security;
alter table public.branch_order_financials enable row level security;
alter table public.branch_products enable row level security;

drop policy if exists "Business members can read business" on public.businesses;
create policy "Business members can read business"
on public.businesses for select to authenticated
using (business_id = public.current_business_id());

drop policy if exists "Members can read allowed branches" on public.branches;
drop policy if exists "Admins can create branches" on public.branches;
drop policy if exists "Admins can update branches" on public.branches;
drop policy if exists "Admins can delete branches" on public.branches;

create policy "Members can read allowed branches"
on public.branches for select to authenticated
using (
  business_id = public.current_business_id()
  and (public.is_business_admin() or branch_id = public.current_branch_id())
);

create policy "Admins can create branches"
on public.branches for insert to authenticated
with check (
  business_id = public.current_business_id()
  and (public.is_business_admin() or public.has_app_permission('manage_users'))
);

create policy "Admins can update branches"
on public.branches for update to authenticated
using (
  business_id = public.current_business_id()
  and (public.is_business_admin() or public.has_app_permission('manage_users'))
)
with check (
  business_id = public.current_business_id()
  and (public.is_business_admin() or public.has_app_permission('manage_users'))
);

create policy "Admins can delete branches"
on public.branches for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.is_business_admin()
);

drop policy if exists "Members can read branch orders" on public.branch_orders;
drop policy if exists "Members can create branch orders" on public.branch_orders;
drop policy if exists "Members can update branch orders" on public.branch_orders;
drop policy if exists "Admins can delete branch orders" on public.branch_orders;

create policy "Members can read branch orders"
on public.branch_orders for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_orders')
);

create policy "Members can create branch orders"
on public.branch_orders for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('create_orders')
  and created_by = (select auth.uid())
);

create policy "Members can update branch orders"
on public.branch_orders for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_orders')
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_orders')
);

create policy "Admins can delete branch orders"
on public.branch_orders for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('delete_orders')
);

drop policy if exists "Cost users can read order financials" on public.branch_order_financials;
drop policy if exists "Cost users can create order financials" on public.branch_order_financials;
drop policy if exists "Cost users can update order financials" on public.branch_order_financials;
drop policy if exists "Cost users can delete order financials" on public.branch_order_financials;

create policy "Cost users can read order financials"
on public.branch_order_financials for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_costs')
);

create policy "Cost users can create order financials"
on public.branch_order_financials for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_costs')
);

create policy "Cost users can update order financials"
on public.branch_order_financials for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_costs')
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_costs')
);

create policy "Cost users can delete order financials"
on public.branch_order_financials for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_costs')
);

drop policy if exists "Members can read public products" on public.branch_products;
drop policy if exists "Catalog users can create public products" on public.branch_products;
drop policy if exists "Catalog users can update public products" on public.branch_products;
drop policy if exists "Catalog users can delete public products" on public.branch_products;

create policy "Members can read public products"
on public.branch_products for select to authenticated
using (business_id = public.current_business_id());

create policy "Catalog users can create public products"
on public.branch_products for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.has_app_permission('manage_catalog')
);

create policy "Catalog users can update public products"
on public.branch_products for update to authenticated
using (
  business_id = public.current_business_id()
  and public.has_app_permission('manage_catalog')
)
with check (
  business_id = public.current_business_id()
  and public.has_app_permission('manage_catalog')
);

create policy "Catalog users can delete public products"
on public.branch_products for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.has_app_permission('manage_catalog')
);

grant select on public.businesses to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.branch_orders to authenticated;
grant select, insert, update, delete on public.branch_order_financials to authenticated;
grant select, insert, update, delete on public.branch_products to authenticated;

revoke all on public.businesses from anon;
revoke all on public.branches from anon;
revoke all on public.branch_orders from anon;
revoke all on public.branch_order_financials from anon;
revoke all on public.branch_products from anon;

-- 6. VENTAS COMPARTIDAS POR NEGOCIO Y SUCURSAL
alter table public.sales
  add column if not exists business_id uuid references public.businesses(business_id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(branch_id) on delete cascade;

update public.sales as sale
set business_id = app_user.business_id,
    branch_id = app_user.branch_id
from public.app_users as app_user
where app_user.user_id = sale.user_id
  and (sale.business_id is null or sale.branch_id is null);

-- Elimina únicamente filas huérfanas que no pueden asociarse con un usuario autorizado.
delete from public.sales
where business_id is null or branch_id is null;

-- Evita duplicados antiguos antes de cambiar la llave primaria.
delete from public.sales as older
using public.sales as newer
where older.ctid < newer.ctid
  and older.business_id = newer.business_id
  and older.order_id = newer.order_id;

alter table public.sales alter column business_id set not null;
alter table public.sales alter column branch_id set not null;
alter table public.sales drop constraint if exists sales_pkey;
alter table public.sales add constraint sales_pkey primary key (business_id, order_id);

create index if not exists sales_business_branch_date_idx
  on public.sales (business_id, branch_id, sold_at desc);

-- Reemplaza todas las políticas antiguas de ventas.
drop policy if exists "Users can read their own sales" on public.sales;
drop policy if exists "Users can create their own sales" on public.sales;
drop policy if exists "Users can update their own sales" on public.sales;
drop policy if exists "Users can delete their own sales" on public.sales;
drop policy if exists "Authorized users can read their own sales" on public.sales;
drop policy if exists "Authorized users can create their own sales" on public.sales;
drop policy if exists "Authorized users can update their own sales" on public.sales;
drop policy if exists "Authorized users can delete their own sales" on public.sales;
drop policy if exists "Branch users can read sales" on public.sales;
drop policy if exists "Branch users can create sales" on public.sales;
drop policy if exists "Branch users can update sales" on public.sales;
drop policy if exists "Branch admins can delete sales" on public.sales;

create policy "Branch users can read sales"
on public.sales for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_orders')
);

create policy "Branch users can create sales"
on public.sales for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('create_orders')
);

create policy "Branch users can update sales"
on public.sales for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_orders')
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_orders')
);

create policy "Branch admins can delete sales"
on public.sales for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('delete_orders')
);

create or replace function public.sales_summary(
  p_period text default 'month',
  p_from date default null,
  p_to date default null
)
returns table (
  period_start date,
  orders_count bigint,
  sales_total numeric,
  production_cost numeric,
  profit_total numeric,
  paid_total numeric,
  balance_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc(
      case
        when p_period in ('day', 'week', 'month', 'year') then p_period
        else 'month'
      end,
      sold_at::timestamp
    )::date as period_start,
    count(*)::bigint as orders_count,
    coalesce(sum(total), 0)::numeric as sales_total,
    coalesce(sum(production_cost), 0)::numeric as production_cost,
    coalesce(sum(profit), 0)::numeric as profit_total,
    coalesce(sum(paid), 0)::numeric as paid_total,
    coalesce(sum(balance), 0)::numeric as balance_total
  from public.sales
  where business_id = public.current_business_id()
    and public.can_access_branch(branch_id)
    and status <> 'cancelado'
    and (p_from is null or sold_at >= p_from)
    and (p_to is null or sold_at <= p_to)
  group by 1
  order by 1 desc;
$$;

revoke all on function public.sales_summary(text, date, date) from public, anon;
grant execute on function public.sales_summary(text, date, date) to authenticated;

-- Comprobación opcional:
-- select * from public.get_my_branch_profile();
-- select * from public.branches;
-- select * from public.list_branch_members();
