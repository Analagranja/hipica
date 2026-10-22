create or replace function public.es_miembro_del_club(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membresias m
    where m.usuario_id = auth.uid() and m.club_id = p_club and m.activa
  );
$$;

create or replace function public.tiene_rol(p_club uuid, p_rol text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membresias m
    join roles_persona r on r.persona_id = m.persona_id
    where m.usuario_id = auth.uid() and m.club_id = p_club
      and m.activa and r.rol = p_rol
  );
$$;

create or replace function public.persona_actual(p_club uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.persona_id from membresias m
  where m.usuario_id = auth.uid() and m.club_id = p_club and m.activa
  limit 1;
$$;

create or replace function public.club_de_persona(p_persona uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select club_id from personas where id = p_persona;
$$;

create or replace function public.crear_club(p_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_club uuid; v_persona uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_email := auth.jwt() ->> 'email';
  insert into clubes (nombre) values (p_nombre) returning id into v_club;
  insert into personas (club_id, nombre, email)
    values (v_club, coalesce(nullif(split_part(v_email, '@', 1), ''), 'Administrador'), v_email)
    returning id into v_persona;
  insert into roles_persona (persona_id, rol) values (v_persona, 'administrador');
  insert into membresias (usuario_id, club_id, persona_id)
    values (auth.uid(), v_club, v_persona);
  return v_club;
end $$;

create or replace function public.aceptar_invitacion(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv invitaciones%rowtype;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_inv from invitaciones
    where token = p_token and estado = 'pendiente' and vence_at > now()
    for update;
  if not found then raise exception 'Invitación inválida o vencida'; end if;
  if lower(v_inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'La invitación es para otro correo';
  end if;
  insert into membresias (usuario_id, club_id, persona_id)
    values (auth.uid(), v_inv.club_id, v_inv.persona_id);
  update invitaciones set estado = 'aceptada' where id = v_inv.id;
  return v_inv.club_id;
end $$;

revoke all on function
  public.es_miembro_del_club(uuid), public.tiene_rol(uuid, text),
  public.persona_actual(uuid), public.club_de_persona(uuid),
  public.crear_club(text), public.aceptar_invitacion(uuid)
from public, anon;
grant execute on function
  public.es_miembro_del_club(uuid), public.tiene_rol(uuid, text),
  public.persona_actual(uuid), public.club_de_persona(uuid),
  public.crear_club(text), public.aceptar_invitacion(uuid)
to authenticated;

alter table public.clubes enable row level security;
alter table public.personas enable row level security;
alter table public.roles_persona enable row level security;
alter table public.membresias enable row level security;
alter table public.invitaciones enable row level security;
alter table public.cuadras enable row level security;
alter table public.boxes enable row level security;
alter table public.caballos enable row level security;

create policy clubes_select on public.clubes for select to authenticated
  using (public.es_miembro_del_club(id));
create policy clubes_update on public.clubes for update to authenticated
  using (public.tiene_rol(id, 'administrador'))
  with check (public.tiene_rol(id, 'administrador'));

create policy personas_select on public.personas for select to authenticated
  using (public.tiene_rol(club_id, 'administrador') or id = public.persona_actual(club_id));
create policy personas_admin on public.personas for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy roles_select on public.roles_persona for select to authenticated
  using (
    public.tiene_rol(public.club_de_persona(persona_id), 'administrador')
    or persona_id = public.persona_actual(public.club_de_persona(persona_id))
  );
create policy roles_admin on public.roles_persona for all to authenticated
  using (public.tiene_rol(public.club_de_persona(persona_id), 'administrador'))
  with check (public.tiene_rol(public.club_de_persona(persona_id), 'administrador'));

create policy membresias_select on public.membresias for select to authenticated
  using (usuario_id = auth.uid() or public.tiene_rol(club_id, 'administrador'));
create policy membresias_update on public.membresias for update to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy invitaciones_admin on public.invitaciones for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy cuadras_select on public.cuadras for select to authenticated
  using (public.es_miembro_del_club(club_id));
create policy cuadras_admin on public.cuadras for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));
create policy boxes_select on public.boxes for select to authenticated
  using (public.es_miembro_del_club(club_id));
create policy boxes_admin on public.boxes for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));

create policy caballos_select on public.caballos for select to authenticated
  using (
    public.tiene_rol(club_id, 'administrador')
    or public.tiene_rol(club_id, 'profesor')
    or public.tiene_rol(club_id, 'caballerizo')
    or propietario_id = public.persona_actual(club_id)
  );
create policy caballos_admin on public.caballos for all to authenticated
  using (public.tiene_rol(club_id, 'administrador'))
  with check (public.tiene_rol(club_id, 'administrador'));
