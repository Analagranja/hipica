create table public.clubes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  color_acento text not null default 'dorado'
    check (color_acento in ('dorado','bronce','borravino')),
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  nombre text not null,
  apellido text,
  telefono text,
  email text,
  documento text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, club_id)
);
create index personas_club_idx on public.personas (club_id);

create table public.roles_persona (
  persona_id uuid not null references public.personas(id) on delete cascade,
  rol text not null
    check (rol in ('administrador','profesor','caballerizo','propietario','alumno')),
  primary key (persona_id, rol)
);

create table public.membresias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubes(id) on delete cascade,
  persona_id uuid not null unique,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (usuario_id, club_id),
  foreign key (persona_id, club_id) references public.personas(id, club_id)
);
create index membresias_usuario_idx on public.membresias (usuario_id, club_id);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete cascade,
  persona_id uuid not null,
  email text not null,
  token uuid not null unique default gen_random_uuid(),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aceptada','cancelada')),
  vence_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  foreign key (persona_id, club_id)
    references public.personas(id, club_id) on delete cascade
);

create table public.cuadras (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, club_id),
  unique (club_id, nombre)
);

create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  cuadra_id uuid not null,
  numero text not null,
  estado text not null default 'activo'
    check (estado in ('activo','mantenimiento')),
  unique (id, club_id),
  unique (cuadra_id, numero),
  foreign key (cuadra_id, club_id) references public.cuadras(id, club_id)
);

create table public.caballos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete restrict,
  box_id uuid,
  propietario_id uuid,
  nombre text not null,
  tipo text not null default 'particular'
    check (tipo in ('escuela','particular')),
  nacimiento date,
  estado text not null default 'activo'
    check (estado in ('activo','baja')),
  created_at timestamptz not null default now(),
  check ((tipo = 'escuela') = (propietario_id is null)),
  foreign key (box_id, club_id) references public.boxes(id, club_id),
  foreign key (propietario_id, club_id) references public.personas(id, club_id)
);
create index caballos_club_idx on public.caballos (club_id);
create unique index caballos_un_caballo_por_box
  on public.caballos (box_id) where box_id is not null and estado = 'activo';
