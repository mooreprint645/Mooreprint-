-- =====================================================================
-- MOOREPRINT: PERMISOS GRANULARES Y PAGINACIÓN DESDE SUPABASE
-- Ejecutar después de branches.sql y team-workflow.sql.
-- Es seguro volver a ejecutarlo.
-- =====================================================================

-- 1. NUEVOS PERMISOS Y VALORES PREDETERMINADOS
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
    when 'create_quotes' then app_role = 'manager'
    when 'edit_quotes' then app_role = 'manager'
    when 'delete_quotes' then false

    when 'view_customers' then app_role = 'manager'
    when 'create_customers' then app_role = 'manager'
    when 'edit_customers' then app_role = 'manager'
    when 'delete_customers' then false

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

revoke all on function public.has_app_permission(text) from public, anon;
grant execute on function public.has_app_permission(text) to authenticated;

-- 2. POLÍTICAS SEPARADAS PARA CLIENTES
drop policy if exists team_customers_select on public.team_customers;
drop policy if exists team_customers_insert on public.team_customers;
drop policy if exists team_customers_update on public.team_customers;
drop policy if exists team_customers_delete on public.team_customers;

create policy team_customers_select
on public.team_customers
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_customers')
);

create policy team_customers_insert
on public.team_customers
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('create_customers')
  and created_by = (select auth.uid())
);

create policy team_customers_update
on public.team_customers
for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_customers')
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_customers')
);

create policy team_customers_delete
on public.team_customers
for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('delete_customers')
);

-- 3. POLÍTICAS SEPARADAS PARA COTIZACIONES
drop policy if exists team_quotes_select on public.team_quotes;
drop policy if exists team_quotes_insert on public.team_quotes;
drop policy if exists team_quotes_update on public.team_quotes;
drop policy if exists team_quotes_delete on public.team_quotes;

create policy team_quotes_select
on public.team_quotes
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_quotes')
);

create policy team_quotes_insert
on public.team_quotes
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('create_quotes')
  and created_by = (select auth.uid())
);

create policy team_quotes_update
on public.team_quotes
for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_quotes')
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('edit_quotes')
);

create policy team_quotes_delete
on public.team_quotes
for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('delete_quotes')
);

-- 4. ÍNDICES PARA BÚSQUEDA Y PÁGINAS
create index if not exists team_customers_updated_idx
  on public.team_customers (business_id, branch_id, updated_at desc);

create index if not exists team_customers_phone_idx
  on public.team_customers (business_id, phone);

create index if not exists team_quotes_updated_idx
  on public.team_quotes (business_id, branch_id, updated_at desc);

create index if not exists team_quotes_status_idx
  on public.team_quotes (business_id, branch_id, status, updated_at desc);

-- 5. PÁGINA DE CLIENTES
create or replace function public.page_team_customers(
  p_search text default '',
  p_branch_id uuid default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_business uuid := public.current_business_id();
  effective_branch uuid;
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  normalized_search text := trim(coalesce(p_search, ''));
  total_rows bigint;
  result_rows jsonb;
begin
  if not public.has_app_permission('view_customers') then
    raise exception 'No tienes permiso para consultar clientes.';
  end if;

  effective_branch := case
    when public.is_business_admin() then p_branch_id
    else public.current_branch_id()
  end;

  select count(*)
  into total_rows
  from public.team_customers as customer
  where customer.business_id = current_business
    and (effective_branch is null or customer.branch_id = effective_branch)
    and (
      normalized_search = ''
      or customer.name ilike '%' || normalized_search || '%'
      or customer.phone ilike '%' || normalized_search || '%'
      or customer.email ilike '%' || normalized_search || '%'
      or customer.rfc ilike '%' || normalized_search || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.updated_at desc), '[]'::jsonb)
  into result_rows
  from (
    select customer.*
    from public.team_customers as customer
    where customer.business_id = current_business
      and (effective_branch is null or customer.branch_id = effective_branch)
      and (
        normalized_search = ''
        or customer.name ilike '%' || normalized_search || '%'
        or customer.phone ilike '%' || normalized_search || '%'
        or customer.email ilike '%' || normalized_search || '%'
        or customer.rfc ilike '%' || normalized_search || '%'
      )
    order by customer.updated_at desc, customer.customer_id
    offset safe_offset
    limit safe_limit
  ) as page_row;

  return jsonb_build_object(
    'rows', result_rows,
    'total', total_rows,
    'offset', safe_offset,
    'limit', safe_limit
  );
end;
$$;

-- 6. PÁGINA DE COTIZACIONES
create or replace function public.page_team_quotes(
  p_search text default '',
  p_status text default 'all',
  p_branch_id uuid default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_business uuid := public.current_business_id();
  effective_branch uuid;
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  normalized_search text := trim(coalesce(p_search, ''));
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'all');
  include_financials boolean := public.has_app_permission('view_costs');
  total_rows bigint;
  result_rows jsonb;
begin
  if not public.has_app_permission('view_quotes') then
    raise exception 'No tienes permiso para consultar cotizaciones.';
  end if;

  effective_branch := case
    when public.is_business_admin() then p_branch_id
    else public.current_branch_id()
  end;

  select count(*)
  into total_rows
  from public.team_quotes as quote
  where quote.business_id = current_business
    and (effective_branch is null or quote.branch_id = effective_branch)
    and (normalized_status = 'all' or quote.status = normalized_status)
    and (
      normalized_search = ''
      or quote.folio ilike '%' || normalized_search || '%'
      or quote.customer_name ilike '%' || normalized_search || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.updated_at desc), '[]'::jsonb)
  into result_rows
  from (
    select
      quote.*,
      case when include_financials then financial.financial_payload else null end as financial_payload
    from public.team_quotes as quote
    left join public.team_quote_financials as financial
      on financial.business_id = quote.business_id
     and financial.quote_id = quote.quote_id
    where quote.business_id = current_business
      and (effective_branch is null or quote.branch_id = effective_branch)
      and (normalized_status = 'all' or quote.status = normalized_status)
      and (
        normalized_search = ''
        or quote.folio ilike '%' || normalized_search || '%'
        or quote.customer_name ilike '%' || normalized_search || '%'
      )
    order by quote.updated_at desc, quote.quote_id
    offset safe_offset
    limit safe_limit
  ) as page_row;

  return jsonb_build_object(
    'rows', result_rows,
    'total', total_rows,
    'offset', safe_offset,
    'limit', safe_limit
  );
end;
$$;

revoke all on function public.page_team_customers(text, uuid, integer, integer) from public, anon;
revoke all on function public.page_team_quotes(text, text, uuid, integer, integer) from public, anon;

grant execute on function public.page_team_customers(text, uuid, integer, integer) to authenticated;
grant execute on function public.page_team_quotes(text, text, uuid, integer, integer) to authenticated;
