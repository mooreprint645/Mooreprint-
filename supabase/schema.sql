-- ============================================================
-- MOOREPRINT: acceso privado, ventas y reportes
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- Después crea el usuario en Authentication > Users y autorízalo
-- con el bloque indicado al final de este archivo.
-- ============================================================

-- 1. LISTA PRIVADA DE USUARIOS AUTORIZADOS
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

-- La tabla de usuarios autorizados no se consulta directamente desde el navegador.
revoke all on table public.app_users from anon, authenticated;

-- Comprueba que la sesión actual corresponde a un usuario autorizado,
-- activo, existente y con correo confirmado en Supabase Auth.
create or replace function public.is_mooreprint_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users as app_user
    inner join auth.users as auth_user on auth_user.id = app_user.user_id
    where app_user.user_id = (select auth.uid())
      and app_user.active = true
      and auth_user.email_confirmed_at is not null
      and lower(app_user.email) = lower(coalesce(auth_user.email, ''))
  );
$$;

revoke all on function public.is_mooreprint_user() from public, anon;
grant execute on function public.is_mooreprint_user() to authenticated;

-- 2. VENTAS
create table if not exists public.sales (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id text not null,
  folio text not null,
  customer_name text not null default '',
  sold_at date not null,
  status text not null default 'pendiente',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  delivery_charge numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  production_cost numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, order_id)
);

create index if not exists sales_user_date_idx
  on public.sales (user_id, sold_at desc);

create index if not exists sales_user_status_idx
  on public.sales (user_id, status);

alter table public.sales enable row level security;

-- Elimina políticas anteriores para poder ejecutar este archivo varias veces.
drop policy if exists "Users can read their own sales" on public.sales;
drop policy if exists "Users can create their own sales" on public.sales;
drop policy if exists "Users can update their own sales" on public.sales;
drop policy if exists "Users can delete their own sales" on public.sales;
drop policy if exists "Authorized users can read their own sales" on public.sales;
drop policy if exists "Authorized users can create their own sales" on public.sales;
drop policy if exists "Authorized users can update their own sales" on public.sales;
drop policy if exists "Authorized users can delete their own sales" on public.sales;

create policy "Authorized users can read their own sales"
  on public.sales for select
  to authenticated
  using (
    (select public.is_mooreprint_user())
    and (select auth.uid()) = user_id
  );

create policy "Authorized users can create their own sales"
  on public.sales for insert
  to authenticated
  with check (
    (select public.is_mooreprint_user())
    and (select auth.uid()) = user_id
  );

create policy "Authorized users can update their own sales"
  on public.sales for update
  to authenticated
  using (
    (select public.is_mooreprint_user())
    and (select auth.uid()) = user_id
  )
  with check (
    (select public.is_mooreprint_user())
    and (select auth.uid()) = user_id
  );

create policy "Authorized users can delete their own sales"
  on public.sales for delete
  to authenticated
  using (
    (select public.is_mooreprint_user())
    and (select auth.uid()) = user_id
  );

grant select, insert, update, delete on public.sales to authenticated;
revoke all on public.sales from anon;

-- 3. REPORTE POR DÍA, SEMANA, MES O AÑO
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
  where (select public.is_mooreprint_user())
    and user_id = (select auth.uid())
    and status <> 'cancelado'
    and (p_from is null or sold_at >= p_from)
    and (p_to is null or sold_at <= p_to)
  group by 1
  order by 1 desc;
$$;

revoke all on function public.sales_summary(text, date, date) from public, anon;
grant execute on function public.sales_summary(text, date, date) to authenticated;

-- ============================================================
-- 4. AUTORIZAR TU PRIMER CORREO
-- Primero crea el usuario en Authentication > Users > Add user.
-- Después reemplaza el correo del siguiente bloque y ejecútalo.
-- ============================================================

-- insert into public.app_users (user_id, email, role, active, updated_at)
-- select id, email, 'admin', true, now()
-- from auth.users
-- where lower(email) = lower('TU_CORREO@EJEMPLO.COM')
-- on conflict (user_id) do update
-- set email = excluded.email,
--     role = excluded.role,
--     active = true,
--     updated_at = now();

-- Ver usuarios autorizados:
-- select email, role, active, created_at from public.app_users order by created_at;

-- Desactivar un correo sin eliminarlo:
-- update public.app_users set active = false, updated_at = now()
-- where lower(email) = lower('CORREO@EJEMPLO.COM');

-- Reactivar un correo:
-- update public.app_users set active = true, updated_at = now()
-- where lower(email) = lower('CORREO@EJEMPLO.COM');

-- Eliminar completamente la autorización:
-- delete from public.app_users
-- where lower(email) = lower('CORREO@EJEMPLO.COM');
