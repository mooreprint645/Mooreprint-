-- =====================================================================
-- MOOREPRINT: SINCRONIZACIÓN SEGURA CON PERMISOS GRANULARES
-- Ejecutar después de supabase/team-improvements.sql.
-- Es seguro volver a ejecutarlo.
-- =====================================================================

create or replace function public.sync_team_customers(p_rows jsonb)
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
  affected integer := 0;
  exists_row boolean;
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de clientes no es válida.';
  end if;

  for row_value in
    select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    target_id := nullif(trim(row_value ->> 'customer_id'), '');
    target_branch := nullif(row_value ->> 'branch_id', '')::uuid;

    if target_id is null or target_branch is null then
      raise exception 'Cliente o sucursal no válidos.';
    end if;

    if coalesce(nullif(row_value ->> 'business_id', '')::uuid, target_business) <> target_business then
      raise exception 'El cliente pertenece a otro negocio.';
    end if;

    if not public.can_access_branch(target_branch) then
      raise exception 'No tienes acceso a la sucursal del cliente.';
    end if;

    select exists (
      select 1
      from public.team_customers
      where business_id = target_business
        and customer_id = target_id
    ) into exists_row;

    if exists_row then
      if not public.has_app_permission('edit_customers') then
        raise exception 'No tienes permiso para editar clientes.';
      end if;

      update public.team_customers
      set branch_id = target_branch,
          name = coalesce(row_value ->> 'name', ''),
          phone = coalesce(row_value ->> 'phone', ''),
          email = coalesce(row_value ->> 'email', ''),
          rfc = coalesce(row_value ->> 'rfc', ''),
          address = coalesce(row_value ->> 'address', ''),
          notes = coalesce(row_value ->> 'notes', ''),
          payload = coalesce(row_value -> 'payload', '{}'::jsonb),
          updated_by = (select auth.uid()),
          updated_at = coalesce(nullif(row_value ->> 'updated_at', '')::timestamptz, now())
      where business_id = target_business
        and customer_id = target_id;
    else
      if not public.has_app_permission('create_customers') then
        raise exception 'No tienes permiso para crear clientes.';
      end if;

      insert into public.team_customers (
        business_id, branch_id, customer_id, name, phone, email, rfc,
        address, notes, payload, created_by, updated_by, created_at, updated_at
      ) values (
        target_business,
        target_branch,
        target_id,
        coalesce(row_value ->> 'name', ''),
        coalesce(row_value ->> 'phone', ''),
        coalesce(row_value ->> 'email', ''),
        coalesce(row_value ->> 'rfc', ''),
        coalesce(row_value ->> 'address', ''),
        coalesce(row_value ->> 'notes', ''),
        coalesce(row_value -> 'payload', '{}'::jsonb),
        (select auth.uid()),
        (select auth.uid()),
        coalesce(nullif(row_value ->> 'created_at', '')::timestamptz, now()),
        coalesce(nullif(row_value ->> 'updated_at', '')::timestamptz, now())
      );
    end if;

    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

create or replace function public.sync_team_quotes(p_rows jsonb)
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
  target_valid_until date;
  affected integer := 0;
  exists_row boolean;
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de cotizaciones no es válida.';
  end if;

  for row_value in
    select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    target_id := nullif(trim(row_value ->> 'quote_id'), '');
    target_branch := nullif(row_value ->> 'branch_id', '')::uuid;
    target_valid_until := nullif(row_value ->> 'valid_until', '')::date;

    if target_id is null or target_branch is null then
      raise exception 'Cotización o sucursal no válidas.';
    end if;

    if coalesce(nullif(row_value ->> 'business_id', '')::uuid, target_business) <> target_business then
      raise exception 'La cotización pertenece a otro negocio.';
    end if;

    if not public.can_access_branch(target_branch) then
      raise exception 'No tienes acceso a la sucursal de la cotización.';
    end if;

    select exists (
      select 1
      from public.team_quotes
      where business_id = target_business
        and quote_id = target_id
    ) into exists_row;

    if exists_row then
      if not public.has_app_permission('edit_quotes') then
        raise exception 'No tienes permiso para editar cotizaciones.';
      end if;

      update public.team_quotes
      set branch_id = target_branch,
          folio = coalesce(row_value ->> 'folio', ''),
          customer_name = coalesce(row_value ->> 'customer_name', ''),
          status = coalesce(nullif(row_value ->> 'status', ''), 'borrador'),
          valid_until = target_valid_until,
          public_payload = coalesce(row_value -> 'public_payload', '{}'::jsonb),
          updated_by = (select auth.uid()),
          updated_at = coalesce(nullif(row_value ->> 'updated_at', '')::timestamptz, now())
      where business_id = target_business
        and quote_id = target_id;
    else
      if not public.has_app_permission('create_quotes') then
        raise exception 'No tienes permiso para crear cotizaciones.';
      end if;

      insert into public.team_quotes (
        business_id, branch_id, quote_id, folio, customer_name, status,
        valid_until, public_payload, created_by, updated_by, created_at, updated_at
      ) values (
        target_business,
        target_branch,
        target_id,
        coalesce(row_value ->> 'folio', ''),
        coalesce(row_value ->> 'customer_name', ''),
        coalesce(nullif(row_value ->> 'status', ''), 'borrador'),
        target_valid_until,
        coalesce(row_value -> 'public_payload', '{}'::jsonb),
        (select auth.uid()),
        (select auth.uid()),
        coalesce(nullif(row_value ->> 'created_at', '')::timestamptz, now()),
        coalesce(nullif(row_value ->> 'updated_at', '')::timestamptz, now())
      );
    end if;

    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

revoke all on function public.sync_team_customers(jsonb) from public, anon;
revoke all on function public.sync_team_quotes(jsonb) from public, anon;

grant execute on function public.sync_team_customers(jsonb) to authenticated;
grant execute on function public.sync_team_quotes(jsonb) to authenticated;
