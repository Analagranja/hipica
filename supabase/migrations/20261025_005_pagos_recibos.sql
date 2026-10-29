-- Cobranza, paso 3: pagos, imputaciones (reparto de un pago entre cargos),
-- recibos numerados por club, saldos y funciones para registrar y anular pagos.
-- Los pagos y las imputaciones solo se escriben a través de las funciones de abajo.

-- Contador de recibos por club (solo lo toca registrar_pago)
create table public.recibo_contadores (
  club_id uuid primary key references public.clubes(id) on delete cascade,
  ultimo integer not null default 0
);
alter table public.recibo_contadores enable row level security;

-- Pagos
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  persona_id uuid not null,
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  medio text not null default 'efectivo'
    check (medio in ('efectivo','transferencia','tarjeta','otro')),
  referencia text,
  observaciones text,
  numero_recibo integer not null,
  recibido_por uuid references auth.users(id) on delete set null,
  estado text not null default 'confirmado'
    check (estado in ('confirmado','anulado')),
  motivo_anulacion text,
  anulado_at timestamptz,
  anulado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, club_id),
  unique (club_id, numero_recibo),
  foreign key (persona_id, club_id) references public.personas(id, club_id)
);
create index pagos_persona_idx on public.pagos (persona_id);
create index pagos_club_fecha_idx on public.pagos (club_id, fecha);

-- Imputaciones: cuánto de cada pago se aplicó a cada cargo
create table public.imputaciones (
  pago_id uuid not null,
  cargo_id uuid not null,
  club_id uuid not null references public.clubes(id) on delete restrict,
  monto numeric(12,2) not null check (monto > 0),
  primary key (pago_id, cargo_id),
  foreign key (pago_id, club_id) references public.pagos(id, club_id),
  foreign key (cargo_id, club_id) references public.cargos(id, club_id)
);
create index imputaciones_cargo_idx on public.imputaciones (cargo_id);

-- Vista: cada cargo con lo pagado, el saldo y su estado de cobro
create view public.cargos_con_saldo with (security_invoker = true) as
select c.*,
       x.pagado,
       (c.total - x.pagado) as saldo,
       case
         when c.estado = 'anulado' then 'anulado'
         when c.total - x.pagado <= 0 then 'pagado'
         when x.pagado > 0 then 'parcial'
         when c.vencimiento < current_date then 'vencido'
         else 'pendiente'
       end as estado_cobro
from public.cargos c
cross join lateral (
  select coalesce(sum(i.monto), 0)::numeric(12,2) as pagado
  from public.imputaciones i
  join public.pagos p on p.id = i.pago_id
  where i.cargo_id = c.id and p.estado = 'confirmado'
) x;

-- Vista: cada pago con lo aplicado y lo que quedó sin aplicar (saldo a favor)
create view public.pagos_con_aplicado with (security_invoker = true) as
select p.*,
       x.aplicado,
       (p.monto - x.aplicado) as sin_aplicar
from public.pagos p
cross join lateral (
  select coalesce(sum(i.monto), 0)::numeric(12,2) as aplicado
  from public.imputaciones i
  where i.pago_id = p.id
) x;

-- Vista: deuda y saldo a favor de cada persona
create view public.saldos_persona with (security_invoker = true) as
select pe.id as persona_id,
       pe.club_id,
       coalesce((select sum(c.saldo) from public.cargos_con_saldo c
                 where c.persona_id = pe.id and c.estado = 'emitido'), 0)::numeric(12,2) as deuda,
       coalesce((select sum(c.saldo) from public.cargos_con_saldo c
                 where c.persona_id = pe.id and c.estado = 'emitido'
                   and c.vencimiento < current_date), 0)::numeric(12,2) as deuda_vencida,
       coalesce((select sum(g.sin_aplicar) from public.pagos_con_aplicado g
                 where g.persona_id = pe.id and g.estado = 'confirmado'), 0)::numeric(12,2) as saldo_a_favor
from public.personas pe;

revoke all on public.cargos_con_saldo, public.pagos_con_aplicado, public.saldos_persona from anon;

-- Aplica un pago a cargos (uso interno de las funciones públicas)
create or replace function public.aplicar_imputaciones_interno(p_pago uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago pagos%rowtype;
  v_cargo cargos%rowtype;
  v_item jsonb;
  v_monto numeric;
  v_pend numeric;
  v_aplicado numeric;
  v_nuevo numeric := 0;
begin
  select * into v_pago from pagos where id = p_pago for update;
  if not found then raise exception 'Pago inexistente'; end if;
  if v_pago.estado <> 'confirmado' then raise exception 'El pago está anulado'; end if;

  select coalesce(sum(i.monto), 0) into v_aplicado from imputaciones i where i.pago_id = p_pago;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_monto := (v_item ->> 'monto')::numeric;
    if v_monto is null or v_monto <= 0 then
      raise exception 'Cada importe a aplicar debe ser mayor a cero';
    end if;

    select * into v_cargo from cargos where id = (v_item ->> 'cargo_id')::uuid for update;
    if not found or v_cargo.club_id <> v_pago.club_id then
      raise exception 'Cargo inválido';
    end if;
    if v_cargo.persona_id <> v_pago.persona_id then
      raise exception 'El cargo pertenece a otra persona';
    end if;
    if v_cargo.estado <> 'emitido' then
      raise exception 'No se puede aplicar un pago a un cargo anulado';
    end if;

    select v_cargo.total - coalesce(sum(i.monto), 0) into v_pend
    from imputaciones i
    join pagos pg on pg.id = i.pago_id
    where i.cargo_id = v_cargo.id and pg.estado = 'confirmado';

    if v_monto > v_pend then
      raise exception 'El importe supera el saldo del cargo';
    end if;

    v_nuevo := v_nuevo + v_monto;
    if v_aplicado + v_nuevo > v_pago.monto then
      raise exception 'Lo aplicado supera el monto del pago';
    end if;

    insert into imputaciones (pago_id, cargo_id, club_id, monto)
    values (p_pago, v_cargo.id, v_pago.club_id, v_monto)
    on conflict (pago_id, cargo_id)
    do update set monto = imputaciones.monto + excluded.monto;
  end loop;
end $$;

-- Registra un pago con su número de recibo y, opcionalmente, lo reparte entre cargos
create or replace function public.registrar_pago(
  p_club uuid,
  p_persona uuid,
  p_monto numeric,
  p_fecha date,
  p_medio text,
  p_referencia text,
  p_observaciones text,
  p_imputaciones jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pago uuid;
  v_num integer;
begin
  if not public.tiene_rol(p_club, 'administrador') then
    raise exception 'Solo el administrador puede registrar pagos';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if not exists (select 1 from personas where id = p_persona and club_id = p_club) then
    raise exception 'Persona inválida';
  end if;

  insert into recibo_contadores (club_id, ultimo) values (p_club, 1)
  on conflict (club_id) do update set ultimo = recibo_contadores.ultimo + 1
  returning ultimo into v_num;

  insert into pagos (club_id, persona_id, monto, fecha, medio, referencia,
                     observaciones, numero_recibo, recibido_por)
  values (p_club, p_persona, p_monto, coalesce(p_fecha, current_date),
          coalesce(p_medio, 'efectivo'), p_referencia, p_observaciones, v_num, auth.uid())
  returning id into v_pago;

  if jsonb_array_length(coalesce(p_imputaciones, '[]'::jsonb)) > 0 then
    perform public.aplicar_imputaciones_interno(v_pago, p_imputaciones);
  end if;

  return v_pago;
end $$;

-- Aplica el saldo sin aplicar de un pago a otros cargos
create or replace function public.imputar_pago(p_pago uuid, p_imputaciones jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club uuid;
begin
  select club_id into v_club from pagos where id = p_pago;
  if v_club is null then raise exception 'Pago inexistente'; end if;
  if not public.tiene_rol(v_club, 'administrador') then
    raise exception 'Solo el administrador puede aplicar pagos';
  end if;
  perform public.aplicar_imputaciones_interno(p_pago, p_imputaciones);
end $$;

-- Anula un pago (no se borra): los cargos recuperan su saldo
create or replace function public.anular_pago(p_pago uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago pagos%rowtype;
begin
  select * into v_pago from pagos where id = p_pago for update;
  if not found then raise exception 'Pago inexistente'; end if;
  if not public.tiene_rol(v_pago.club_id, 'administrador') then
    raise exception 'Solo el administrador puede anular pagos';
  end if;
  if v_pago.estado = 'anulado' then raise exception 'El pago ya está anulado'; end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo de la anulación es obligatorio';
  end if;

  update pagos
     set estado = 'anulado',
         motivo_anulacion = trim(p_motivo),
         anulado_at = now(),
         anulado_por = auth.uid()
   where id = p_pago;
end $$;

revoke all on function
  public.aplicar_imputaciones_interno(uuid, jsonb),
  public.registrar_pago(uuid, uuid, numeric, date, text, text, text, jsonb),
  public.imputar_pago(uuid, jsonb),
  public.anular_pago(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.registrar_pago(uuid, uuid, numeric, date, text, text, text, jsonb),
  public.imputar_pago(uuid, jsonb),
  public.anular_pago(uuid, text)
to authenticated;

-- No se puede anular un cargo que tiene pagos aplicados
create or replace function public.cargos_bloquear_anulacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'anulado' and old.estado <> 'anulado' and exists (
    select 1
    from imputaciones i
    join pagos p on p.id = i.pago_id
    where i.cargo_id = new.id and p.estado = 'confirmado'
  ) then
    raise exception 'No se puede anular un cargo con pagos aplicados. Anulá primero el pago.';
  end if;
  return new;
end $$;

create trigger cargos_bloquear_anulacion
  before update on public.cargos
  for each row execute function public.cargos_bloquear_anulacion();

-- Seguridad: lectura por administrador o por la persona que pagó; sin escritura directa
alter table public.pagos enable row level security;
alter table public.imputaciones enable row level security;

create policy pagos_select on public.pagos
  for select to authenticated
  using (
    public.tiene_rol(club_id, 'administrador')
    or persona_id = public.persona_actual(club_id)
  );

create policy imputaciones_select on public.imputaciones
  for select to authenticated
  using (exists (
    select 1 from public.pagos p where p.id = imputaciones.pago_id
  ));
