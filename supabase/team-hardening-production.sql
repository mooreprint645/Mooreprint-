-- =====================================================================
-- MOOREPRINT: CAPA DE PRODUCCIÓN APLICADA EN SUPABASE
-- Ejecutar después de supabase/team-hardening.sql.
-- Este archivo reproduce los bloques compactos instalados desde móvil.
-- Es seguro volver a ejecutarlo. Definir las funciones no restaura ni borra
-- datos; restore_team_backup solo modifica datos cuando se invoca expresamente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TRANSACCIÓN ATÓMICA COMPACTA
-- ---------------------------------------------------------------------
create or replace function public.commit_team_batch(
  p_operation_id uuid,
  p_branch_id uuid,
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  b uuid:=public.current_business_id();
  u uuid:=(select auth.uid());
  x jsonb;
  k text;
  a text;
  t text;
  i text;
  br uuid;
  p jsonb;
  d date;
  ev bigint;
  cv bigint;
  ex boolean;
  n integer:=0;
  vs jsonb:='[]'::jsonb;
  r jsonb;
  inv boolean:=false;
begin
  if p_operation_id is null then
    raise exception 'La operación no tiene identificador.';
  end if;

  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then
    raise exception 'La lista de operaciones no es válida.';
  end if;

  if p_branch_id is not null and not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a la sucursal de esta operación.';
  end if;

  perform pg_advisory_xact_lock(hashtext(b::text||':'||p_operation_id::text));

  select result into r
  from public.team_operation_log
  where business_id=b and operation_id=p_operation_id;

  if r is not null then
    return r||jsonb_build_object('replayed',true);
  end if;

  select exists(
    select 1
    from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) q(value)
    where q.value->>'kind'='order_upsert'
       or (q.value->>'kind'='record_upsert' and q.value->>'entity_type'='purchase')
  ) into inv;

  for x in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb))
  loop
    k:=coalesce(x->>'kind','');
    a:=coalesce(x->>'action','save');
    t:=coalesce(x->>'entity_type','');
    i:=nullif(trim(x->>'entity_id'),'');
    br:=coalesce(nullif(x->>'branch_id','')::uuid,p_branch_id);
    p:=coalesce(x->'payload','{}'::jsonb);
    d:=nullif(x->>'occurred_on','')::date;
    ev:=nullif(x->>'expected_version','')::bigint;

    if br is null or not public.can_access_branch(br) then
      raise exception 'La operación contiene una sucursal no permitida.';
    end if;

    if k='record_upsert' then
      if i is null then
        raise exception 'El registro operativo no tiene identificador.';
      end if;

      select version into cv
      from public.team_records
      where business_id=b and entity_type=t and entity_id=i
      for update;
      ex:=found;

      if a='payment' then
        if not public.has_app_permission('register_payments') then
          raise exception 'No tienes permiso para registrar pagos.';
        end if;
      elsif a='derived_inventory' and inv then
        null;
      elsif ex then
        if not public.can_edit_team_record(t) then
          raise exception 'No tienes permiso para editar este registro.';
        end if;
      else
        if not public.can_create_team_record(t) then
          raise exception 'No tienes permiso para crear este registro.';
        end if;
      end if;

      if ev is not null and ex and cv<>ev then
        raise exception 'CONFLICT: otro integrante modificó % antes que tú.',i;
      end if;

      insert into public.team_records(
        business_id,branch_id,entity_type,entity_id,payload,occurred_on,
        version,created_by,updated_by,created_at,updated_at
      ) values (
        b,br,t,i,p,d,1,u,u,
        coalesce(nullif(x->>'created_at','')::timestamptz,now()),now()
      )
      on conflict(business_id,entity_type,entity_id)
      do update set
        branch_id=excluded.branch_id,
        payload=excluded.payload,
        occurred_on=excluded.occurred_on,
        version=public.team_records.version+1,
        updated_by=u,
        updated_at=now()
      returning version into cv;

      vs:=vs||jsonb_build_array(jsonb_build_object(
        'entity_type',t,'entity_id',i,'version',cv
      ));
      n:=n+1;

    elsif k='record_delete' then
      if i is null or not public.can_delete_team_record(t) then
        raise exception 'No tienes permiso para eliminar este registro.';
      end if;
      delete from public.team_records
      where business_id=b and branch_id=br and entity_type=t and entity_id=i;
      n:=n+1;

    elsif k='order_upsert' then
      if i is null then
        raise exception 'El pedido no tiene identificador.';
      end if;

      select exists(
        select 1 from public.branch_orders
        where business_id=b and order_id=i
      ) into ex;

      if a='payment' then
        if not public.has_app_permission('register_payments') then
          raise exception 'No tienes permiso para registrar pagos.';
        end if;
      elsif ex then
        if not public.has_app_permission('edit_orders') then
          raise exception 'No tienes permiso para editar pedidos.';
        end if;
      else
        if not public.has_app_permission('create_orders') then
          raise exception 'No tienes permiso para crear pedidos.';
        end if;
      end if;

      insert into public.branch_orders(
        business_id,branch_id,order_id,folio,customer_name,status,due_date,
        assigned_to,public_payload,created_by,updated_by,created_at,updated_at
      ) values (
        b,br,i,coalesce(p->>'folio',''),coalesce(p->>'customer',''),
        coalesce(nullif(p->>'status',''),'pendiente'),
        nullif(p->>'dueDate','')::date,
        nullif(p->>'assignedTo','')::uuid,
        public.document_public_payload(p),
        coalesce(nullif(p->>'createdBy','')::uuid,u),u,
        coalesce(nullif(p->>'createdAt','')::timestamptz,now()),now()
      )
      on conflict(business_id,order_id)
      do update set
        branch_id=excluded.branch_id,
        folio=excluded.folio,
        customer_name=excluded.customer_name,
        status=excluded.status,
        due_date=excluded.due_date,
        assigned_to=excluded.assigned_to,
        public_payload=excluded.public_payload,
        updated_by=u,
        updated_at=now();

      if public.has_app_permission('view_costs') then
        insert into public.branch_order_financials(
          business_id,branch_id,order_id,financial_payload,updated_at
        ) values (
          b,br,i,public.document_financial_payload(p),now()
        )
        on conflict(business_id,order_id)
        do update set
          branch_id=excluded.branch_id,
          financial_payload=excluded.financial_payload,
          updated_at=now();
      end if;
      n:=n+1;

    elsif k='order_delete' then
      if i is null or not public.has_app_permission('delete_orders') then
        raise exception 'No tienes permiso para eliminar pedidos.';
      end if;
      delete from public.branch_orders
      where business_id=b and branch_id=br and order_id=i;
      n:=n+1;

    elsif k='cash_closing_upsert' then
      i:=coalesce(i,u::text||':'||coalesce(p->>'closing_date',current_date::text));

      select exists(
        select 1 from public.team_cash_closings
        where business_id=b
          and branch_id=br
          and user_id=coalesce(nullif(p->>'user_id','')::uuid,u)
          and closing_date=coalesce(nullif(p->>'closing_date','')::date,current_date)
      ) into ex;

      if ex then
        if not public.has_app_permission('edit_cash_closings') then
          raise exception 'No tienes permiso para corregir cortes de caja.';
        end if;
      else
        if not public.has_app_permission('create_cash_closings') then
          raise exception 'No tienes permiso para realizar cortes de caja.';
        end if;
      end if;

      insert into public.team_cash_closings(
        business_id,branch_id,user_id,user_name,closing_date,opening_amount,
        cash_income,cash_out,expected_cash,counted_cash,difference,notes,payload,created_at
      ) values (
        b,br,coalesce(nullif(p->>'user_id','')::uuid,u),
        coalesce(p->>'user_name','Usuario'),
        coalesce(nullif(p->>'closing_date','')::date,current_date),
        coalesce((p->>'opening_amount')::numeric,0),
        coalesce((p->>'cash_income')::numeric,0),
        coalesce((p->>'cash_out')::numeric,0),
        coalesce((p->>'expected_cash')::numeric,0),
        coalesce((p->>'counted_cash')::numeric,0),
        coalesce((p->>'difference')::numeric,0),
        coalesce(p->>'notes',''),coalesce(p->'payload','{}'::jsonb),now()
      )
      on conflict(business_id,branch_id,user_id,closing_date)
      do update set
        user_name=excluded.user_name,
        opening_amount=excluded.opening_amount,
        cash_income=excluded.cash_income,
        cash_out=excluded.cash_out,
        expected_cash=excluded.expected_cash,
        counted_cash=excluded.counted_cash,
        difference=excluded.difference,
        notes=excluded.notes,
        payload=excluded.payload;
      n:=n+1;

    else
      raise exception 'Tipo de operación no reconocido: %.',k;
    end if;
  end loop;

  r:=jsonb_build_object(
    'ok',true,'operation_id',p_operation_id,'affected',n,
    'versions',vs,'replayed',false
  );

  insert into public.team_operation_log(
    business_id,operation_id,branch_id,actor_id,operation_count,result
  ) values (b,p_operation_id,p_branch_id,u,n,r);

  delete from public.team_operation_log
  where business_id=b and created_at<now()-interval '45 days';

  return r;
end;
$$;

revoke all on function public.commit_team_batch(uuid,uuid,jsonb) from public,anon;
grant execute on function public.commit_team_batch(uuid,uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RESTAURACIÓN COMPACTA EN TRES AYUDANTES
-- ---------------------------------------------------------------------
create or replace function public.restore_team_backup_part_a(
  p_snapshot jsonb,p_business uuid,p_user uuid,p_branch uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  r jsonb;
  br uuid;
  n integer:=0;
begin
  if jsonb_typeof(coalesce(p_snapshot->'customers','[]'::jsonb))='array' then
    for r in select value from jsonb_array_elements(p_snapshot->'customers')
    loop
      br:=coalesce(nullif(r->>'branchId','')::uuid,p_branch);
      if nullif(r->>'id','') is not null and exists(
        select 1 from public.branches
        where branch_id=br and business_id=p_business
      ) then
        insert into public.team_customers(
          business_id,branch_id,customer_id,name,phone,email,rfc,address,notes,
          payload,created_by,updated_by,created_at,updated_at
        ) values (
          p_business,br,r->>'id',coalesce(r->>'name',''),coalesce(r->>'phone',''),
          coalesce(r->>'email',''),coalesce(r->>'rfc',''),coalesce(r->>'address',''),
          coalesce(r->>'notes',''),r,p_user,p_user,
          coalesce(nullif(r->>'createdAt','')::timestamptz,now()),now()
        )
        on conflict(business_id,customer_id)
        do update set
          branch_id=excluded.branch_id,name=excluded.name,phone=excluded.phone,
          email=excluded.email,rfc=excluded.rfc,address=excluded.address,
          notes=excluded.notes,payload=excluded.payload,updated_by=p_user,updated_at=now();
        n:=n+1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(coalesce(p_snapshot->'quotes','[]'::jsonb))='array' then
    for r in select value from jsonb_array_elements(p_snapshot->'quotes')
    loop
      br:=coalesce(nullif(r->>'branchId','')::uuid,p_branch);
      if nullif(r->>'id','') is not null and exists(
        select 1 from public.branches
        where branch_id=br and business_id=p_business
      ) then
        insert into public.team_quotes(
          business_id,branch_id,quote_id,folio,customer_name,status,valid_until,
          public_payload,created_by,updated_by,created_at,updated_at
        ) values (
          p_business,br,r->>'id',coalesce(r->>'folio',''),coalesce(r->>'customer',''),
          coalesce(nullif(r->>'status',''),'borrador'),nullif(r->>'validUntil','')::date,
          public.document_public_payload(r),p_user,p_user,
          coalesce(nullif(r->>'createdAt','')::timestamptz,now()),now()
        )
        on conflict(business_id,quote_id)
        do update set
          branch_id=excluded.branch_id,folio=excluded.folio,
          customer_name=excluded.customer_name,status=excluded.status,
          valid_until=excluded.valid_until,public_payload=excluded.public_payload,
          updated_by=p_user,updated_at=now();

        insert into public.team_quote_financials(
          business_id,branch_id,quote_id,financial_payload,updated_at
        ) values (
          p_business,br,r->>'id',public.document_financial_payload(r),now()
        )
        on conflict(business_id,quote_id)
        do update set
          branch_id=excluded.branch_id,
          financial_payload=excluded.financial_payload,
          updated_at=now();
        n:=n+1;
      end if;
    end loop;
  end if;
  return n;
end;
$$;

revoke all on function public.restore_team_backup_part_a(jsonb,uuid,uuid,uuid)
from public,anon,authenticated;

create or replace function public.restore_team_backup_part_b(
  p_snapshot jsonb,p_business uuid,p_user uuid,p_branch uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  r jsonb;
  br uuid;
  n integer:=0;
begin
  if jsonb_typeof(coalesce(p_snapshot->'orders','[]'::jsonb))<>'array' then
    return 0;
  end if;

  for r in select value from jsonb_array_elements(p_snapshot->'orders')
  loop
    br:=coalesce(nullif(r->>'branchId','')::uuid,p_branch);
    if nullif(r->>'id','') is not null and exists(
      select 1 from public.branches
      where branch_id=br and business_id=p_business
    ) then
      insert into public.branch_orders(
        business_id,branch_id,order_id,folio,customer_name,status,due_date,
        assigned_to,public_payload,created_by,updated_by,created_at,updated_at
      ) values (
        p_business,br,r->>'id',coalesce(r->>'folio',''),coalesce(r->>'customer',''),
        coalesce(nullif(r->>'status',''),'pendiente'),nullif(r->>'dueDate','')::date,
        nullif(r->>'assignedTo','')::uuid,public.document_public_payload(r),
        coalesce(nullif(r->>'createdBy','')::uuid,p_user),p_user,
        coalesce(nullif(r->>'createdAt','')::timestamptz,now()),now()
      )
      on conflict(business_id,order_id)
      do update set
        branch_id=excluded.branch_id,folio=excluded.folio,
        customer_name=excluded.customer_name,status=excluded.status,
        due_date=excluded.due_date,assigned_to=excluded.assigned_to,
        public_payload=excluded.public_payload,updated_by=p_user,updated_at=now();

      insert into public.branch_order_financials(
        business_id,branch_id,order_id,financial_payload,updated_at
      ) values (
        p_business,br,r->>'id',public.document_financial_payload(r),now()
      )
      on conflict(business_id,order_id)
      do update set
        branch_id=excluded.branch_id,
        financial_payload=excluded.financial_payload,
        updated_at=now();
      n:=n+1;
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.restore_team_backup_part_b(jsonb,uuid,uuid,uuid)
from public,anon,authenticated;

create or replace function public.restore_team_backup_part_c(
  p_snapshot jsonb,p_business uuid,p_user uuid,p_branch uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  m jsonb;
  r jsonb;
  rows_value jsonb;
  record_type text;
  br uuid;
  n integer:=0;
begin
  for m in
    select value
    from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('type','supplier','rows',coalesce(p_snapshot->'suppliers','[]'::jsonb)),
      jsonb_build_object('type','material','rows',coalesce(p_snapshot->'materials','[]'::jsonb)),
      jsonb_build_object('type','purchase','rows',coalesce(p_snapshot->'purchases','[]'::jsonb)),
      jsonb_build_object('type','expense','rows',coalesce(p_snapshot->'expenses','[]'::jsonb)),
      jsonb_build_object('type','recurring_expense','rows',coalesce(p_snapshot->'recurringExpenses','[]'::jsonb)),
      jsonb_build_object('type','cash_transaction','rows',coalesce(p_snapshot->'cashTransactions','[]'::jsonb)),
      jsonb_build_object('type','inventory_movement','rows',coalesce(p_snapshot->'inventoryMovements','[]'::jsonb))
    ))
  loop
    record_type:=m->>'type';
    rows_value:=m->'rows';
    if jsonb_typeof(rows_value)='array' then
      for r in select value from jsonb_array_elements(rows_value)
      loop
        br:=coalesce(nullif(r->>'branchId','')::uuid,p_branch);
        if nullif(r->>'id','') is not null and exists(
          select 1 from public.branches
          where branch_id=br and business_id=p_business
        ) then
          insert into public.team_records(
            business_id,branch_id,entity_type,entity_id,payload,occurred_on,
            version,created_by,updated_by,created_at,updated_at
          ) values (
            p_business,br,record_type,r->>'id',r,nullif(r->>'date','')::date,
            1,p_user,p_user,coalesce(nullif(r->>'createdAt','')::timestamptz,now()),now()
          )
          on conflict(business_id,entity_type,entity_id)
          do update set
            branch_id=excluded.branch_id,payload=excluded.payload,
            occurred_on=excluded.occurred_on,
            version=public.team_records.version+1,
            updated_by=p_user,updated_at=now();
          n:=n+1;
        end if;
      end loop;
    end if;
  end loop;

  if jsonb_typeof(coalesce(p_snapshot->'products','[]'::jsonb))='array' then
    for r in select value from jsonb_array_elements(p_snapshot->'products')
    loop
      if nullif(r->>'id','') is not null then
        insert into public.branch_products(
          business_id,product_id,name,category,sale_price,active,updated_at
        ) values (
          p_business,r->>'id',coalesce(r->>'name',''),coalesce(r->>'category',''),
          coalesce((r->>'salePrice')::numeric,0),true,now()
        )
        on conflict(business_id,product_id)
        do update set
          name=excluded.name,category=excluded.category,
          sale_price=excluded.sale_price,active=true,updated_at=now();
        n:=n+1;
      end if;
    end loop;
  end if;
  return n;
end;
$$;

revoke all on function public.restore_team_backup_part_c(jsonb,uuid,uuid,uuid)
from public,anon,authenticated;

create or replace function public.restore_team_backup(p_backup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  b uuid:=public.current_business_id();
  u uuid:=(select auth.uid());
  br uuid:=public.current_branch_id();
  s jsonb;
  n integer:=0;
  actor text;
begin
  if public.current_app_role()<>'owner'
     and not public.has_app_permission('restore_backups') then
    raise exception 'Solo el propietario puede restaurar respaldos.';
  end if;

  select snapshot into s
  from public.team_backups
  where backup_id=p_backup_id and business_id=b;

  if s is null or jsonb_typeof(s)<>'object' then
    raise exception 'El respaldo no existe o no es válido.';
  end if;

  if br is null then
    select branch_id into br
    from public.branches
    where business_id=b and active=true
    order by created_at
    limit 1;
  end if;

  if br is null then
    raise exception 'El negocio no tiene una sucursal activa.';
  end if;

  perform pg_advisory_xact_lock(hashtext(b::text||':restore-backup'));

  delete from public.team_records where business_id=b;
  delete from public.branch_orders where business_id=b;
  delete from public.team_quotes where business_id=b;
  delete from public.team_customers where business_id=b;
  delete from public.branch_products where business_id=b;

  n:=n+coalesce(public.restore_team_backup_part_a(s,b,u,br),0);
  n:=n+coalesce(public.restore_team_backup_part_b(s,b,u,br),0);
  n:=n+coalesce(public.restore_team_backup_part_c(s,b,u,br),0);

  select coalesce(nullif(display_name,''),email,'Propietario') into actor
  from public.app_users
  where user_id=u
  limit 1;

  insert into public.team_activity(
    business_id,branch_id,actor_id,actor_name,event_type,entity_type,
    entity_id,title,detail
  ) values (
    b,br,u,coalesce(actor,'Propietario'),'restore','backup',p_backup_id::text,
    'Respaldo automático restaurado',n::text||' registros restaurados'
  );

  return jsonb_build_object(
    'ok',true,'backup_id',p_backup_id,'restored',n,'snapshot',s
  );
end;
$$;

revoke all on function public.restore_team_backup(uuid) from public,anon;
grant execute on function public.restore_team_backup(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. BLOQUEOS AMPLIADOS
-- ---------------------------------------------------------------------
alter table public.team_edit_locks
  drop constraint if exists team_edit_locks_entity_type_check;

alter table public.team_edit_locks
  add constraint team_edit_locks_entity_type_check
  check (entity_type in ('order','material','purchase','expense','cash_closing'));

create or replace function public.acquire_team_edit_lock(
  p_entity_type text,
  p_entity_id text,
  p_branch_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  b uuid:=public.current_business_id();
  u uuid:=(select auth.uid());
  actor text;
  l public.team_edit_locks%rowtype;
  acquired boolean:=false;
  allowed boolean:=false;
begin
  allowed:=case p_entity_type
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

  perform pg_advisory_xact_lock(hashtext(b::text||':'||p_entity_type||':'||p_entity_id));

  delete from public.team_edit_locks
  where business_id=b and expires_at<=now();

  select coalesce(nullif(display_name,''),email,'Usuario') into actor
  from public.app_users
  where user_id=u and active=true
  limit 1;

  select * into l
  from public.team_edit_locks
  where business_id=b and entity_type=p_entity_type and entity_id=p_entity_id;

  if l.entity_id is null then
    insert into public.team_edit_locks(
      business_id,branch_id,entity_type,entity_id,user_id,user_name
    ) values (
      b,p_branch_id,p_entity_type,p_entity_id,u,coalesce(actor,'Usuario')
    ) returning * into l;
    acquired:=true;
  elsif l.user_id=u or p_force then
    update public.team_edit_locks
    set branch_id=p_branch_id,
        user_id=u,
        user_name=coalesce(actor,'Usuario'),
        acquired_at=case when l.user_id=u then l.acquired_at else now() end,
        heartbeat_at=now(),
        expires_at=now()+interval '3 minutes'
    where business_id=b and entity_type=p_entity_type and entity_id=p_entity_id
    returning * into l;
    acquired:=true;
  end if;

  return jsonb_build_object(
    'acquired',acquired,'entity_type',l.entity_type,'entity_id',l.entity_id,
    'user_id',l.user_id,'user_name',l.user_name,'expires_at',l.expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. HISTORIAL Y AUTODIAGNÓSTICO FINAL
-- ---------------------------------------------------------------------
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
set search_path=''
as $$
declare
  b uuid:=public.current_business_id();
  effective_branch uuid;
  safe_offset integer:=greatest(coalesce(p_offset,0),0);
  safe_limit integer:=least(greatest(coalesce(p_limit,50),1),5000);
  total_rows bigint;
  result_rows jsonb;
begin
  if safe_limit>100 then
    if not (public.is_business_admin() or public.has_app_permission('export_activity')) then
      raise exception 'No tienes permiso para exportar el historial.';
    end if;
  else
    if not (public.is_business_admin() or public.has_app_permission('view_activity')) then
      raise exception 'No tienes permiso para consultar el historial.';
    end if;
  end if;

  effective_branch:=case
    when public.is_business_admin() then p_branch_id
    else public.current_branch_id()
  end;

  select count(*) into total_rows
  from public.team_activity as activity
  where activity.business_id=b
    and (effective_branch is null or activity.branch_id=effective_branch)
    and (p_user_id is null or activity.actor_id=p_user_id)
    and (p_from is null or activity.created_at>=p_from::timestamptz)
    and (p_to is null or activity.created_at<(p_to+1)::timestamptz);

  select coalesce(
    jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc),
    '[]'::jsonb
  ) into result_rows
  from (
    select activity.*
    from public.team_activity as activity
    where activity.business_id=b
      and (effective_branch is null or activity.branch_id=effective_branch)
      and (p_user_id is null or activity.actor_id=p_user_id)
      and (p_from is null or activity.created_at>=p_from::timestamptz)
      and (p_to is null or activity.created_at<(p_to+1)::timestamptz)
    order by activity.created_at desc
    offset safe_offset
    limit safe_limit
  ) as page_row;

  return jsonb_build_object(
    'rows',result_rows,'total',total_rows,'offset',safe_offset,'limit',safe_limit
  );
end;
$$;

create or replace function public.team_hardening_self_check()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return jsonb_build_object(
    'ok',
      to_regclass('public.team_operation_log') is not null
      and to_regclass('public.team_records') is not null
      and to_regclass('public.team_backups') is not null
      and to_regclass('public.team_edit_locks') is not null
      and to_regprocedure('public.commit_team_batch(uuid,uuid,jsonb)') is not null
      and to_regprocedure('public.restore_team_backup(uuid)') is not null
      and to_regprocedure('public.acquire_team_edit_lock(text,text,uuid,boolean)') is not null,
    'business_id',public.current_business_id(),
    'role',public.current_app_role(),
    'can_view_orders',public.has_app_permission('view_orders'),
    'can_register_payments',public.has_app_permission('register_payments'),
    'can_restore_backups',public.has_app_permission('restore_backups'),
    'checked_at',now()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. PERMISOS Y POLÍTICA FINAL
-- ---------------------------------------------------------------------
revoke all on function public.can_read_team_record(text) from public,anon;
revoke all on function public.can_create_team_record(text) from public,anon;
revoke all on function public.can_edit_team_record(text) from public,anon;
revoke all on function public.can_delete_team_record(text) from public,anon;
revoke all on function public.can_write_team_record(text) from public,anon;
revoke all on function public.commit_team_batch(uuid,uuid,jsonb) from public,anon;
revoke all on function public.restore_team_backup(uuid) from public,anon;
revoke all on function public.acquire_team_edit_lock(text,text,uuid,boolean) from public,anon;
revoke all on function public.heartbeat_team_edit_lock(text,text) from public,anon;
revoke all on function public.release_team_edit_lock(text,text) from public,anon;
revoke all on function public.page_team_activity(uuid,uuid,date,date,integer,integer) from public,anon;
revoke all on function public.team_hardening_self_check() from public,anon;

grant execute on function public.can_read_team_record(text) to authenticated;
grant execute on function public.can_create_team_record(text) to authenticated;
grant execute on function public.can_edit_team_record(text) to authenticated;
grant execute on function public.can_delete_team_record(text) to authenticated;
grant execute on function public.can_write_team_record(text) to authenticated;
grant execute on function public.commit_team_batch(uuid,uuid,jsonb) to authenticated;
grant execute on function public.restore_team_backup(uuid) to authenticated;
grant execute on function public.acquire_team_edit_lock(text,text,uuid,boolean) to authenticated;
grant execute on function public.heartbeat_team_edit_lock(text,text) to authenticated;
grant execute on function public.release_team_edit_lock(text,text) to authenticated;
grant execute on function public.page_team_activity(uuid,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.team_hardening_self_check() to authenticated;

alter table public.team_records enable row level security;

drop policy if exists team_records_select on public.team_records;
create policy team_records_select
on public.team_records
for select to authenticated
using (
  business_id=public.current_business_id()
  and public.can_access_branch(branch_id)
  and public.can_read_team_record(entity_type)
);

grant select on public.team_records to authenticated;

notify pgrst,'reload schema';
