-- Fechas de ingreso y de baja del caballo, y prorrateo de las pensiones por días

alter table public.caballos
  add column fecha_ingreso date,
  add column fecha_baja date;

-- Los caballos que ya existen toman como ingreso el día en que se cargaron
update public.caballos
   set fecha_ingreso = created_at::date
 where fecha_ingreso is null;

alter table public.caballos
  alter column fecha_ingreso set not null,
  alter column fecha_ingreso set default current_date,
  add constraint caballos_fechas_check
    check (fecha_baja is null or fecha_baja >= fecha_ingreso);

-- Opción del club: cobrar por días proporcionales el primer y el último mes
alter table public.clubes
  add column prorratear_pensiones boolean not null default true;

-- Generación de cargos del mes con prorrateo
-- Cada ítem se cobra por los días en que estuvo vigente dentro del período de la pensión.
-- Con prorrateo desactivado, un ítem que toca el mes se cobra completo.
create or replace function public.generar_cargos_mes(p_club uuid, p_periodo date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_inicio date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month' - interval '1 day')::date;
  v_dias_mes integer;
  v_prorratear boolean;
  v_pension record;
  v_cargo uuid;
  v_items integer;
  v_creados integer := 0;
begin
  if not public.tiene_rol(p_club, 'administrador') then
    raise exception 'Solo el administrador puede generar cargos';
  end if;

  v_dias_mes := extract(day from v_fin)::integer;
  select prorratear_pensiones into v_prorratear from clubes where id = p_club;
  v_prorratear := coalesce(v_prorratear, true);

  for v_pension in
    select p.id, p.responsable_id, p.dia_vencimiento, p.inicio, p.fin,
           c.nombre as caballo
    from pensiones p
    join caballos c on c.id = p.caballo_id
    where p.club_id = p_club
      and p.inicio <= v_fin
      and (p.fin is null or p.fin >= v_inicio)
      and not exists (
        select 1 from cargos g
        where g.pension_id = p.id and g.periodo = v_inicio and g.estado <> 'anulado'
      )
  loop
    select count(*) into v_items
    from pension_items i
    where i.pension_id = v_pension.id
      and greatest(i.vigente_desde, v_pension.inicio, v_inicio)
          <= least(coalesce(i.vigente_hasta, v_fin), coalesce(v_pension.fin, v_fin), v_fin);

    if v_items = 0 then
      continue;
    end if;

    insert into cargos (club_id, persona_id, pension_id, periodo, vencimiento, total)
    values (p_club, v_pension.responsable_id, v_pension.id, v_inicio,
            greatest(v_inicio + (v_pension.dia_vencimiento - 1), v_pension.inicio),
            0)
    returning id into v_cargo;

    insert into cargo_items (club_id, cargo_id, concepto_id, descripcion, monto)
    select p_club, v_cargo, i.concepto_id,
           k.nombre || ' · ' || v_pension.caballo ||
             case when v_prorratear and x.dias < v_dias_mes
                  then ' (' || x.dias || ' de ' || v_dias_mes || ' días)'
                  else '' end,
           case when v_prorratear
                then round(i.monto * x.dias / v_dias_mes, 2)
                else i.monto end
    from pension_items i
    join conceptos_cobro k on k.id = i.concepto_id
    cross join lateral (
      select (least(coalesce(i.vigente_hasta, v_fin), coalesce(v_pension.fin, v_fin), v_fin)
              - greatest(i.vigente_desde, v_pension.inicio, v_inicio) + 1) as dias
    ) x
    where i.pension_id = v_pension.id
      and x.dias > 0;

    update cargos
       set total = coalesce((select sum(ci.monto) from cargo_items ci where ci.cargo_id = v_cargo), 0)
     where id = v_cargo;

    v_creados := v_creados + 1;
  end loop;

  return v_creados;
end $$;

revoke all on function public.generar_cargos_mes(uuid, date) from public, anon;
grant execute on function public.generar_cargos_mes(uuid, date) to authenticated;
