-- Ajustes complementarios para supabase/branches.sql
-- Ejecuta este bloque inmediatamente después de branches.sql.
-- Es seguro volver a ejecutarlo.

-- Permite que encargados y administradores actualicen pedidos creados por otro
-- empleado de la misma sucursal sin alterar la seguridad de negocio/sucursal.
drop policy if exists "Members can create branch orders" on public.branch_orders;
create policy "Members can create branch orders"
on public.branch_orders for insert to authenticated
with check (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('create_orders')
);

-- Los empleados pueden trabajar con pedidos, pero no consultar columnas de
-- costo y utilidad de la tabla de ventas. Solo usuarios financieros las leen.
drop policy if exists "Branch users can read sales" on public.sales;
create policy "Branch users can read sales"
on public.sales for select to authenticated
using (
  business_id = public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.has_app_permission('view_finances')
);
