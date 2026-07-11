-- ============================================================
-- MOOREPRINT: costos fijos mensuales para calcular precios
-- Ejecuta este archivo en Supabase > SQL Editor.
-- Requiere haber ejecutado antes schema.sql y catalog.sql.
-- Es seguro volver a ejecutarlo.
-- ============================================================

-- Tiempo aproximado de producción de cada producto.
alter table public.products
  add column if not exists production_minutes numeric(12,3) not null default 0;

-- Luz, renta, personal y cualquier otro costo fijo del mes.
create table if not exists public.monthly_overheads (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  overhead_id text not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category text not null default 'otro',
  name text not null,
  quantity numeric(16,3) not null default 1,
  unit_amount numeric(16,2) not null default 0,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, overhead_id)
);

-- Horas realmente productivas de cada mes.
create table if not exists public.monthly_overhead_settings (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  month text not null check (month ~ '^\d{4}-\d{2}$'),
  productive_hours numeric(16,3) not null default 160,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, month)
);

create index if not exists monthly_overheads_user_month_idx
  on public.monthly_overheads (user_id, month);

create index if not exists monthly_overheads_user_category_idx
  on public.monthly_overheads (user_id, category);

alter table public.monthly_overheads enable row level security;
alter table public.monthly_overhead_settings enable row level security;

-- Permite ejecutar este archivo nuevamente sin duplicar políticas.
drop policy if exists "Authorized users can read" on public.monthly_overheads;
drop policy if exists "Authorized users can create" on public.monthly_overheads;
drop policy if exists "Authorized users can update" on public.monthly_overheads;
drop policy if exists "Authorized users can delete" on public.monthly_overheads;

drop policy if exists "Authorized users can read" on public.monthly_overhead_settings;
drop policy if exists "Authorized users can create" on public.monthly_overhead_settings;
drop policy if exists "Authorized users can update" on public.monthly_overhead_settings;
drop policy if exists "Authorized users can delete" on public.monthly_overhead_settings;

-- COSTOS DEL MES
create policy "Authorized users can read"
on public.monthly_overheads
for select
to authenticated
using (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

create policy "Authorized users can create"
on public.monthly_overheads
for insert
to authenticated
with check (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

create policy "Authorized users can update"
on public.monthly_overheads
for update
to authenticated
using (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
)
with check (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

create policy "Authorized users can delete"
on public.monthly_overheads
for delete
to authenticated
using (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

-- HORAS PRODUCTIVAS DEL MES
create policy "Authorized users can read"
on public.monthly_overhead_settings
for select
to authenticated
using (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

create policy "Authorized users can create"
on public.monthly_overhead_settings
for insert
to authenticated
with check (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

create policy "Authorized users can update"
on public.monthly_overhead_settings
for update
to authenticated
using (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
)
with check (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

create policy "Authorized users can delete"
on public.monthly_overhead_settings
for delete
to authenticated
using (
  (select public.is_mooreprint_user())
  and (select auth.uid()) = user_id
);

grant select, insert, update, delete
  on public.monthly_overheads
  to authenticated;

grant select, insert, update, delete
  on public.monthly_overhead_settings
  to authenticated;

revoke all on public.monthly_overheads from anon;
revoke all on public.monthly_overhead_settings from anon;

-- Comprobación opcional:
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
-- and table_name in ('monthly_overheads', 'monthly_overhead_settings')
-- order by table_name;
