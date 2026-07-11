-- MoorePrint: ventas en Supabase
-- Ejecuta este archivo completo en Supabase > SQL Editor.

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

drop policy if exists "Users can read their own sales" on public.sales;
create policy "Users can read their own sales"
  on public.sales for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own sales" on public.sales;
create policy "Users can create their own sales"
  on public.sales for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own sales" on public.sales;
create policy "Users can update their own sales"
  on public.sales for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own sales" on public.sales;
create policy "Users can delete their own sales"
  on public.sales for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.sales to authenticated;

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
  where user_id = (select auth.uid())
    and status <> 'cancelado'
    and (p_from is null or sold_at >= p_from)
    and (p_to is null or sold_at <= p_to)
  group by 1
  order by 1 desc;
$$;

grant execute on function public.sales_summary(text, date, date) to authenticated;
