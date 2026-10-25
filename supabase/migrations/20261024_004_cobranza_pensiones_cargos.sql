-- Cobranza, pasos 1 y 2: conceptos, pensiones con ítems, cargos y generación mensual

-- Necesario para las claves compuestas (id, club_id) hacia caballos
alter table public.caballos
  add constraint caballos_id_club_unique unique (id, club_id);

-- Catálogo de conceptos de cobro del club
create table public.conceptos_cobro (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  nombre text not null,
  categoria text not null default 'otro'
    check (categoria in ('pension','derecho_pista','alimentacion','herraje',
                         'sanidad','alquiler_pista','clase','otro')),
  monto_sugerido numeric(12,2) not null default 0,
  titular text not null default 'club'
    check (titular in ('club','profesor')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, club_id),
  unique (club_id, nombre)
);

-- Pensión de un caballo (una activa por caballo)
create table public.pensiones (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  caballo_id uuid not null,
  responsable_id uuid not null,
  dia_vencimiento int not null default 10
    check (dia_vencimiento between 1 and 28),
  inicio date not null default current_date,
  fin date,
  estado text not null default 'activa'
    check (estado in ('activa','finalizada')),
  created_at timestamptz not null default now(),
  check (fin is null or fin >= inicio),
  unique (id, club_id),
  foreign key (caballo_id, club_id) references public.caballos(id, club_id),
  foreign key (responsable_id, club_id) references public.personas(id, club_id)
);
create unique index pensiones_una_activa_por_caballo
  on public.pensiones (caballo_id) where estado = 'activa';
create index pensiones_club_idx on public.pensiones (club_id);

-- Ítems de cada pensión, con vigencia (el monto puede ser negativo: bonificación)
create table public.pension_items (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  pension_id uuid not null,
  concepto_id uuid not null,
  monto numeric(12,2) not null check (monto <> 0),
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  foreign key (pension_id, club_id)
    references public.pensiones(id, club_id) on delete cascade,
  foreign key (concepto_id, club_id)
    references public.conceptos_cobro(id, club_id)
);
create index pension_items_pension_idx on public.pension_items (pension_id);

-- Cargos: lo que se debe por un período
create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  persona_id uuid not null,
  pension_id uuid,
  periodo date not null check (extract(day from periodo) = 1),
  vencimiento date not null,
  total numeric(12,2) not null default 0,
  descripcion text,
  estado text not null default 'emitido'
    check (estado in ('emitido','anulado')),
  motivo_anulacion text,
  created_at timestamptz not null default now(),
  unique (id, club_id),
  foreign key (persona_id, club_id) references public.personas(id, club_id),
  foreign key (pension_id, club_id) references public.pensiones(id, club_id)
);
create unique index cargos_un_cargo_por_pension_y_periodo
  on public.cargos (pension_id, periodo)
  where pension_id is not null and estado <> 'anulado';
create index cargos_club_periodo_idx on public.cargos (club_id, periodo);
create index cargos_persona_idx on public.cargos (persona_id);

-- Detalle de cada cargo (copia de los ítems vigentes al generarlo)
create table public.cargo_items (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  cargo_id uuid not null,
  concepto_id uuid,
  descripcion text not null,
  monto numeric(12,2) not null,
  foreign key (cargo_id, club_id)
    references public.cargos(id, club_id) on delete cascade,
  foreign key (concepto_id, club_id)
    references public.conceptos_cobro(id, club_id)
);
create index cargo_items_cargo_idx on public.cargo_items (cargo_id);

-- Generación de cargos del mes (solo administrador, no duplica)
create or replace function public.generar_cargos_mes(p_club uuid, p_periodo date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_inicio date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month' - interval '1 day')::date;
  v_pension record;
  v_cargo uuid;
  v_total numeric;
  v_items integer;
  v_creados integer := 0;
begin
  if not public.tiene_rol(p_club, 'administrador') then
    raise exception 'Solo el administrador puede generar cargos';
  end if;

  for v_pension in
    select p.id, p.responsable_id, p.dia_vencimiento, c.nombre as caballo
    from pensiones p
    join caballos c on c.id = p.caballo_id
    where p.club_id = p_club
      and p.estado = 'activa'
      and p.inicio <= v_fin
      and (p.fin is null or p.fin >= v_inicio)
      and not exists (
        select 1 from cargos g
        where g.pension_id = p.id and g.periodo = v_inicio and g.estado <> 'anulado'
      )
  loop
    select count(*), coalesce(sum(i.monto), 0) into v_items, v_total
    from pension_items i
    where i.pension_id = v_pension.id
      and i.vigente_desde <= v_fin
      and (i.vigente_hasta is null or i.vigente_hasta >= v_inicio);

    if v_items = 0 then
      continue;
    end if;

    insert into cargos (club_id, persona_id, pension_id, periodo, vencimiento, total)
    values (p_club, v_pension.responsable_id, v_pension.id, v_inicio,
            v_inicio + (v_pension.dia_vencimiento - 1), v_total)
    returning id into v_cargo;

    insert into cargo_items (club_id, cargo_id, concepto_id, descripcion, monto)
    select p_club, v_cargo, i.concepto_id, k.nombre || ' · ' || v_pension.caballo, i.monto
    from pension_items i
    join conceptos_cobro k on k.id = i.concepto_id
    where i.pension_id = v_pension.id
      and i.vigente_desde <= v_fin
      and (i.vigente_hasta is null or i.vigente_hasta >= v_inicio);

    v_creados := v_creados + 1;
  end loop;

  return v_creados;
end $$;

revoke all on function public.generar_cargos_mes(uuid, date) from public, anon;
grant execute on function public.generar_cargos_mes(uuid, date) to authenticated;

-- Seguridad
alter table public.conceptos_cobro enable row level security;
alter table public.pensiones enable row level security;
alter table public.pension_items enable row level security;
alter table public.cargos enable row level security;
alter table public.cargo_items enable row level security;

create policy conceptos_admin on public.conceptos_cobro
  for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy pensiones_select on public.pensiones
  for select to authenticated
  using (
    public.tiene_rol(club_id, 'administrador')
    or responsable_id = public.persona_actual(club_id)
  );
create policy pensiones_admin on public.pensiones
  for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy pension_items_select on public.pension_items
  for select to authenticated
  using (exists (
    select 1 from public.pensiones p where p.id = pension_items.pension_id
  ));
create policy pension_items_admin on public.pension_items
  for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy cargos_select on public.cargos
  for select to authenticated
  using (
    public.tiene_rol(club_id, 'administrador')
    or persona_id = public.persona_actual(club_id)
  );
create policy cargos_admin on public.cargos
  for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy cargo_items_select on public.cargo_items
  for select to authenticated
  using (exists (
    select 1 from public.cargos c where c.id = cargo_items.cargo_id
  ));
create policy cargo_items_admin on public.cargo_items
  for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));
