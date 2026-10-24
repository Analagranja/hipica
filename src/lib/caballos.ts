import { obtenerCuadras } from './cuadras.ts'
import { mensajeErrorSupabase } from './errores.ts'
import { supabase } from './supabase.ts'

export type TipoCaballo = 'escuela' | 'particular'
export type EstadoCaballo = 'activo' | 'baja'
export type SexoCaballo = 'yegua' | 'padrillo' | 'castrado'

export type PropietarioCaballo = {
  id: string
  nombre: string
  apellido: string | null
}

export type UbicacionCaballo = {
  boxId: string
  numero: string
  cuadraId: string
  cuadraNombre: string
}

export type Caballo = {
  id: string
  nombre: string
  tipo: TipoCaballo
  estado: EstadoCaballo
  nacimiento: string | null
  raza: string | null
  pelaje: string | null
  sexo: SexoCaballo | null
  numeroRegistro: string | null
  observaciones: string | null
  fotoPath: string | null
  fotoUrl: string | null
  propietarioId: string | null
  propietario: PropietarioCaballo | null
  ubicacion: UbicacionCaballo | null
}

export type DatosCaballo = {
  nombre: string
  tipo: TipoCaballo
  propietarioId: string
  boxId: string
  nacimiento: string
  raza: string
  pelaje: string
  sexo: '' | SexoCaballo
  numeroRegistro: string
  observaciones: string
}

export type PersonaActiva = {
  id: string
  nombre: string
  apellido: string | null
}

export type BoxDisponible = {
  id: string
  numero: string
  cuadraId: string
  cuadraNombre: string
}

type ErrorDato = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

type FilaCaballo = {
  id: string
  nombre: string | null
  tipo: string | null
  estado: string | null
  nacimiento: string | null
  raza: string | null
  pelaje: string | null
  sexo: string | null
  numero_registro: string | null
  observaciones: string | null
  foto_path: string | null
  propietario_id: string | null
  box_id: string | null
}

type FilaBox = {
  id: string
  numero: string
  cuadraId: string
}

type Firma = {
  path: string | null
  signedUrl: string | null
  error: string | null
}

const COLUMNAS =
  'id, nombre, tipo, estado, nacimiento, raza, pelaje, sexo, numero_registro, observaciones, foto_path, propietario_id, box_id'

const MENSAJE_BOX = 'Ese box ya está ocupado por otro caballo'
const MENSAJE_TIPO = 'Un caballo de escuela no lleva propietario y uno particular sí'
const BUCKET = 'caballos'
const URL_SEGUNDOS = 60 * 60

function esTipo(valor: string | null): valor is TipoCaballo {
  return valor === 'escuela' || valor === 'particular'
}

function esEstado(valor: string | null): valor is EstadoCaballo {
  return valor === 'activo' || valor === 'baja'
}

function esSexo(valor: string | null): valor is SexoCaballo {
  return valor === 'yegua' || valor === 'padrillo' || valor === 'castrado'
}

function vacio(valor: string): string | null {
  const limpio = valor.trim()
  return limpio || null
}

function textoError(error: ErrorDato): string {
  return `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
}

function mensajeCaballo(error: ErrorDato | null): string {
  if (!error) return mensajeErrorSupabase(error)
  const texto = textoError(error)
  if (
    error.code === '23505' &&
    (texto.includes('caballos_un_caballo_por_box') || texto.includes('box_id'))
  ) {
    return MENSAJE_BOX
  }
  if (error.code === '23514') return MENSAJE_TIPO
  return mensajeErrorSupabase(error)
}

function exigirCambio(data: { id: string }[] | null, error: ErrorDato | null) {
  if (error) throw new Error(mensajeCaballo(error))
  if (!data || data.length === 0) throw new Error('No tenés permiso para hacer eso.')
}

function normalizar(datos: DatosCaballo) {
  const nombre = datos.nombre.trim()
  if (!nombre) throw new Error('Ingresá el nombre.')
  const propietarioId = datos.tipo === 'particular' ? vacio(datos.propietarioId) : null
  if (datos.tipo === 'particular' && !propietarioId) throw new Error(MENSAJE_TIPO)
  const sexo = esSexo(datos.sexo) ? datos.sexo : null

  return {
    nombre,
    tipo: datos.tipo,
    propietario_id: propietarioId,
    box_id: vacio(datos.boxId),
    nacimiento: vacio(datos.nacimiento),
    raza: vacio(datos.raza),
    pelaje: vacio(datos.pelaje),
    sexo,
    numero_registro: vacio(datos.numeroRegistro),
    observaciones: vacio(datos.observaciones),
  }
}

async function leerPersonas(
  clubId: string,
  ids: string[],
): Promise<Map<string, PropietarioCaballo>> {
  const mapa = new Map<string, PropietarioCaballo>()
  if (ids.length === 0) return mapa

  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, apellido')
    .eq('club_id', clubId)
    .in('id', ids)

  if (error) throw new Error(mensajeErrorSupabase(error))

  for (const fila of (data ?? []) as { id: string; nombre: string | null; apellido: string | null }[]) {
    if (!fila.id || !fila.nombre) continue
    mapa.set(fila.id, { id: fila.id, nombre: fila.nombre, apellido: fila.apellido })
  }

  return mapa
}

async function leerBoxes(clubId: string, ids: string[]): Promise<Map<string, FilaBox>> {
  const mapa = new Map<string, FilaBox>()
  if (ids.length === 0) return mapa

  const { data, error } = await supabase
    .from('boxes')
    .select('id, numero, cuadra_id')
    .eq('club_id', clubId)
    .in('id', ids)

  if (error) throw new Error(mensajeErrorSupabase(error))

  for (const fila of (data ?? []) as { id: string; numero: string | null; cuadra_id: string | null }[]) {
    if (!fila.id || !fila.numero || !fila.cuadra_id) continue
    mapa.set(fila.id, { id: fila.id, numero: fila.numero, cuadraId: fila.cuadra_id })
  }

  return mapa
}

async function leerCuadras(clubId: string, ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa

  const { data, error } = await supabase
    .from('cuadras')
    .select('id, nombre')
    .eq('club_id', clubId)
    .in('id', ids)

  if (error) throw new Error(mensajeErrorSupabase(error))

  for (const fila of (data ?? []) as { id: string; nombre: string | null }[]) {
    if (!fila.id || !fila.nombre) continue
    mapa.set(fila.id, fila.nombre)
  }

  return mapa
}

async function firmarFotos(paths: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const unicos = [...new Set(paths)]
  if (unicos.length === 0) return mapa

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unicos, URL_SEGUNDOS)
  if (error || !data) return mapa

  for (const firma of data as Firma[]) {
    if (!firma.path || !firma.signedUrl || firma.error) continue
    mapa.set(firma.path, firma.signedUrl)
  }

  return mapa
}

async function complementar(clubId: string, filas: FilaCaballo[]): Promise<Caballo[]> {
  const personaIds = [...new Set(filas.flatMap((fila) => (fila.propietario_id ? [fila.propietario_id] : [])))]
  const boxIds = [...new Set(filas.flatMap((fila) => (fila.box_id ? [fila.box_id] : [])))]
  const [personas, boxes] = await Promise.all([
    leerPersonas(clubId, personaIds),
    leerBoxes(clubId, boxIds),
  ])
  const cuadraIds = [...new Set([...boxes.values()].map((box) => box.cuadraId))]
  const cuadras = await leerCuadras(clubId, cuadraIds)
  const fotos = await firmarFotos(filas.flatMap((fila) => (fila.foto_path ? [fila.foto_path] : [])))

  return filas.flatMap((fila) => {
    if (!fila.id || !fila.nombre || !esTipo(fila.tipo) || !esEstado(fila.estado)) return []
    const box = fila.box_id ? boxes.get(fila.box_id) : undefined
    const caballo: Caballo = {
      id: fila.id,
      nombre: fila.nombre,
      tipo: fila.tipo,
      estado: fila.estado,
      nacimiento: fila.nacimiento,
      raza: fila.raza,
      pelaje: fila.pelaje,
      sexo: esSexo(fila.sexo) ? fila.sexo : null,
      numeroRegistro: fila.numero_registro,
      observaciones: fila.observaciones,
      fotoPath: fila.foto_path,
      fotoUrl: fila.foto_path ? (fotos.get(fila.foto_path) ?? null) : null,
      propietarioId: fila.propietario_id,
      propietario: fila.propietario_id ? (personas.get(fila.propietario_id) ?? null) : null,
      ubicacion: box
        ? {
            boxId: box.id,
            numero: box.numero,
            cuadraId: box.cuadraId,
            cuadraNombre: cuadras.get(box.cuadraId) ?? 'Sin cuadra',
          }
        : null,
    }
    return [caballo]
  })
}

function ordenar(lista: Caballo[]) {
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return lista
}

async function asegurarRolPropietario(personaId: string) {
  const { data, error } = await supabase
    .from('roles_persona')
    .select('rol')
    .eq('persona_id', personaId)
    .eq('rol', 'propietario')

  if (error) throw new Error(mensajeErrorSupabase(error))
  if ((data ?? []).length > 0) return

  const { error: alta } = await supabase
    .from('roles_persona')
    .insert({ persona_id: personaId, rol: 'propietario' })

  if (alta) throw new Error(mensajeErrorSupabase(alta))
}

export async function obtenerCaballos(clubId: string): Promise<Caballo[]> {
  const { data, error } = await supabase
    .from('caballos')
    .select(COLUMNAS)
    .eq('club_id', clubId)

  if (error) throw new Error(mensajeErrorSupabase(error))
  return ordenar(await complementar(clubId, (data ?? []) as FilaCaballo[]))
}

export async function obtenerCaballo(clubId: string, caballoId: string): Promise<Caballo | null> {
  const { data, error } = await supabase
    .from('caballos')
    .select(COLUMNAS)
    .eq('club_id', clubId)
    .eq('id', caballoId)
    .maybeSingle()

  if (error) {
    if (error.code === '22P02') return null
    throw new Error(mensajeErrorSupabase(error))
  }
  if (!data) return null

  const lista = await complementar(clubId, [data as FilaCaballo])
  return lista[0] ?? null
}

export async function obtenerPersonasActivas(clubId: string): Promise<PersonaActiva[]> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, apellido')
    .eq('club_id', clubId)
    .eq('activa', true)

  if (error) throw new Error(mensajeErrorSupabase(error))

  const lista = ((data ?? []) as { id: string; nombre: string | null; apellido: string | null }[]).flatMap(
    (fila) => {
      if (!fila.id || !fila.nombre) return []
      const persona: PersonaActiva = { id: fila.id, nombre: fila.nombre, apellido: fila.apellido }
      return [persona]
    },
  )

  lista.sort((a, b) => {
    const apellido = (a.apellido ?? '').localeCompare(b.apellido ?? '', 'es')
    if (apellido !== 0) return apellido
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  return lista
}

export async function obtenerBoxesDisponibles(
  clubId: string,
  boxActualId: string | null,
): Promise<BoxDisponible[]> {
  const [cuadras, ocupacion] = await Promise.all([
    obtenerCuadras(clubId),
    supabase.from('caballos').select('box_id, estado').eq('club_id', clubId),
  ])

  if (ocupacion.error) throw new Error(mensajeErrorSupabase(ocupacion.error))

  const ocupados = new Set(
    ((ocupacion.data ?? []) as { box_id: string | null; estado: string | null }[]).flatMap((fila) =>
      fila.estado === 'activo' && fila.box_id ? [fila.box_id] : [],
    ),
  )

  const lista: BoxDisponible[] = []

  for (const cuadra of cuadras) {
    for (const box of cuadra.boxes) {
      const esActual = box.id === boxActualId
      const libre =
        cuadra.activa && box.estado === 'activo' && (!ocupados.has(box.id) || esActual)
      if (!esActual && !libre) continue
      lista.push({
        id: box.id,
        numero: box.numero,
        cuadraId: cuadra.id,
        cuadraNombre: cuadra.nombre,
      })
    }
  }

  lista.sort((a, b) => {
    const cuadra = a.cuadraNombre.localeCompare(b.cuadraNombre, 'es')
    if (cuadra !== 0) return cuadra
    return a.numero.localeCompare(b.numero, 'es', { numeric: true })
  })

  return lista
}

export async function subirFotoCaballo(
  clubId: string,
  caballoId: string,
  archivo: Blob,
): Promise<string> {
  const path = `${clubId}/${caballoId}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    upsert: true,
    contentType: 'image/jpeg',
  })

  if (error) throw new Error(mensajeErrorSupabase(error))
  return path
}

export async function urlFotoCaballo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_SEGUNDOS)
  if (error || !data?.signedUrl) throw new Error(mensajeErrorSupabase(error))
  return data.signedUrl
}

async function guardarFoto(clubId: string, caballoId: string, archivo: Blob) {
  const path = await subirFotoCaballo(clubId, caballoId, archivo)
  const { data, error } = await supabase
    .from('caballos')
    .update({ foto_path: path })
    .eq('id', caballoId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error)
}

export async function crearCaballo(
  clubId: string,
  datos: DatosCaballo,
  foto?: Blob,
): Promise<string> {
  const fila = normalizar(datos)
  const id = crypto.randomUUID()
  const fotoPath = foto ? await subirFotoCaballo(clubId, id, foto) : null

  const { data, error } = await supabase
    .from('caballos')
    .insert({ id, club_id: clubId, ...fila, foto_path: fotoPath })
    .select('id')

  exigirCambio(data as { id: string }[] | null, error)
  if (fila.propietario_id) await asegurarRolPropietario(fila.propietario_id)
  return id
}

export async function actualizarCaballo(
  clubId: string,
  caballoId: string,
  datos: DatosCaballo,
  foto?: Blob,
): Promise<void> {
  const fila = normalizar(datos)
  const { data, error } = await supabase
    .from('caballos')
    .update(fila)
    .eq('id', caballoId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error)
  if (fila.propietario_id) await asegurarRolPropietario(fila.propietario_id)
  if (foto) await guardarFoto(clubId, caballoId, foto)
}

export async function darDeBajaCaballo(clubId: string, caballoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('caballos')
    .update({ estado: 'baja', box_id: null })
    .eq('id', caballoId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error)
}

export async function reactivarCaballo(clubId: string, caballoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('caballos')
    .update({ estado: 'activo' })
    .eq('id', caballoId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error)
}
