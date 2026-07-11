-- =====================================================================
-- MOOREPRINT: ENDURECIMIENTO GENERAL DEL TRABAJO EN EQUIPO
-- Ejecutar después de team-workflow.sql, team-improvements.sql y
-- team-operations.sql. Es seguro volver a ejecutarlo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PERMISOS DETALLADOS Y COMPATIBILIDAD CON PERMISOS ANTERIORES
-- ---------------------------------------------------------------------
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
  legacy_inventory boolean := false;
  legacy_finances boolean := false;
  legacy_catalog boolean := false;
  legacy_payments boolean := false;
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

  app_permissions := coalesce(app_permissions, '{}'::jsonb);
  legacy_inventory := coalesce((app_permissions ->> 'manage_inventory')::boolean, false);
  legacy_finances := coalesce((app_permissions ->> 'view_finances')::boolean, false);
  legacy_catalog := coalesce((app_permissions ->> 'manage_catalog')::boolean, false);
  legacy_payments := coalesce((app_permissions ->> 'manage_payments')::boolean, app_role = 'manager');

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

    when 'create_customers' then app_role = 'manager'
    when 'edit_customers' then app_role = 'manager'
    when 'delete_customers' then false
    when 'create_quotes' then app_role = 'manager'
    when 'edit_quotes' then app_role = 'manager'
    when 'delete_quotes' then false

    when 'view_suppliers' then legacy_catalog
    when 'create_suppliers' then legacy_catalog
    when 'edit_suppliers' then legacy_catalog
    when 'delete_suppliers' then false

    when 'view_materials' then app_role = 'manager' or legacy_inventory
    when 'create_materials' then legacy_inventory
    when 'edit_materials' then legacy_inventory
    when 'delete_materials' then false
    when 'adjust_inventory' then legacy_inventory

    when 'view_purchases' then legacy_finances
    when 'create_purchases' then legacy_inventory or legacy_finances
    when 'edit_purchases' then legacy_inventory or legacy_finances
    when 'cancel_purchases' then false

    when 'view_expenses' then legacy_finances
    when 'create_expenses' then legacy_finances
    when 'edit_expenses' then legacy_finances
    when 'delete_expenses' then false

    when 'view_cash' then legacy_finances or legacy_payments
    when 'create_cash_transactions' then legacy_finances
    when 'edit_cash_transactions' then legacy_finances
    when 'delete_cash_transactions' then false
    when 'register_payments' then legacy_payments
    when 'create_cash_closings' then legacy_payments
    when 'edit_cash_closings' then false
    when 'view_activity' then legacy_finances
    when 'export_activity' then legacy_finances
    when 'restore_backups' then false
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

-- ---------------------------------------------------------------------
-- 2. PERMISOS POR TIPO DE REGISTRO OPERATIVO
-- ---------------------------------------------------------------------
create or replace function public.can_read_team_record(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type = 'supplier'
      then public.has_app_permission('view_suppliers')
    when p_entity_type in ('material', 'inventory_movement')
      then public.has_app_permission('view_materials')
    when p_entity_type = 'purchase'
      then public.has_app_permission('view_purchases')
    when p_entity_type in ('expense', 'recurring_expense')
      then public.has_app_permission('view_expenses')
    when p_entity_type = 'cash_transaction'
      then public.has_app_permission('view_cash')
    else false
  end;
$$;

create or replace function public.can_create_team_record(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type = 'supplier' then public.has_app_permission('create_suppliers')
    when p_entity_type = 'material' then public.has_app_permission('create_materials')
    when p_entity_type = 'inventory_movement' then public.has_app_permission('adjust_inventory')
    when p_entity_type = 'purchase' then public.has_app_permission('create_purchases')
    when p_entity_type in ('expense', 'recurring_expense') then public.has_app_permission('create_expenses')
    when p_entity_type = 'cash_transaction' then public.has_app_permission('create_cash_transactions')
    else false
  end;
$$;

create or replace function public.can_edit_team_record(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type = 'supplier' then public.has_app_permission('edit_suppliers')
    when p_entity_type = 'material' then public.has_app_permission('edit_materials')
    when p_entity_type = 'inventory_movement' then public.has_app_permission('adjust_inventory')
    when p_entity_type = 'purchase' then public.has_app_permission('edit_purchases')
    when p_entity_type in ('expense', 'recurring_expense') then public.has_app_permission('edit_expenses')
    when p_entity_type = 'cash_transaction' then public.has_app_permission('edit_cash_transactions')
    else false
  end;
$$;

create or replace function public.can_delete_team_record(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type = 'supplier' then public.has_app_permission('delete_suppliers')
    when p_entity_type = 'material' then public.has_app_permission('delete_materials')
    when p_entity_type = 'inventory_movement' then false
    when p_entity_type = 'purchase' then public.has_app_permission('cancel_purchases')
    when p_entity_type in ('expense', 'recurring_expense') then public.has_app_permission('delete_expenses')
    when p_entity_type = 'cash_transaction' then public.has_app_permission('delete_cash_transactions')
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
  select public.can_create_team_record(p_entity_type)
      or public.can_edit_team_record(p_entity_type)
      or public.can_delete_team_record(p_entity_type);
$$;

-- ---------------------------------------------------------------------
-- 3. IDENTIFICADORES DE OPERACIÓN PARA REINTENTOS SIN DUPLICADOS
-- ---------------------------------------------------------------------
create table if not exists public.team_operation_log (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  operation_id uuid not null,
  branch_id uuid references public.branches(branch_id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  operation_count integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, operation_id)
);

create index if not exists team_operation_log_created_idx
  on public.team_operation_log (business_id, created_at desc);

alter table public.team_operation_log enable row level security;
revoke all on public.team_operation_log from authenticated, anon, public;

-- ---------------------------------------------------------------------
-- 4. AYUDANTES PARA SEPARAR INFORMACIÓN PÚBLICA Y COSTOS INTERNOS
-- ---------------------------------------------------------------------
create or replace function public.document_public_payload(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  result_payload jsonb := coalesce(p_payload, '{}'::jsonb)
    - 'deliveryCost'
    - 'inventoryApplied'
    - 'inventorySnapshot';
  safe_items jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_payload -> 'items', '[]'::jsonb)) = 'array' then
    select coalesce(jsonb_agg(item - 'cost' - 'recipe'), '[]'::jsonb)
    into safe_items
    from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) as item;
  end if;

  return jsonb_set(result_payload, '{items}', safe_items, true);
end;
$$;

create or replace function public.document_financial_payload(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  item_costs jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_payload -> 'items', '[]'::jsonb)) = 'array' then
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'cost', coalesce(item -> 'cost', '0'::jsonb),
        'recipe', coalesce(item -> 'recipe', '[]'::jsonb)
      )),
      '[]'::jsonb
    )
    into item_costs
    from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) as item;
  end if;

  return jsonb_build_object(
    'itemCosts', item_costs,
    'deliveryCost', coalesce(p_payload -> 'deliveryCost', '0'::jsonb),
    'inventoryApplied', coalesce(p_payload -> 'inventoryApplied', 'false'::jsonb),
    'inventorySnapshot', coalesce(p_payload -> 'inventorySnapshot', '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. TRANSACCIÓN ATÓMICA PARA PEDIDOS, INVENTARIO, COMPRAS, PAGOS Y CAJA
-- ---------------------------------------------------------------------
create or replace function public.commit_team_batch(
  p_operation_id uuid,
  p_branch_id uuid,
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_business uuid := public.current_business_id();
  current_user uuid := (select auth.uid());
  operation_value jsonb;
  operation_kind text;
  operation_action text;
  target_type text;
  target_id text;
  target_branch uuid;
  target_payload jsonb;
  target_date date;
  expected_version bigint;
  current_version bigint;
  exists_row boolean;
  affected_count integer := 0;
  versions jsonb := '[]'::jsonb;
  stored_result jsonb;
  has_inventory_context boolean := false;
begin
  if p_operation_id is null then
    raise exception 'La operación no tiene identificador.';
  end if;

  if jsonb_typeof(coalesce(p_operations, '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de operaciones no es válida.';
  end if;

  if p_branch_id is not null and not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a la sucursal de esta operación.';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_business::text || ':' || p_operation_id::text));

  select result
  into stored_result
  from public.team_operation_log
  where business_id = current_business
    and operation_id = p_operation_id;

  if stored_result is not null then
    return stored_result || jsonb_build_object('replayed', true);
  end if;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) as operation_row(value)
    where operation_row.value ->> 'kind' = 'order_upsert'
       or (
         operation_row.value ->> 'kind' = 'record_upsert'
         and operation_row.value ->> 'entity_type' = 'purchase'
       )
  ) into has_inventory_context;

  for operation_value in
    select value from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb))
  loop
    operation_kind := coalesce(operation_value ->> 'kind', '');
    operation_action := coalesce(operation_value ->> 'action', 'save');
    target_type := coalesce(operation_value ->> 'entity_type', '');
    target_id := nullif(trim(operation_value ->> 'entity_id'), '');
    target_branch := coalesce(nullif(operation_value ->> 'branch_id', '')::uuid, p_branch_id);
    target_payload := coalesce(operation_value -> 'payload', '{}'::jsonb);
    target_date := nullif(operation_value ->> 'occurred_on', '')::date;
    expected_version := nullif(operation_value ->> 'expected_version', '')::bigint;

    if target_branch is null or not public.can_access_branch(target_branch) then
      raise exception 'La operación contiene una sucursal no permitida.';
    end if;

    if operation_kind = 'record_upsert' then
      if target_id is null then
        raise exception 'El registro operativo no tiene identificador.';
      end if;

      select version
      into current_version
      from public.team_records
      where business_id = current_business
        and entity_type = target_type
        and entity_id = target_id
      for update;

      exists_row := found;

      if operation_action = 'payment' then
        if not public.has_app_permission('register_payments') then
          raise exception 'No tienes permiso para registrar pagos.';
        end if;
      elsif operation_action = 'derived_inventory' and has_inventory_context then
        null;
      elsif exists_row then
        if not public.can_edit_team_record(target_type) then
          raise exception 'No tienes permiso para editar este registro.';
        end if;
      else
        if not public.can_create_team_record(target_type) then
          raise exception 'No tienes permiso para crear este registro.';
        end if;
      end if;

      if expected_version is not null and exists_row and current_version <> expected_version then
        raise exception 'CONFLICT: otro integrante modificó % antes que tú.', target_id;
      end if;

      insert into public.team_records (
        business_id, branch_id, entity_type, entity_id, payload,
        occurred_on, version, created_by, updated_by, created_at, updated_at
      )
      values (
        current_business, target_branch, target_type, target_id, target_payload,
        target_date, 1, current_user, current_user,
        coalesce(nullif(operation_value ->> 'created_at', '')::timestamptz, now()), now()
      )
      on conflict (business_id, entity_type, entity_id)
      do update set
        branch_id = excluded.branch_id,
        payload = excluded.payload,
        occurred_on = excluded.occurred_on,
        version = public.team_records.version + 1,
        updated_by = current_user,
        updated_at = now()
      returning version into current_version;

      versions := versions || jsonb_build_array(jsonb_build_object(
        'entity_type', target_type,
        'entity_id', target_id,
        'version', current_version
      ));
      affected_count := affected_count + 1;

    elsif operation_kind = 'record_delete' then
      if target_id is null or not public.can_delete_team_record(target_type) then
        raise exception 'No tienes permiso para eliminar este registro.';
      end if;

      delete from public.team_records
      where business_id = current_business
        and branch_id = target_branch
        and entity_type = target_type
        and entity_id = target_id;
      affected_count := affected_count + 1;

    elsif operation_kind = 'order_upsert' then
      if target_id is null then
        raise exception 'El pedido no tiene identificador.';
      end if;

      select exists (
        select 1 from public.branch_orders
        where business_id = current_business and order_id = target_id
      ) into exists_row;

      if operation_action = 'payment' then
        if not public.has_app_permission('register_payments') then
          raise exception 'No tienes permiso para registrar pagos.';
        end if;
      elsif exists_row then
        if not public.has_app_permission('edit_orders') then
          raise exception 'No tienes permiso para editar pedidos.';
        end if;
      else
        if not public.has_app_permission('create_orders') then
          raise exception 'No tienes permiso para crear pedidos.';
        end if;
      end if;

      insert into public.branch_orders (
        business_id, branch_id, order_id, folio, customer_name,
        status, due_date, assigned_to, public_payload,
        created_by, updated_by, created_at, updated_at
      )
      values (
        current_business,
        target_branch,
        target_id,
        coalesce(target_payload ->> 'folio', ''),
        coalesce(target_payload ->> 'customer', ''),
        coalesce(nullif(target_payload ->> 'status', ''), 'pendiente'),
        nullif(target_payload ->> 'dueDate', '')::date,
        nullif(target_payload ->> 'assignedTo', '')::uuid,
        public.document_public_payload(target_payload),
        coalesce(nullif(target_payload ->> 'createdBy', '')::uuid, current_user),
        current_user,
        coalesce(nullif(target_payload ->> 'createdAt', '')::timestamptz, now()),
        now()
      )
      on conflict (business_id, order_id)
      do update set
        branch_id = excluded.branch_id,
        folio = excluded.folio,
        customer_name = excluded.customer_name,
        status = excluded.status,
        due_date = excluded.due_date,
        assigned_to = excluded.assigned_to,
        public_payload = excluded.public_payload,
        updated_by = current_user,
        updated_at = now();

      if public.has_app_permission('view_costs') then
        insert into public.branch_order_financials (
          business_id, branch_id, order_id, financial_payload, updated_at
        )
        values (
          current_business, target_branch, target_id,
          public.document_financial_payload(target_payload), now()
        )
        on conflict (business_id, order_id)
        do update set
          branch_id = excluded.branch_id,
          financial_payload = excluded.financial_payload,
          updated_at = now();
      end if;

      affected_count := affected_count + 1;

    elsif operation_kind = 'order_delete' then
      if target_id is null or not public.has_app_permission('delete_orders') then
        raise exception 'No tienes permiso para eliminar pedidos.';
      end if;

      delete from public.branch_orders
      where business_id = current_business
        and branch_id = target_branch
        and order_id = target_id;
      affected_count := affected_count + 1;

    elsif operation_kind = 'cash_closing_upsert' then
      target_id := coalesce(target_id, current_user::text || ':' || coalesce(target_payload ->> 'closing_date', current_date::text));

      select exists (
        select 1 from public.team_cash_closings
        where business_id = current_business
          and branch_id = target_branch
          and user_id = coalesce(nullif(target_payload ->> 'user_id', '')::uuid, current_user)
          and closing_date = coalesce(nullif(target_payload ->> 'closing_date', '')::date, current_date)
      ) into exists_row;

      if exists_row then
        if not public.has_app_permission('edit_cash_closings') then
          raise exception 'No tienes permiso para corregir cortes de caja.';
        end if;
      else
        if not public.has_app_permission('create_cash_closings') then
          raise exception 'No tienes permiso para realizar cortes de caja.';
        end if;
      end if;

      insert into public.team_cash_closings (
        business_id, branch_id, user_id, user_name, closing_date,
        opening_amount, cash_income, cash_out, expected_cash,
        counted_cash, difference, notes, payload, created_at
      )
      values (
        current_business,
        target_branch,
        coalesce(nullif(target_payload ->> 'user_id', '')::uuid, current_user),
        coalesce(target_payload ->> 'user_name', 'Usuario'),
        coalesce(nullif(target_payload ->> 'closing_date', '')::date, current_date),
        coalesce((target_payload ->> 'opening_amount')::numeric, 0),
        coalesce((target_payload ->> 'cash_income')::numeric, 0),
        coalesce((target_payload ->> 'cash_out')::numeric, 0),
        coalesce((target_payload ->> 'expected_cash')::numeric, 0),
        coalesce((target_payload ->> 'counted_cash')::numeric, 0),
        coalesce((target_payload ->> 'difference')::numeric, 0),
        coalesce(target_payload ->> 'notes', ''),
        coalesce(target_payload -> 'payload', '{}'::jsonb),
        now()
      )
      on conflict (business_id, branch_id, user_id, closing_date)
      do update set
        user_name = excluded.user_name,
        opening_amount = excluded.opening_amount,
        cash_income = excluded.cash_income,
        cash_out = excluded.cash_out,
        expected_cash = excluded.expected_cash,
        counted_cash = excluded.counted_cash,
        difference = excluded.difference,
        notes = excluded.notes,
        payload = excluded.payload;

      affected_count := affected_count + 1;

    else
      raise exception 'Tipo de operación no reconocido: %.', operation_kind;
    end if;
  end loop;

  stored_result := jsonb_build_object(
    'ok', true,
    'operation_id', p_operation_id,
    'affected', affected_count,
    'versions', versions,
    'replayed', false
  );

  insert into public.team_operation_log (
    business_id, operation_id, branch_id, actor_id,
    operation_count, result
  )
  values (
    current_business, p_operation_id, p_branch_id, current_user,
    affected_count, stored_result
  );

  delete from public.team_operation_log
  where business_id = current_business
    and created_at < now() - interval '45 days';

  return stored_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RESTAURACIÓN ATÓMICA DE RESPALDOS AUTOMÁTICOS
-- ---------------------------------------------------------------------
create or replace function public.restore_team_backup(p_backup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_business uuid := public.current_business_id();
  current_user uuid := (select auth.uid());
  fallback_branch uuid := public.current_branch_id();
  snapshot_value jsonb;
  row_value jsonb;
  collection_value jsonb;
  mapping_value jsonb;
  target_type text;
  target_branch uuid;
  restored_count integer := 0;
begin
  if public.current_app_role() <> 'owner'
     and not public.has_app_permission('restore_backups') then
    raise exception 'Solo el propietario puede restaurar respaldos.';
  end if;

  select snapshot
  into snapshot_value
  from public.team_backups
  where backup_id = p_backup_id
    and business_id = current_business;

  if snapshot_value is null or jsonb_typeof(snapshot_value) <> 'object' then
    raise exception 'El respaldo no existe o no es válido.';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_business::text || ':restore-backup'));

  delete from public.team_records where business_id = current_business;
  delete from public.branch_orders where business_id = current_business;
  delete from public.team_quotes where business_id = current_business;
  delete from public.team_customers where business_id = current_business;
  delete from public.branch_products where business_id = current_business;

  if jsonb_typeof(coalesce(snapshot_value -> 'customers', '[]'::jsonb)) = 'array' then
    for row_value in select value from jsonb_array_elements(snapshot_value -> 'customers')
    loop
      target_branch := coalesce(nullif(row_value ->> 'branchId', '')::uuid, fallback_branch);
      if exists (select 1 from public.branches where branch_id = target_branch and business_id = current_business) then
        insert into public.team_customers (
          business_id, branch_id, customer_id, name, phone, email,
          rfc, address, notes, payload, created_by, updated_by,
          created_at, updated_at
        ) values (
          current_business, target_branch, row_value ->> 'id',
          coalesce(row_value ->> 'name', ''), coalesce(row_value ->> 'phone', ''),
          coalesce(row_value ->> 'email', ''), coalesce(row_value ->> 'rfc', ''),
          coalesce(row_value ->> 'address', ''), coalesce(row_value ->> 'notes', ''),
          row_value, current_user, current_user,
          coalesce(nullif(row_value ->> 'createdAt', '')::timestamptz, now()), now()
        );
        restored_count := restored_count + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(coalesce(snapshot_value -> 'quotes', '[]'::jsonb)) = 'array' then
    for row_value in select value from jsonb_array_elements(snapshot_value -> 'quotes')
    loop
      target_branch := coalesce(nullif(row_value ->> 'branchId', '')::uuid, fallback_branch);
      if exists (select 1 from public.branches where branch_id = target_branch and business_id = current_business) then
        insert into public.team_quotes (
          business_id, branch_id, quote_id, folio, customer_name,
          status, valid_until, public_payload, created_by, updated_by,
          created_at, updated_at
        ) values (
          current_business, target_branch, row_value ->> 'id',
          coalesce(row_value ->> 'folio', ''), coalesce(row_value ->> 'customer', ''),
          coalesce(nullif(row_value ->> 'status', ''), 'borrador'),
          nullif(row_value ->> 'validUntil', '')::date,
          public.document_public_payload(row_value), current_user, current_user,
          coalesce(nullif(row_value ->> 'createdAt', '')::timestamptz, now()), now()
        );

        insert into public.team_quote_financials (
          business_id, branch_id, quote_id, financial_payload, updated_at
        ) values (
          current_business, target_branch, row_value ->> 'id',
          public.document_financial_payload(row_value), now()
        );
        restored_count := restored_count + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(coalesce(snapshot_value -> 'orders', '[]'::jsonb)) = 'array' then
    for row_value in select value from jsonb_array_elements(snapshot_value -> 'orders')
    loop
      target_branch := coalesce(nullif(row_value ->> 'branchId', '')::uuid, fallback_branch);
      if exists (select 1 from public.branches where branch_id = target_branch and business_id = current_business) then
        insert into public.branch_orders (
          business_id, branch_id, order_id, folio, customer_name,
          status, due_date, assigned_to, public_payload,
          created_by, updated_by, created_at, updated_at
        ) values (
          current_business, target_branch, row_value ->> 'id',
          coalesce(row_value ->> 'folio', ''), coalesce(row_value ->> 'customer', ''),
          coalesce(nullif(row_value ->> 'status', ''), 'pendiente'),
          nullif(row_value ->> 'dueDate', '')::date,
          nullif(row_value ->> 'assignedTo', '')::uuid,
          public.document_public_payload(row_value),
          coalesce(nullif(row_value ->> 'createdBy', '')::uuid, current_user), current_user,
          coalesce(nullif(row_value ->> 'createdAt', '')::timestamptz, now()), now()
        );

        insert into public.branch_order_financials (
          business_id, branch_id, order_id, financial_payload, updated_at
        ) values (
          current_business, target_branch, row_value ->> 'id',
          public.document_financial_payload(row_value), now()
        );
        restored_count := restored_count + 1;
      end if;
    end loop;
  end if;

  for mapping_value in
    select value
    from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('type', 'supplier', 'rows', coalesce(snapshot_value -> 'suppliers', '[]'::jsonb)),
      jsonb_build_object('type', 'material', 'rows', coalesce(snapshot_value -> 'materials', '[]'::jsonb)),
      jsonb_build_object('type', 'purchase', 'rows', coalesce(snapshot_value -> 'purchases', '[]'::jsonb)),
      jsonb_build_object('type', 'expense', 'rows', coalesce(snapshot_value -> 'expenses', '[]'::jsonb)),
      jsonb_build_object('type', 'recurring_expense', 'rows', coalesce(snapshot_value -> 'recurringExpenses', '[]'::jsonb)),
      jsonb_build_object('type', 'cash_transaction', 'rows', coalesce(snapshot_value -> 'cashTransactions', '[]'::jsonb)),
      jsonb_build_object('type', 'inventory_movement', 'rows', coalesce(snapshot_value -> 'inventoryMovements', '[]'::jsonb))
    ))
  loop
    target_type := mapping_value ->> 'type';
    collection_value := mapping_value -> 'rows';
    if jsonb_typeof(collection_value) = 'array' then
      for row_value in select value from jsonb_array_elements(collection_value)
      loop
        target_branch := coalesce(nullif(row_value ->> 'branchId', '')::uuid, fallback_branch);
        if exists (select 1 from public.branches where branch_id = target_branch and business_id = current_business) then
          insert into public.team_records (
            business_id, branch_id, entity_type, entity_id, payload,
            occurred_on, version, created_by, updated_by, created_at, updated_at
          ) values (
            current_business, target_branch, target_type, row_value ->> 'id', row_value,
            nullif(row_value ->> 'date', '')::date, 1, current_user, current_user,
            coalesce(nullif(row_value ->> 'createdAt', '')::timestamptz, now()), now()
          );
          restored_count := restored_count + 1;
        end if;
      end loop;
    end if;
  end loop;

  if jsonb_typeof(coalesce(snapshot_value -> 'products', '[]'::jsonb)) = 'array' then
    for row_value in select value from jsonb_array_elements(snapshot_value -> 'products')
    loop
      insert into public.branch_products (
        business_id, product_id, name, category, sale_price, active, updated_at
      ) values (
        current_business, row_value ->> 'id', coalesce(row_value ->> 'name', ''),
        coalesce(row_value ->> 'category', ''),
        coalesce((row_value ->> 'salePrice')::numeric, 0), true, now()
      );
    end loop;
  end if;

  insert into public.team_activity (
    business_id, branch_id, actor_id, actor_name,
    event_type, entity_type, entity_id, title, detail
  )
  select
    current_business,
    coalesce(fallback_branch, branch.branch_id),
    current_user,
    coalesce(nullif(app_user.display_name, ''), app_user.email, 'Propietario'),
    'restore', 'backup', p_backup_id::text,
    'Respaldo automático restaurado',
    restored_count::text || ' registros restaurados'
  from public.app_users as app_user
  left join public.branches as branch
    on branch.business_id = current_business and branch.active = true
  where app_user.user_id = current_user
  order by branch.created_at
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'backup_id', p_backup_id,
    'restored', restored_count,
    'snapshot', snapshot_value
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. BLOQUEOS DE EDICIÓN PARA MÁS MÓDULOS
-- ---------------------------------------------------------------------
alter table public.team_edit_locks
  drop constraint if exists team_edit_locks_entity_type_check;

alter table public.team_edit_locks
  add constraint team_edit_locks_entity_type_check
  check (entity_type in ('order', 'material', 'purchase', 'expense', 'cash_closing'));

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
  allowed boolean := false;
begin
  allowed := case p_entity_type
    when 'order' then public.has_app_permission('edit_orders')
    when 'material' then public.has_app_permission('edit_materials') or public.has_app_permission('adjust_inventory')
    when 'purchase' then public.has_app_permission('edit_purchases')
    when 'expense' then public.has_app_permission('edit_expenses')
    when 'cash_closing' then public.has_app_permission('edit_cash_closings') or public.has_app_permission('create_cash_closings')
    else false
  end;

  if not allowed then
    raise exception 'No tienes permiso para editar este registro.';
  end if;

  if p_force and not public.is_business_admin() then
    raise exception 'Solo el propietario o un administrador puede tomar una edición activa.';
  end if;

  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_business::text || ':' || p_entity_type || ':' || p_entity_id));

  delete from public.team_edit_locks
  where business_id = current_business and expires_at <= now();

  select coalesce(nullif(display_name, ''), email, 'Usuario')
  into actor_name
  from public.app_users
  where user_id = current_user and active = true
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
    ) returning * into lock_row;
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

-- ---------------------------------------------------------------------
-- 8. AUTODIAGNÓSTICO PARA PRUEBAS REALES DE SUPABASE
-- ---------------------------------------------------------------------
create or replace function public.team_hardening_self_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'ok',
      to_regclass('public.team_operation_log') is not null
      and to_regclass('public.team_records') is not null
      and to_regclass('public.team_backups') is not null
      and to_regclass('public.team_edit_locks') is not null,
    'business_id', public.current_business_id(),
    'role', public.current_app_role(),
    'can_view_orders', public.has_app_permission('view_orders'),
    'can_register_payments', public.has_app_permission('register_payments'),
    'checked_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. SEGURIDAD Y PERMISOS DE EJECUCIÓN
-- ---------------------------------------------------------------------
revoke all on function public.can_read_team_record(text) from public, anon;
revoke all on function public.can_create_team_record(text) from public, anon;
revoke all on function public.can_edit_team_record(text) from public, anon;
revoke all on function public.can_delete_team_record(text) from public, anon;
revoke all on function public.can_write_team_record(text) from public, anon;
revoke all on function public.document_public_payload(jsonb) from public, anon;
revoke all on function public.document_financial_payload(jsonb) from public, anon;
revoke all on function public.commit_team_batch(uuid, uuid, jsonb) from public, anon;
revoke all on function public.restore_team_backup(uuid) from public, anon;
revoke all on function public.acquire_team_edit_lock(text, text, uuid, boolean) from public, anon;
revoke all on function public.team_hardening_self_check() from public, anon;

grant execute on function public.can_read_team_record(text) to authenticated;
grant execute on function public.can_create_team_record(text) to authenticated;
grant execute on function public.can_edit_team_record(text) to authenticated;
grant execute on function public.can_delete_team_record(text) to authenticated;
grant execute on function public.can_write_team_record(text) to authenticated;
grant execute on function public.commit_team_batch(uuid, uuid, jsonb) to authenticated;
grant execute on function public.restore_team_backup(uuid) to authenticated;
grant execute on function public.acquire_team_edit_lock(text, text, uuid, boolean) to authenticated;
grant execute on function public.team_hardening_self_check() to authenticated;

-- Reafirma lectura granular. Las escrituras siguen pasando exclusivamente por RPC.
drop policy if exists team_records_select on public.team_records;
create policy team_records_select
on public.team_records
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.can_read_team_record(entity_type)
);
