-- =====================================================================
-- MOOREPRINT: OPERACIONES COMPARTIDAS, PAGINACIÓN Y CONTROL DE RIESGOS
-- Ejecutar después de branches.sql, team-workflow.sql y team-improvements.sql.
-- Es seguro volver a ejecutarlo.
-- No almacena imágenes, diseños ni archivos.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. REGISTROS OPERATIVOS COMPARTIDOS
create table if not exists public.team_records (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  entity_type text not null check (entity_type in (
    'supplier',
    'material',
    'purchase',
    'expense',
    'recurring_expense',
    'cash_transaction',
    'inventory_movement'
  )),
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_on date,
  version bigint not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, entity_type, entity_id)
);

create index if not exists team_records_branch_type_idx
  on public.team_records (business_id, branch_id, entity_type, updated_at desc);

create index if not exists team_records_date_idx
  on public.team_records (business_id, entity_type, occurred_on desc, updated_at desc);

-- 2. BLOQUEOS TEMPORALES PARA EVITAR EDICIONES SIMULTÁNEAS
create table if not exists public.team_edit_locks (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  entity_type text not null check (entity_type in ('order')),
  entity_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null default '',
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 minutes'),
  primary key (business_id, entity_type, entity_id)
);

create index if not exists team_edit_locks_expiry_idx
  on public.team_edit_locks (business_id, expires_at);

-- 3. ERRORES INTERNOS PARA EL PROPIETARIO
create table if not exists public.team_errors (
  error_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid references public.branches(branch_id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null default '',
  source text not null default 'app',
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists team_errors_business_idx
  on public.team_errors (business_id, resolved_at, created_at desc);

-- 4. PERMISOS SEGÚN EL TIPO DE REGISTRO
create or replace function public.can_read_team_record(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type in ('supplier', 'material', 'inventory_movement')
      then public.has_app_permission('view_inventory')
        or public.has_app_permission('manage_inventory')
    when p_entity_type = 'purchase'
      then public.has_app_permission('view_finances')
        or public.has_app_permission('manage_inventory')
    when p_entity_type in ('expense', 'recurring_expense')
      then public.has_app_permission('view_finances')
    when p_entity_type = 'cash_transaction'
      then public.has_app_permission('view_finances')
        or public.has_app_permission('manage_payments')
    else false
  end;
$$;

create or replace function public.can_write_team_record(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type in ('supplier', 'material', 'inventory_movement')
      then public.has_app_permission('manage_inventory')
    when p_entity_type = 'purchase'
      then public.has_app_permission('manage_inventory')
        or public.has_app_permission('view_finances')
    when p_entity_type in ('expense', 'recurring_expense')
      then public.has_app_permission('view_finances')
    when p_entity_type = 'cash_transaction'
      then public.has_app_permission('view_finances')
        or public.has_app_permission('manage_payments')
    else false
  end;
$$;

-- 5. SINCRONIZACIÓN MASIVA DE CADA MÓDULO
create or replace function public.sync_team_records(
  p_entity_type text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value jsonb;
  target_business uuid := public.current_business_id();
  target_branch uuid;
  target_id text;
  target_payload jsonb;
  target_date date;
  affected integer := 0;
begin
  if not public.can_write_team_record(p_entity_type) then
    raise exception 'No tienes permiso para modificar este módulo.';
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de registros no es válida.';
  end if;

  for row_value in
    select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    target_id := nullif(trim(row_value ->> 'entity_id'), '');
    target_branch := nullif(row_value ->> 'branch_id', '')::uuid;
    target_payload := coalesce(row_value -> 'payload', '{}'::jsonb);
    target_date := nullif(row_value ->> 'occurred_on', '')::date;

    if target_id is null or target_branch is null then
      raise exception 'Registro o sucursal no válidos.';
    end if;

    if not public.can_access_branch(target_branch) then
      raise exception 'No tienes acceso a la sucursal indicada.';
    end if;

    insert into public.team_records (
      business_id,
      branch_id,
      entity_type,
      entity_id,
      payload,
      occurred_on,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      target_business,
      target_branch,
      p_entity_type,
      target_id,
      target_payload,
      target_date,
      (select auth.uid()),
      (select auth.uid()),
      coalesce(nullif(row_value ->> 'created_at', '')::timestamptz, now()),
      now()
    )
    on conflict (business_id, entity_type, entity_id)
    do update set
      branch_id = excluded.branch_id,
      payload = excluded.payload,
      occurred_on = excluded.occurred_on,
      version = public.team_records.version + 1,
      updated_by = (select auth.uid()),
      updated_at = now();

    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

create or replace function public.list_team_records(
  p_entity_types text[],
  p_branch_id uuid default null,
  p_limit integer default 5000
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
  safe_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 5000);
  result_rows jsonb;
begin
  effective_branch := case
    when public.is_business_admin() then p_branch_id
    else public.current_branch_id()
  end;

  select coalesce(jsonb_agg(to_jsonb(record_row) order by record_row.updated_at desc), '[]'::jsonb)
  into result_rows
  from (
    select record.*
    from public.team_records as record
    where record.business_id = current_business
      and record.entity_type = any(coalesce(p_entity_types, array[]::text[]))
      and public.can_read_team_record(record.entity_type)
      and (effective_branch is null or record.branch_id = effective_branch)
    order by record.updated_at desc
    limit safe_limit
  ) as record_row;

  return result_rows;
end;
$$;

create or replace function public.delete_team_record(
  p_entity_type text,
  p_entity_id text,
  p_branch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_write_team_record(p_entity_type) then
    raise exception 'No tienes permiso para eliminar este registro.';
  end if;

  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.';
  end if;

  delete from public.team_records
  where business_id = public.current_business_id()
    and branch_id = p_branch_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id;

  return found;
end;
$$;

-- 6. PAGINACIÓN REAL DE PEDIDOS
create or replace function public.page_team_orders(
  p_search text default '',
  p_status text default 'all',
  p_assignment text default 'all',
  p_urgency text default 'all',
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
  normalized_assignment text := coalesce(nullif(trim(p_assignment), ''), 'all');
  normalized_urgency text := coalesce(nullif(trim(p_urgency), ''), 'all');
  include_financials boolean := public.has_app_permission('view_costs');
  total_rows bigint;
  result_rows jsonb;
begin
  if not public.has_app_permission('view_orders') then
    raise exception 'No tienes permiso para consultar pedidos.';
  end if;

  effective_branch := case
    when public.is_business_admin() then p_branch_id
    else public.current_branch_id()
  end;

  select count(*)
  into total_rows
  from public.branch_orders as order_row
  where order_row.business_id = current_business
    and (effective_branch is null or order_row.branch_id = effective_branch)
    and (normalized_status = 'all' or order_row.status = normalized_status)
    and (
      normalized_assignment = 'all'
      or (normalized_assignment = 'mine' and order_row.assigned_to = (select auth.uid()))
      or (normalized_assignment = 'unassigned' and order_row.assigned_to is null)
    )
    and (
      normalized_urgency = 'all'
      or (normalized_urgency = 'urgent' and order_row.public_payload ->> 'priority' = 'urgente')
      or (normalized_urgency = 'overdue' and order_row.due_date < current_date and order_row.status not in ('entregado', 'cancelado'))
      or (normalized_urgency = 'today' and order_row.due_date = current_date)
    )
    and (
      normalized_search = ''
      or order_row.folio ilike '%' || normalized_search || '%'
      or order_row.customer_name ilike '%' || normalized_search || '%'
      or order_row.public_payload::text ilike '%' || normalized_search || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.updated_at desc), '[]'::jsonb)
  into result_rows
  from (
    select
      order_row.*,
      case when include_financials then financial.financial_payload else null end as financial_payload
    from public.branch_orders as order_row
    left join public.branch_order_financials as financial
      on financial.business_id = order_row.business_id
     and financial.order_id = order_row.order_id
    where order_row.business_id = current_business
      and (effective_branch is null or order_row.branch_id = effective_branch)
      and (normalized_status = 'all' or order_row.status = normalized_status)
      and (
        normalized_assignment = 'all'
        or (normalized_assignment = 'mine' and order_row.assigned_to = (select auth.uid()))
        or (normalized_assignment = 'unassigned' and order_row.assigned_to is null)
      )
      and (
        normalized_urgency = 'all'
        or (normalized_urgency = 'urgent' and order_row.public_payload ->> 'priority' = 'urgente')
        or (normalized_urgency = 'overdue' and order_row.due_date < current_date and order_row.status not in ('entregado', 'cancelado'))
        or (normalized_urgency = 'today' and order_row.due_date = current_date)
      )
      and (
        normalized_search = ''
        or order_row.folio ilike '%' || normalized_search || '%'
        or order_row.customer_name ilike '%' || normalized_search || '%'
        or order_row.public_payload::text ilike '%' || normalized_search || '%'
      )
    order by order_row.updated_at desc, order_row.order_id
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

-- 7. HISTORIAL PAGINADO Y EXPORTABLE POR EMPLEADO
create or replace function public.page_team_activity(
  p_user_id uuid default null,
  p_branch_id uuid default null,
  p_from date default null,
  p_to date default null,
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
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 5000);
  total_rows bigint;
  result_rows jsonb;
begin
  if not (
    public.is_business_admin()
    or public.has_app_permission('view_finances')
    or public.has_app_permission('manage_users')
  ) then
    raise exception 'No tienes permiso para consultar el historial.';
  end if;

  effective_branch := case
    when public.is_business_admin() then p_branch_id
    else public.current_branch_id()
  end;

  select count(*)
  into total_rows
  from public.team_activity as activity
  where activity.business_id = current_business
    and (effective_branch is null or activity.branch_id = effective_branch)
    and (p_user_id is null or activity.actor_id = p_user_id)
    and (p_from is null or activity.created_at >= p_from::timestamptz)
    and (p_to is null or activity.created_at < (p_to + 1)::timestamptz);

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc), '[]'::jsonb)
  into result_rows
  from (
    select activity.*
    from public.team_activity as activity
    where activity.business_id = current_business
      and (effective_branch is null or activity.branch_id = effective_branch)
      and (p_user_id is null or activity.actor_id = p_user_id)
      and (p_from is null or activity.created_at >= p_from::timestamptz)
      and (p_to is null or activity.created_at < (p_to + 1)::timestamptz)
    order by activity.created_at desc
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

-- 8. REGISTRO Y RESOLUCIÓN DE ERRORES
create or replace function public.record_team_error(
  p_branch_id uuid,
  p_source text,
  p_message text,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  actor_name text;
  effective_branch uuid := coalesce(p_branch_id, public.current_branch_id());
begin
  if effective_branch is not null and not public.can_access_branch(effective_branch) then
    raise exception 'No tienes acceso a esta sucursal.';
  end if;

  select coalesce(nullif(display_name, ''), email, 'Usuario')
  into actor_name
  from public.app_users
  where user_id = (select auth.uid())
    and active = true
  limit 1;

  insert into public.team_errors (
    business_id,
    branch_id,
    user_id,
    user_name,
    source,
    message,
    detail
  )
  values (
    public.current_business_id(),
    effective_branch,
    (select auth.uid()),
    coalesce(actor_name, 'Usuario'),
    left(coalesce(nullif(trim(p_source), ''), 'app'), 120),
    left(coalesce(nullif(trim(p_message), ''), 'Error sin descripción'), 1000),
    coalesce(p_detail, '{}'::jsonb)
  )
  returning error_id into result_id;

  return result_id;
end;
$$;

create or replace function public.page_team_errors(
  p_include_resolved boolean default false,
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
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  total_rows bigint;
  result_rows jsonb;
begin
  if public.current_app_role() <> 'owner' then
    raise exception 'Solo el propietario puede consultar los errores internos.';
  end if;

  select count(*)
  into total_rows
  from public.team_errors as error_row
  where error_row.business_id = public.current_business_id()
    and (p_include_resolved or error_row.resolved_at is null);

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc), '[]'::jsonb)
  into result_rows
  from (
    select error_row.*
    from public.team_errors as error_row
    where error_row.business_id = public.current_business_id()
      and (p_include_resolved or error_row.resolved_at is null)
    order by error_row.created_at desc
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

create or replace function public.resolve_team_error(p_error_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() <> 'owner' then
    raise exception 'Solo el propietario puede resolver errores internos.';
  end if;

  update public.team_errors
  set resolved_at = now(),
      resolved_by = (select auth.uid())
  where error_id = p_error_id
    and business_id = public.current_business_id()
    and resolved_at is null;

  return found;
end;
$$;

-- 9. BLOQUEO TEMPORAL DE EDICIÓN DE PEDIDOS
create or replace function public.acquire_team_edit_lock(
  p_entity_type text,
  p_entity_id text,
  p_branch_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_business uuid := public.current_business_id();
  current_user uuid := (select auth.uid());
  actor_name text;
  lock_row public.team_edit_locks%rowtype;
  acquired boolean := false;
begin
  if p_entity_type <> 'order' then
    raise exception 'Solo los pedidos admiten bloqueo de edición.';
  end if;

  if not public.has_app_permission('edit_orders') then
    raise exception 'No tienes permiso para editar pedidos.';
  end if;

  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_business::text || ':' || p_entity_type || ':' || p_entity_id));

  delete from public.team_edit_locks
  where business_id = current_business
    and expires_at <= now();

  select coalesce(nullif(display_name, ''), email, 'Usuario')
  into actor_name
  from public.app_users
  where user_id = current_user
  limit 1;

  select * into lock_row
  from public.team_edit_locks
  where business_id = current_business
    and entity_type = p_entity_type
    and entity_id = p_entity_id;

  if lock_row.entity_id is null then
    insert into public.team_edit_locks (
      business_id, branch_id, entity_type, entity_id, user_id, user_name
    ) values (
      current_business, p_branch_id, p_entity_type, p_entity_id,
      current_user, coalesce(actor_name, 'Usuario')
    )
    returning * into lock_row;
    acquired := true;
  elsif lock_row.user_id = current_user or p_force then
    update public.team_edit_locks
    set branch_id = p_branch_id,
        user_id = current_user,
        user_name = coalesce(actor_name, 'Usuario'),
        acquired_at = case when lock_row.user_id = current_user then lock_row.acquired_at else now() end,
        heartbeat_at = now(),
        expires_at = now() + interval '3 minutes'
    where business_id = current_business
      and entity_type = p_entity_type
      and entity_id = p_entity_id
    returning * into lock_row;
    acquired := true;
  end if;

  return jsonb_build_object(
    'acquired', acquired,
    'entity_type', lock_row.entity_type,
    'entity_id', lock_row.entity_id,
    'user_id', lock_row.user_id,
    'user_name', lock_row.user_name,
    'expires_at', lock_row.expires_at
  );
end;
$$;

create or replace function public.heartbeat_team_edit_lock(
  p_entity_type text,
  p_entity_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_edit_locks
  set heartbeat_at = now(),
      expires_at = now() + interval '3 minutes'
  where business_id = public.current_business_id()
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and user_id = (select auth.uid());

  return found;
end;
$$;

create or replace function public.release_team_edit_lock(
  p_entity_type text,
  p_entity_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.team_edit_locks
  where business_id = public.current_business_id()
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and user_id = (select auth.uid());

  return found;
end;
$$;

-- 10. RLS
alter table public.team_records enable row level security;
alter table public.team_edit_locks enable row level security;
alter table public.team_errors enable row level security;

drop policy if exists team_records_select on public.team_records;
create policy team_records_select
on public.team_records
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.can_read_team_record(entity_type)
);

drop policy if exists team_errors_owner_select on public.team_errors;
create policy team_errors_owner_select
on public.team_errors
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.current_app_role() = 'owner'
);

-- Las escrituras se realizan exclusivamente mediante RPC de seguridad.

-- 11. PERMISOS DE FUNCIONES Y TABLAS
revoke all on function public.can_read_team_record(text) from public, anon;
revoke all on function public.can_write_team_record(text) from public, anon;
revoke all on function public.sync_team_records(text, jsonb) from public, anon;
revoke all on function public.list_team_records(text[], uuid, integer) from public, anon;
revoke all on function public.delete_team_record(text, text, uuid) from public, anon;
revoke all on function public.page_team_orders(text, text, text, text, uuid, integer, integer) from public, anon;
revoke all on function public.page_team_activity(uuid, uuid, date, date, integer, integer) from public, anon;
revoke all on function public.record_team_error(uuid, text, text, jsonb) from public, anon;
revoke all on function public.page_team_errors(boolean, integer, integer) from public, anon;
revoke all on function public.resolve_team_error(uuid) from public, anon;
revoke all on function public.acquire_team_edit_lock(text, text, uuid, boolean) from public, anon;
revoke all on function public.heartbeat_team_edit_lock(text, text) from public, anon;
revoke all on function public.release_team_edit_lock(text, text) from public, anon;

grant execute on function public.can_read_team_record(text) to authenticated;
grant execute on function public.can_write_team_record(text) to authenticated;
grant execute on function public.sync_team_records(text, jsonb) to authenticated;
grant execute on function public.list_team_records(text[], uuid, integer) to authenticated;
grant execute on function public.delete_team_record(text, text, uuid) to authenticated;
grant execute on function public.page_team_orders(text, text, text, text, uuid, integer, integer) to authenticated;
grant execute on function public.page_team_activity(uuid, uuid, date, date, integer, integer) to authenticated;
grant execute on function public.record_team_error(uuid, text, text, jsonb) to authenticated;
grant execute on function public.page_team_errors(boolean, integer, integer) to authenticated;
grant execute on function public.resolve_team_error(uuid) to authenticated;
grant execute on function public.acquire_team_edit_lock(text, text, uuid, boolean) to authenticated;
grant execute on function public.heartbeat_team_edit_lock(text, text) to authenticated;
grant execute on function public.release_team_edit_lock(text, text) to authenticated;

grant select on public.team_records to authenticated;
grant select on public.team_errors to authenticated;

revoke all on public.team_edit_locks from authenticated;

-- 12. REALTIME PARA LOS MÓDULOS COMPARTIDOS
alter table public.team_records replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_records'
  ) then
    alter publication supabase_realtime add table public.team_records;
  end if;
exception
  when undefined_object then null;
end
$$;
