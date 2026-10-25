import { mensajeErrorSupabase } from './errores.ts'
import { type Rol } from './roles.ts'
import { supabase } from './supabase.ts'

export type EstadoAcceso = 'sin-acceso' | 'pendiente' | 'con-acceso'

export type InvitacionPendiente = {
  id: string
  token: string
  email: string
}

export type DatosPersona = {
  nombre: string
  apellido: string
  telefono: string
  email: string
  documento: string
  roles: Rol[]
}

export type PersonaClub = {
  id: string
  nombre: string
  apellido: string | null
  telefono: string | null
  email: string | null
  documento: string | null
  activa: boolean
  roles: Rol[]
  acceso: EstadoAcceso
  invitacion: InvitacionPendiente | null
}

type ErrorDato = {
  code?: string
  message?: string
  details?: string | null
}

type FilaPersona = {
  id: string
  nombre: string | null
  apellido: string | null
  telefono: string | null
  email: string | null
  documento: string | null
  activa: boolean | null
}

type FilaRol = {
  persona_id: string
  rol: string | null
}

type FilaMembresia = {
  persona_id: string
  activa: boolean | null
}

type FilaInvitacion = {
  id: string
  persona_id: string
  email: string | null
  token: string | null
  estado: string | null
  created_at: string | null
}

const ROLES: Rol[] = ['administrador', 'profesor', 'caballerizo', 'propietario', 'alumno']

function esRol(valor: string | null): valor is Rol {
  return ROLES.some((rol) => rol === valor)
}

function vacio(valor: string): string | null {
  const limpio = valor.trim()
  return limpio || null
}

function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
}

function normalizarEmail(valor: string): string | null {
  const limpio = valor.trim().toLowerCase()
  if (!limpio) return null
  if (!correoValido(limpio)) throw new Error('El correo no tiene un formato válido.')
  return limpio
}

function rolesUnicos(roles: Rol[]): Rol[] {
  return ROLES.filter((rol) => roles.includes(rol))
}

function exigirFila(data: { id: string }[] | null, error: ErrorDato | null) {
  if (error) throw new Error(mensajeErrorSupabase(error))
  if (!data || data.length === 0) throw new Error('No tenés permiso para hacer eso.')
}

async function rolesDe(personaIds: string[]): Promise<Map<string, Rol[]>> {
  const mapa = new Map<string, Rol[]>()
  if (personaIds.length === 0) return mapa

  const { data, error } = await supabase
    .from('roles_persona')
    .select('persona_id, rol')
    .in('persona_id', personaIds)

  if (error) throw new Error(mensajeErrorSupabase(error))

  for (const fila of (data ?? []) as FilaRol[]) {
    if (!esRol(fila.rol)) continue
    const lista = mapa.get(fila.persona_id) ?? []
    lista.push(fila.rol)
    mapa.set(fila.persona_id, lista)
  }

  for (const [id, lista] of mapa) {
    mapa.set(id, rolesUnicos(lista))
  }

  return mapa
}

async function sincronizarRoles(personaId: string, roles: Rol[]) {
  const { data, error } = await supabase
    .from('roles_persona')
    .select('rol')
    .eq('persona_id', personaId)

  if (error) throw new Error(mensajeErrorSupabase(error))

  const actuales = rolesUnicos(
    ((data ?? []) as { rol: string | null }[]).flatMap((fila) => (esRol(fila.rol) ? [fila.rol] : [])),
  )
  const quitar = actuales.filter((rol) => !roles.includes(rol))
  const agregar = roles.filter((rol) => !actuales.includes(rol))

  for (const rol of quitar) {
    const { error: errorBorrado } = await supabase
      .from('roles_persona')
      .delete()
      .eq('persona_id', personaId)
      .eq('rol', rol)
    if (errorBorrado) throw new Error(mensajeErrorSupabase(errorBorrado))
  }

  if (agregar.length === 0) return

  const { error: errorAlta } = await supabase
    .from('roles_persona')
    .insert(agregar.map((rol) => ({ persona_id: personaId, rol })))

  if (errorAlta) throw new Error(mensajeErrorSupabase(errorAlta))
}

function armarPersona(
  fila: FilaPersona,
  roles: Rol[],
  conAcceso: boolean,
  invitacion: InvitacionPendiente | null,
): PersonaClub | null {
  if (!fila.id || !fila.nombre) return null
  let acceso: EstadoAcceso = 'sin-acceso'
  if (conAcceso) acceso = 'con-acceso'
  else if (invitacion) acceso = 'pendiente'

  return {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    telefono: fila.telefono,
    email: fila.email,
    documento: fila.documento,
    activa: Boolean(fila.activa),
    roles,
    acceso,
    invitacion: acceso === 'pendiente' ? invitacion : null,
  }
}

export async function obtenerPersona(clubId: string, personaId: string): Promise<PersonaClub | null> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, apellido, telefono, email, documento, activa')
    .eq('club_id', clubId)
    .eq('id', personaId)
    .maybeSingle()

  if (error) {
    if (error.code === '22P02') return null
    throw new Error(mensajeErrorSupabase(error))
  }
  if (!data) return null

  const fila = data as FilaPersona
  const [roles, membresias, invitaciones] = await Promise.all([
    rolesDe([fila.id]),
    supabase
      .from('membresias')
      .select('persona_id, activa')
      .eq('club_id', clubId)
      .eq('persona_id', fila.id),
    supabase
      .from('invitaciones')
      .select('id, persona_id, email, token, estado, created_at')
      .eq('club_id', clubId)
      .eq('persona_id', fila.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (membresias.error) throw new Error(mensajeErrorSupabase(membresias.error))
  if (invitaciones.error) throw new Error(mensajeErrorSupabase(invitaciones.error))

  const conAcceso = ((membresias.data ?? []) as FilaMembresia[]).some((membresia) => membresia.activa)
  const pendiente = ((invitaciones.data ?? []) as FilaInvitacion[])[0]
  const invitacion =
    pendiente?.id && pendiente.token && pendiente.email
      ? { id: pendiente.id, token: pendiente.token, email: pendiente.email }
      : null

  return armarPersona(fila, roles.get(fila.id) ?? [], conAcceso, invitacion)
}

export async function obtenerPersonas(clubId: string): Promise<PersonaClub[]> {
  const [personas, membresias, invitaciones] = await Promise.all([
    supabase
      .from('personas')
      .select('id, nombre, apellido, telefono, email, documento, activa')
      .eq('club_id', clubId),
    supabase.from('membresias').select('persona_id, activa').eq('club_id', clubId),
    supabase
      .from('invitaciones')
      .select('id, persona_id, email, token, estado, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false }),
  ])

  if (personas.error) throw new Error(mensajeErrorSupabase(personas.error))
  if (membresias.error) throw new Error(mensajeErrorSupabase(membresias.error))
  if (invitaciones.error) throw new Error(mensajeErrorSupabase(invitaciones.error))

  const filas = (personas.data ?? []) as FilaPersona[]
  const roles = await rolesDe(filas.map((fila) => fila.id))
  const conAcceso = new Set(
    ((membresias.data ?? []) as FilaMembresia[])
      .filter((fila) => fila.activa)
      .map((fila) => fila.persona_id),
  )
  const pendiente = new Map<string, InvitacionPendiente>()

  for (const fila of (invitaciones.data ?? []) as FilaInvitacion[]) {
    if (fila.estado !== 'pendiente' || !fila.token || !fila.email || pendiente.has(fila.persona_id)) {
      continue
    }
    pendiente.set(fila.persona_id, { id: fila.id, token: fila.token, email: fila.email })
  }

  const lista = filas.flatMap((fila) => {
    const persona = armarPersona(
      fila,
      roles.get(fila.id) ?? [],
      conAcceso.has(fila.id),
      pendiente.get(fila.id) ?? null,
    )
    return persona ? [persona] : []
  })

  lista.sort((a, b) => {
    const apellido = (a.apellido ?? '').localeCompare(b.apellido ?? '', 'es')
    if (apellido !== 0) return apellido
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  return lista
}

export async function crearPersona(clubId: string, datos: DatosPersona): Promise<string> {
  const nombre = datos.nombre.trim()
  if (!nombre) throw new Error('Ingresá el nombre.')
  const email = normalizarEmail(datos.email)
  const roles = rolesUnicos(datos.roles)

  const { data, error } = await supabase
    .from('personas')
    .insert({
      club_id: clubId,
      nombre,
      apellido: vacio(datos.apellido),
      telefono: vacio(datos.telefono),
      email,
      documento: vacio(datos.documento),
    })
    .select('id')

  exigirFila(data as { id: string }[] | null, error)
  const id = (data as { id: string }[])[0]?.id
  if (!id) throw new Error('No se pudo crear la persona.')
  if (roles.length > 0) await sincronizarRoles(id, roles)
  return id
}

export async function actualizarPersona(
  clubId: string,
  personaId: string,
  personaActualId: string,
  datos: DatosPersona,
): Promise<void> {
  const nombre = datos.nombre.trim()
  if (!nombre) throw new Error('Ingresá el nombre.')
  const roles = rolesUnicos(datos.roles)
  if (personaId === personaActualId && !roles.includes('administrador')) {
    throw new Error('No podés quitarte el rol de administrador.')
  }

  const { data, error } = await supabase
    .from('personas')
    .update({
      nombre,
      apellido: vacio(datos.apellido),
      telefono: vacio(datos.telefono),
      email: normalizarEmail(datos.email),
      documento: vacio(datos.documento),
    })
    .eq('id', personaId)
    .eq('club_id', clubId)
    .select('id')

  exigirFila(data as { id: string }[] | null, error)
  await sincronizarRoles(personaId, roles)
}

export async function cambiarActivaPersona(
  clubId: string,
  personaId: string,
  personaActualId: string,
  activa: boolean,
): Promise<void> {
  if (personaId === personaActualId && !activa) {
    throw new Error('No podés desactivarte.')
  }

  const { data, error } = await supabase
    .from('personas')
    .update({ activa })
    .eq('id', personaId)
    .eq('club_id', clubId)
    .select('id')

  exigirFila(data as { id: string }[] | null, error)
}

export async function invitarPersona(
  clubId: string,
  personaId: string,
  email: string,
): Promise<InvitacionPendiente> {
  const correo = email.trim().toLowerCase()
  if (!correoValido(correo)) throw new Error('El correo no tiene un formato válido.')

  const { data: existentes, error: errorBusqueda } = await supabase
    .from('invitaciones')
    .select('id, token, email, estado, created_at')
    .eq('club_id', clubId)
    .eq('persona_id', personaId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(1)

  if (errorBusqueda) throw new Error(mensajeErrorSupabase(errorBusqueda))

  const previa = ((existentes ?? []) as FilaInvitacion[])[0]
  if (previa?.id && previa.token && previa.email) {
    return { id: previa.id, token: previa.token, email: previa.email }
  }

  const { data, error } = await supabase
    .from('invitaciones')
    .insert({ club_id: clubId, persona_id: personaId, email: correo })
    .select('id, token, email')

  if (error) throw new Error(mensajeErrorSupabase(error))
  const creada = ((data ?? []) as FilaInvitacion[])[0]
  if (!creada?.id || !creada.token || !creada.email) {
    throw new Error('No se pudo crear la invitación.')
  }
  return { id: creada.id, token: creada.token, email: creada.email }
}

export async function cancelarInvitacion(clubId: string, invitacionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('invitaciones')
    .update({ estado: 'cancelada' })
    .eq('id', invitacionId)
    .eq('club_id', clubId)
    .select('id')

  exigirFila(data as { id: string }[] | null, error)
}
