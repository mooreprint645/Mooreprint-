-- =====================================================================
-- MOOREPRINT: FLUJO COMPARTIDO DEL EQUIPO
-- Clientes, cotizaciones, actividad, folios seguros, papelera, respaldos
-- y cortes de caja. No incluye archivos, imágenes ni enlaces públicos.
-- Ejecuta este archivo DESPUÉS de supabase/branches.sql.
-- Es seguro volver a ejecutarlo.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. CLIENTES COMPARTIDOS POR SUCURSAL
create table if not exists public.team_customers (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  customer_id text not null,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  rfc text not null default '',
  address text not null default '',
  notes text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, customer_id)
);

create index if not exists team_customers_branch_idx
  on public.team_customers (business_id, branch_id, updated_at desc);
create index if not exists team_customers_name_idx
  on public.team_customers (business_id, lower(name));

-- 2. COTIZACIONES COMPARTIDAS, SEPARANDO COSTOS INTERNOS
create table if not exists public.team_quotes (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  quote_id text not null,
  folio text not null default '',
  customer_name text not null default '',
  status text not null default 'borrador',
  valid_until date,
  public_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, quote_id)
);

create table if not exists public.team_quote_financials (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  quote_id text not null,
  financial_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (business_id, quote_id),
  foreign key (business_id, quote_id)
    references public.team_quotes(business_id, quote_id) on delete cascade
);

create index if not exists team_quotes_branch_idx
  on public.team_quotes (business_id, branch_id, updated_at desc);
create index if not exists team_quotes_folio_idx
  on public.team_quotes (business_id, branch_id, folio);

-- 3. HISTORIAL COMPARTIDO DEL EQUIPO
create table if not exists public.team_activity (
  activity_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default '',
  event_type text not null default 'system',
  entity_type text not null default '',
  entity_id text not null default '',
  title text not null,
  detail text not null default '',
  before_payload jsonb,
  after_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_activity_branch_idx
  on public.team_activity (business_id, branch_id, created_at desc);
create index if not exists team_activity_entity_idx
  on public.team_activity (business_id, entity_type, entity_id, created_at desc);

-- 4. PAPELERA DE 30 DÍAS
create table if not exists public.team_trash (
  trash_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  entity_type text not null check (entity_type in ('order', 'customer', 'quote')),
  entity_id text not null,
  payload jsonb not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_name text not null default '',
  deleted_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '30 days'),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null
);

create index if not exists team_trash_business_idx
  on public.team_trash (business_id, restored_at, purge_after, deleted_at desc);

-- 5. RESPALDOS AUTOMÁTICOS SIN ARCHIVOS
create table if not exists public.team_backups (
  backup_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists team_backups_business_idx
  on public.team_backups (business_id, created_at desc);

-- 6. CORTES DE CAJA POR USUARIO Y SUCURSAL
create table if not exists public.team_cash_closings (
  closing_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null default '',
  closing_date date not null default current_date,
  opening_amount numeric(14,2) not null default 0,
  cash_income numeric(14,2) not null default 0,
  cash_out numeric(14,2) not null default 0,
  expected_cash numeric(14,2) not null default 0,
  counted_cash numeric(14,2) not null default 0,
  difference numeric(14,2) not null default 0,
  notes text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, branch_id, user_id, closing_date)
);

create index if not exists team_cash_closings_branch_idx
  on public.team_cash_closings (business_id, branch_id, closing_date desc);

-- 7. CONTADORES ATÓMICOS PARA FOLIOS
create table if not exists public.team_folio_counters (
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  branch_id uuid not null references public.branches(branch_id) on delete cascade,
  document_type text not null check (document_type in ('order', 'quote')),
  last_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (business_id, branch_id, document_type)
);

-- 8. FUNCIONES RPC
create or replace function public.reserve_team_folio(
  p_branch_id uuid,
  p_document_type text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_business uuid := public.current_business_id();
  branch_code text;
  existing_max bigint := 0;
  next_value bigint;
  prefix text;
begin
  if p_document_type not in ('order', 'quote') then
    raise exception 'Tipo de folio no permitido.';
  end if;

  if p_document_type = 'order' and not public.has_app_permission('create_orders') then
    raise exception 'No tienes permiso para crear pedidos.';
  end if;

  if p_document_type = 'quote' and not public.has_app_permission('view_quotes') then
    raise exception 'No tienes permiso para crear cotizaciones.';
  end if;

  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.';
  end if;

  select regexp_replace(upper(branch.code), '[^A-Z0-9]+', '', 'g')
  into branch_code
  from public.branches as branch
  where branch.branch_id = p_branch_id
    and branch.business_id = current_business
    and branch.active = true;

  if branch_code is null or branch_code = '' then
    raise exception 'Sucursal no encontrada.';
  end if;

  if p_document_type = 'order' then
    select coalesce(max((match_value)[1]::bigint), 0)
    into existing_max
    from (
      select regexp_match(coalesce(folio, ''), '([0-9]+)$') as match_value
      from public.branch_orders
      where business_id = current_business
        and branch_id = p_branch_id
    ) as matches
    where match_value is not null;
    prefix := branch_code;
  else
    select coalesce(max((match_value)[1]::bigint), 0)
    into existing_max
    from (
      select regexp_match(coalesce(folio, ''), '([0-9]+)$') as match_value
      from public.team_quotes
      where business_id = current_business
        and branch_id = p_branch_id
    ) as matches
    where match_value is not null;
    prefix := 'COT-' || branch_code;
  end if;

  insert into public.team_folio_counters (
    business_id, branch_id, document_type, last_value, updated_at
  )
  values (
    current_business, p_branch_id, p_document_type, existing_max + 1, now()
  )
  on conflict (business_id, branch_id, document_type)
  do update set
    last_value = greatest(public.team_folio_counters.last_value, existing_max) + 1,
    updated_at = now()
  returning last_value into next_value;

  return prefix || '-' || lpad(next_value::text, 4, '0');
end;
$$;

create or replace function public.record_team_activity(
  p_branch_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_title text,
  p_detail text default '',
  p_before_payload jsonb default null,
  p_after_payload jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  actor_name_value text;
begin
  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.';
  end if;

  select coalesce(nullif(display_name, ''), email, 'Usuario')
  into actor_name_value
  from public.app_users
  where user_id = (select auth.uid())
    and active = true
  limit 1;

  insert into public.team_activity (
    business_id, branch_id, actor_id, actor_name,
    event_type, entity_type, entity_id, title, detail,
    before_payload, after_payload
  )
  values (
    public.current_business_id(), p_branch_id, (select auth.uid()),
    coalesce(actor_name_value, 'Usuario'),
    coalesce(nullif(trim(p_event_type), ''), 'system'),
    coalesce(trim(p_entity_type), ''),
    coalesce(trim(p_entity_id), ''),
    coalesce(nullif(trim(p_title), ''), 'Movimiento registrado'),
    coalesce(p_detail, ''), p_before_payload, p_after_payload
  )
  returning activity_id into result_id;

  return result_id;
end;
$$;

create or replace function public.save_team_backup(p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  actor_name_value text;
begin
  if not public.is_business_admin() then
    raise exception 'Solo el propietario o un administrador puede crear respaldos.';
  end if;

  select coalesce(nullif(display_name, ''), email, 'Administrador')
  into actor_name_value
  from public.app_users
  where user_id = (select auth.uid())
  limit 1;

  insert into public.team_backups (
    business_id, created_by, created_by_name, snapshot
  )
  values (
    public.current_business_id(), (select auth.uid()),
    coalesce(actor_name_value, 'Administrador'), coalesce(p_snapshot, '{}'::jsonb)
  )
  returning backup_id into result_id;

  delete from public.team_backups
  where business_id = public.current_business_id()
    and backup_id not in (
      select backup_id
      from public.team_backups
      where business_id = public.current_business_id()
      order by created_at desc
      limit 10
    );

  return result_id;
end;
$$;

create or replace function public.restore_team_trash(p_trash_id uuid)
returns table (
  entity_type text,
  entity_id text,
  branch_id uuid,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_admin() then
    raise exception 'Solo el propietario o un administrador puede restaurar elementos.';
  end if;

  return query
  update public.team_trash as trash
  set restored_at = now(),
      restored_by = (select auth.uid())
  where trash.trash_id = p_trash_id
    and trash.business_id = public.current_business_id()
    and trash.restored_at is null
    and trash.purge_after > now()
  returning trash.entity_type, trash.entity_id, trash.branch_id, trash.payload;
end;
$$;

create or replace function public.purge_expired_team_trash()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if not public.is_business_admin() then
    raise exception 'Solo el propietario o un administrador puede limpiar la papelera.';
  end if;

  delete from public.team_trash
  where business_id = public.current_business_id()
    and (
      purge_after <= now()
      or (restored_at is not null and restored_at <= now() - interval '1 day')
    );

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

-- 9. SEGURIDAD RLS
alter table public.team_customers enable row level security;
alter table public.team_quotes enable row level security;
alter table public.team_quote_financials enable row level security;
alter table public.team_activity enable row level security;
alter table public.team_trash enable row level security;
alter table public.team_backups enable row level security;
alter table public.team_cash_closings enable row level security;
alter table public.team_folio_counters enable row level security;

-- Clientes
drop policy if exists team_customers_select on public.team_customers;
create policy team_customers_select on public.team_customers
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_customers'))
);

drop policy if exists team_customers_insert on public.team_customers;
create policy team_customers_insert on public.team_customers
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_customers'))
);

drop policy if exists team_customers_update on public.team_customers;
create policy team_customers_update on public.team_customers
for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_customers'))
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_customers'))
);

drop policy if exists team_customers_delete on public.team_customers;
create policy team_customers_delete on public.team_customers
for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_customers'))
);

-- Cotizaciones
drop policy if exists team_quotes_select on public.team_quotes;
create policy team_quotes_select on public.team_quotes
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_quotes'))
);

drop policy if exists team_quotes_insert on public.team_quotes;
create policy team_quotes_insert on public.team_quotes
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_quotes'))
);

drop policy if exists team_quotes_update on public.team_quotes;
create policy team_quotes_update on public.team_quotes
for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_quotes'))
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_quotes'))
);

drop policy if exists team_quotes_delete on public.team_quotes;
create policy team_quotes_delete on public.team_quotes
for delete to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (public.is_business_admin() or public.has_app_permission('view_quotes'))
);

-- Costos de cotizaciones
drop policy if exists team_quote_financials_select on public.team_quote_financials;
create policy team_quote_financials_select on public.team_quote_financials
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_costs')
);

drop policy if exists team_quote_financials_write on public.team_quote_financials;
create policy team_quote_financials_write on public.team_quote_financials
for all to authenticated
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

-- Actividad: todos registran, responsables autorizados consultan
drop policy if exists team_activity_select on public.team_activity;
create policy team_activity_select on public.team_activity
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (
    public.is_business_admin()
    or public.has_app_permission('view_finances')
    or public.has_app_permission('manage_users')
  )
);

drop policy if exists team_activity_insert on public.team_activity;
create policy team_activity_insert on public.team_activity
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and actor_id = (select auth.uid())
);

-- Papelera: cualquier usuario autorizado puede archivar; solo administradores consultan/restauran
drop policy if exists team_trash_select on public.team_trash;
create policy team_trash_select on public.team_trash
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.is_business_admin()
);

drop policy if exists team_trash_insert on public.team_trash;
create policy team_trash_insert on public.team_trash
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and deleted_by = (select auth.uid())
);

-- Respaldos
drop policy if exists team_backups_admin on public.team_backups;
create policy team_backups_admin on public.team_backups
for all to authenticated
using (
  business_id = public.current_business_id()
  and public.is_business_admin()
)
with check (
  business_id = public.current_business_id()
  and public.is_business_admin()
);

-- Cortes de caja
drop policy if exists team_cash_closings_select on public.team_cash_closings;
create policy team_cash_closings_select on public.team_cash_closings
for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and (
    public.is_business_admin()
    or user_id = (select auth.uid())
    or public.has_app_permission('view_finances')
    or public.has_app_permission('manage_payments')
  )
);

drop policy if exists team_cash_closings_insert on public.team_cash_closings;
create policy team_cash_closings_insert on public.team_cash_closings
for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and user_id = (select auth.uid())
  and (
    public.is_business_admin()
    or public.has_app_permission('view_finances')
    or public.has_app_permission('manage_payments')
  )
);

drop policy if exists team_cash_closings_update on public.team_cash_closings;
create policy team_cash_closings_update on public.team_cash_closings
for update to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and user_id = (select auth.uid())
)
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and user_id = (select auth.uid())
);

-- Los contadores se usan únicamente mediante RPC
drop policy if exists team_folio_counters_none on public.team_folio_counters;
create policy team_folio_counters_none on public.team_folio_counters
for select to authenticated
using (false);

-- 10. PERMISOS
revoke all on function public.reserve_team_folio(uuid, text) from public, anon;
revoke all on function public.record_team_activity(uuid, text, text, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.save_team_backup(jsonb) from public, anon;
revoke all on function public.restore_team_trash(uuid) from public, anon;
revoke all on function public.purge_expired_team_trash() from public, anon;

grant execute on function public.reserve_team_folio(uuid, text) to authenticated;
grant execute on function public.record_team_activity(uuid, text, text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_team_backup(jsonb) to authenticated;
grant execute on function public.restore_team_trash(uuid) to authenticated;
grant execute on function public.purge_expired_team_trash() to authenticated;

grant select, insert, update, delete on public.team_customers to authenticated;
grant select, insert, update, delete on public.team_quotes to authenticated;
grant select, insert, update, delete on public.team_quote_financials to authenticated;
grant select, insert on public.team_activity to authenticated;
grant select, insert on public.team_trash to authenticated;
grant select, insert, update, delete on public.team_backups to authenticated;
grant select, insert, update on public.team_cash_closings to authenticated;

-- 11. REALTIME
alter table public.team_customers replica identity full;
alter table public.team_quotes replica identity full;
alter table public.team_activity replica identity full;
alter table public.team_cash_closings replica identity full;
alter table public.branch_orders replica identity full;

do $$
declare
  table_name_value text;
begin
  foreach table_name_value in array array[
    'branch_orders',
    'team_customers',
    'team_quotes',
    'team_activity',
    'team_cash_closings'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name_value
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name_value);
    end if;
  end loop;
exception
  when undefined_object then
    null;
end $$;
