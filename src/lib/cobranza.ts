import { mensajeErrorSupabase } from './errores.ts'
import { supabase } from './supabase.ts'

export type CategoriaConcepto =
  | 'pension'
  | 'derecho_pista'
  | 'alimentacion'
  | 'herraje'
  | 'sanidad'
  | 'alquiler_pista'
  | 'clase'
  | 'otro'

export type TitularConcepto = 'club' | 'profesor'
export type EstadoPension = 'activa' | 'finalizada'

export type Concepto = {
  id: string
  nombre: string
  categoria: CategoriaConcepto
  montoSugerido: number
  titular: TitularConcepto
  activo: boolean
}

export type DatosConcepto = {
  nombre: string
  categoria: CategoriaConcepto
  montoSugerido: number
}

export type PensionLista = {
  id: string
  caballoId: string
  caballoNombre: string
  responsableId: string
  responsableNombre: string
  totalVigente: number
  diaVencimiento: number
  estado: EstadoPension
  inicio: string
  fin: string | null
  caballoDeBaja: boolean
}

export type ItemPension = {
  id: string
  conceptoId: string
  conceptoNombre: string
  monto: number
  vigenteDesde: string
  vigenteHasta: string | null
}

export type PensionDetalle = {
  id: string
  caballoId: string
  caballoNombre: string
  responsableId: string
  responsableNombre: string
  diaVencimiento: number
  inicio: string
  fin: string | null
  estado: EstadoPension
  caballoDeBaja: boolean
  items: ItemPension[]
}

export type PensionResumen = {
  id: string
  responsableId: string
  responsableNombre: string
  diaVencimiento: number
  inicio: string
  totalVigente: number
}

export type DatosPension = {
  caballoId: string
  responsableId: string
  diaVencimiento: number
  inicio: string
}

type ErrorDato = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

type FilaItem = {
  id?: string
  pension_id?: string
  concepto_id?: string
  monto: number | string | null
  vigente_desde: string | null
  vigente_hasta: string | null
}

const CATEGORIAS: CategoriaConcepto[] = [
  'pension',
  'derecho_pista',
  'alimentacion',
  'herraje',
  'sanidad',
  'alquiler_pista',
  'clase',
  'otro',
]

const MENSAJE_PENSION_ACTIVA = 'Este caballo ya tiene una pensión activa'
const MENSAJE_CONCEPTO = 'Ya existe un concepto con ese nombre'

export function fechaHoy(): string {
  return aIso(new Date())
}

export function diaAnterior(iso: string): string {
  return desplazarFecha(iso, -1)
}

export function pesos(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
}

export function etiquetaCategoria(categoria: CategoriaConcepto): string {
  const etiquetas: Record<CategoriaConcepto, string> = {
    pension: 'Pensión',
    derecho_pista: 'Derecho de pista',
    alimentacion: 'Alimentación',
    herraje: 'Herraje',
    sanidad: 'Sanidad',
    alquiler_pista: 'Alquiler de pista',
    clase: 'Clase',
    otro: 'Otro',
  }
  return etiquetas[categoria]
}

export function etiquetaTitular(titular: TitularConcepto): string {
  return titular === 'profesor' ? 'Profesor' : 'Club'
}

export function etiquetaEstadoPension(estado: EstadoPension): string {
  return estado === 'activa' ? 'Activa' : 'De baja'
}

function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function desplazarFecha(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  const fecha = new Date(anio || 1970, (mes || 1) - 1, dia || 1)
  fecha.setDate(fecha.getDate() + dias)
  return aIso(fecha)
}

function esCategoria(valor: string | null): valor is CategoriaConcepto {
  return CATEGORIAS.some((categoria) => categoria === valor)
}

function esTitular(valor: string | null): valor is TitularConcepto {
  return valor === 'club' || valor === 'profesor'
}

function esEstado(valor: string | null): valor is EstadoPension {
  return valor === 'activa' || valor === 'finalizada'
}

function comoNumero(valor: number | string | null): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim()) {
    const numero = Number(valor)
    if (Number.isFinite(numero)) return numero
  }
  return 0
}

function redondear(monto: number): number {
  return Math.round(monto * 100) / 100
}

function textoError(error: ErrorDato): string {
  return `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
}

function mensajeDe(error: ErrorDato | null, tipo: 'concepto' | 'pension' | 'item'): string {
  if (!error) return mensajeErrorSupabase(error)
  const texto = textoError(error)
  if (error.code === '23505') {
    if (tipo === 'concepto') return MENSAJE_CONCEPTO
    if (
      tipo === 'pension' &&
      (texto.includes('pensiones_una_activa_por_caballo') || texto.includes('caballo_id'))
    ) {
      return MENSAJE_PENSION_ACTIVA
    }
  }
  if (error.code === '23514' && texto.includes('monto')) return 'El monto no puede ser cero.'
  if (error.code === '23514' && texto.includes('dia_vencimiento')) {
    return 'El día de vencimiento tiene que estar entre 1 y 28.'
  }
  return mensajeErrorSupabase(error)
}

function exigirFilas(
  data: { id: string }[] | null,
  error: ErrorDato | null,
  tipo: 'concepto' | 'pension' | 'item',
) {
  if (error) throw new Error(mensajeDe(error, tipo))
  if (!data || data.length === 0) throw new Error('No tenés permiso para hacer eso.')
}

function nombrePersona(nombre: string, apellido: string | null): string {
  const resto = apellido?.trim()
  return resto ? `${nombre} ${resto}` : nombre
}

function vigenteEn(item: { vigenteDesde: string; vigenteHasta: string | null }, dia: string): boolean {
  return item.vigenteDesde <= dia && (item.vigenteHasta === null || item.vigenteHasta >= dia)
}

function montoItem(monto: number): number {
  if (!Number.isFinite(monto)) throw new Error('Ingresá un monto.')
  const redondo = redondear(monto)
  if (redondo === 0) throw new Error('El monto no puede ser cero.')
  return redondo
}

async function nombresCaballos(
  clubId: string,
  ids: string[],
): Promise<Map<string, { nombre: string; deBaja: boolean }>> {
  const mapa = new Map<string, { nombre: string; deBaja: boolean }>()
  if (ids.length === 0) return mapa
  const { data, error } = await supabase
    .from('caballos')
    .select('id, nombre, estado')
    .eq('club_id', clubId)
    .in('id', ids)
  if (error) throw new Error(mensajeErrorSupabase(error))
  for (const fila of (data ?? []) as { id: string; nombre: string | null; estado: string | null }[]) {
    if (fila.id && fila.nombre) mapa.set(fila.id, { nombre: fila.nombre, deBaja: fila.estado === 'baja' })
  }
  return mapa
}

async function nombresPersonas(clubId: string, ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa
  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, apellido')
    .eq('club_id', clubId)
    .in('id', ids)
  if (error) throw new Error(mensajeErrorSupabase(error))
  for (const fila of (data ?? []) as { id: string; nombre: string | null; apellido: string | null }[]) {
    if (fila.id && fila.nombre) mapa.set(fila.id, nombrePersona(fila.nombre, fila.apellido))
  }
  return mapa
}

async function nombresConceptos(clubId: string, ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa
  const { data, error } = await supabase
    .from('conceptos_cobro')
    .select('id, nombre')
    .eq('club_id', clubId)
    .in('id', ids)
  if (error) throw new Error(mensajeErrorSupabase(error))
  for (const fila of (data ?? []) as { id: string; nombre: string | null }[]) {
    if (fila.id && fila.nombre) mapa.set(fila.id, fila.nombre)
  }
  return mapa
}

async function itemsDe(clubId: string, pensionIds: string[]): Promise<Map<string, ItemPension[]>> {
  const mapa = new Map<string, ItemPension[]>()
  if (pensionIds.length === 0) return mapa
  const { data, error } = await supabase
    .from('pension_items')
    .select('id, pension_id, concepto_id, monto, vigente_desde, vigente_hasta')
    .eq('club_id', clubId)
    .in('pension_id', pensionIds)
  if (error) throw new Error(mensajeErrorSupabase(error))
  const filas = (data ?? []) as (FilaItem & { id: string; pension_id: string; concepto_id: string })[]
  const conceptos = await nombresConceptos(
    clubId,
    [...new Set(filas.map((fila) => fila.concepto_id).filter(Boolean))],
  )
  for (const fila of filas) {
    if (!fila.id || !fila.pension_id || !fila.concepto_id || !fila.vigente_desde) continue
    const item: ItemPension = {
      id: fila.id,
      conceptoId: fila.concepto_id,
      conceptoNombre: conceptos.get(fila.concepto_id) ?? 'Concepto',
      monto: comoNumero(fila.monto),
      vigenteDesde: fila.vigente_desde.slice(0, 10),
      vigenteHasta: fila.vigente_hasta ? fila.vigente_hasta.slice(0, 10) : null,
    }
    const lista = mapa.get(fila.pension_id) ?? []
    lista.push(item)
    mapa.set(fila.pension_id, lista)
  }
  return mapa
}

function totalHoy(items: ItemPension[], hoy: string): number {
  return redondear(
    items.filter((item) => vigenteEn(item, hoy)).reduce((suma, item) => suma + item.monto, 0),
  )
}

export async function obtenerConceptos(clubId: string): Promise<Concepto[]> {
  const { data, error } = await supabase
    .from('conceptos_cobro')
    .select('id, nombre, categoria, monto_sugerido, titular, activo')
    .eq('club_id', clubId)

  if (error) throw new Error(mensajeErrorSupabase(error))

  const lista = ((data ?? []) as {
    id: string
    nombre: string | null
    categoria: string | null
    monto_sugerido: number | string | null
    titular: string | null
    activo: boolean | null
  }[]).flatMap((fila) => {
    if (!fila.id || !fila.nombre || !esCategoria(fila.categoria) || !esTitular(fila.titular)) return []
    const concepto: Concepto = {
      id: fila.id,
      nombre: fila.nombre,
      categoria: fila.categoria,
      montoSugerido: comoNumero(fila.monto_sugerido),
      titular: fila.titular,
      activo: Boolean(fila.activo),
    }
    return [concepto]
  })

  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return lista
}

function datosConcepto(datos: DatosConcepto) {
  const nombre = datos.nombre.trim()
  if (!nombre) throw new Error('Ingresá el nombre.')
  if (!esCategoria(datos.categoria)) throw new Error('Elegí una categoría.')
  if (!Number.isFinite(datos.montoSugerido)) throw new Error('Ingresá el monto sugerido.')
  return {
    nombre,
    categoria: datos.categoria,
    monto_sugerido: redondear(datos.montoSugerido),
  }
}

export async function crearConcepto(clubId: string, datos: DatosConcepto): Promise<string> {
  const fila = datosConcepto(datos)
  const { data, error } = await supabase
    .from('conceptos_cobro')
    .insert({ club_id: clubId, ...fila })
    .select('id')
  const filas = data as { id: string }[] | null
  exigirFilas(filas, error, 'concepto')
  const id = filas?.[0]?.id
  if (!id) throw new Error('No se pudo crear el concepto.')
  return id
}

export async function actualizarConcepto(
  clubId: string,
  conceptoId: string,
  datos: DatosConcepto,
): Promise<void> {
  const { data, error } = await supabase
    .from('conceptos_cobro')
    .update(datosConcepto(datos))
    .eq('id', conceptoId)
    .eq('club_id', clubId)
    .select('id')
  exigirFilas(data as { id: string }[] | null, error, 'concepto')
}

export async function cambiarActivoConcepto(
  clubId: string,
  conceptoId: string,
  activo: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('conceptos_cobro')
    .update({ activo })
    .eq('id', conceptoId)
    .eq('club_id', clubId)
    .select('id')
  exigirFilas(data as { id: string }[] | null, error, 'concepto')
}

type FilaPension = {
  id: string
  caballo_id: string | null
  responsable_id: string | null
  dia_vencimiento: number | null
  inicio: string | null
  fin: string | null
  estado: string | null
}

async function armarPensiones(clubId: string, filas: FilaPension[]): Promise<PensionLista[]> {
  const hoy = fechaHoy()
  const caballoIds = [...new Set(filas.flatMap((fila) => (fila.caballo_id ? [fila.caballo_id] : [])))]
  const personaIds = [...new Set(filas.flatMap((fila) => (fila.responsable_id ? [fila.responsable_id] : [])))]
  const [caballos, personas, items] = await Promise.all([
    nombresCaballos(clubId, caballoIds),
    nombresPersonas(clubId, personaIds),
    itemsDe(clubId, filas.map((fila) => fila.id)),
  ])

  const lista = filas.flatMap((fila) => {
    if (!fila.id || !fila.caballo_id || !fila.responsable_id || !fila.inicio || !esEstado(fila.estado)) {
      return []
    }
    const caballo = caballos.get(fila.caballo_id)
    const pension: PensionLista = {
      id: fila.id,
      caballoId: fila.caballo_id,
      caballoNombre: caballo?.nombre ?? 'Caballo',
      caballoDeBaja: caballo?.deBaja ?? false,
      responsableId: fila.responsable_id,
      responsableNombre: personas.get(fila.responsable_id) ?? 'Responsable',
      totalVigente: totalHoy(items.get(fila.id) ?? [], hoy),
      diaVencimiento: fila.dia_vencimiento ?? 10,
      estado: fila.estado,
      inicio: fila.inicio.slice(0, 10),
      fin: fila.fin ? fila.fin.slice(0, 10) : null,
    }
    return [pension]
  })

  lista.sort((a, b) => a.caballoNombre.localeCompare(b.caballoNombre, 'es'))
  return lista
}

export async function obtenerPensionesDeResponsable(
  clubId: string,
  personaId: string,
): Promise<PensionLista[]> {
  const { data, error } = await supabase
    .from('pensiones')
    .select('id, caballo_id, responsable_id, dia_vencimiento, inicio, fin, estado')
    .eq('club_id', clubId)
    .eq('responsable_id', personaId)

  if (error) throw new Error(mensajeErrorSupabase(error))
  return armarPensiones(clubId, (data ?? []) as FilaPension[])
}

export type CargoEmitido = {
  id: string
  periodo: string
  vencimiento: string
  total: number
}

export async function obtenerCargosDePersona(
  clubId: string,
  personaId: string,
): Promise<CargoEmitido[]> {
  const { data, error } = await supabase
    .from('cargos')
    .select('id, periodo, vencimiento, total')
    .eq('club_id', clubId)
    .eq('persona_id', personaId)
    .neq('estado', 'anulado')
    .order('periodo', { ascending: false })
    .order('vencimiento', { ascending: false })

  if (error) throw new Error(mensajeErrorSupabase(error))

  return ((data ?? []) as {
    id: string
    periodo: string | null
    vencimiento: string | null
    total: number | string | null
  }[]).flatMap((fila) => {
    if (!fila.id || !fila.periodo || !fila.vencimiento) return []
    const cargo: CargoEmitido = {
      id: fila.id,
      periodo: fila.periodo.slice(0, 10),
      vencimiento: fila.vencimiento.slice(0, 10),
      total: comoNumero(fila.total),
    }
    return [cargo]
  })
}

export async function obtenerPensiones(clubId: string): Promise<PensionLista[]> {
  const { data, error } = await supabase
    .from('pensiones')
    .select('id, caballo_id, responsable_id, dia_vencimiento, inicio, fin, estado')
    .eq('club_id', clubId)

  if (error) throw new Error(mensajeErrorSupabase(error))
  return armarPensiones(clubId, (data ?? []) as FilaPension[])
}

export async function obtenerPension(clubId: string, pensionId: string): Promise<PensionDetalle | null> {
  const { data, error } = await supabase
    .from('pensiones')
    .select('id, caballo_id, responsable_id, dia_vencimiento, inicio, fin, estado')
    .eq('club_id', clubId)
    .eq('id', pensionId)
    .maybeSingle()

  if (error) {
    if (error.code === '22P02') return null
    throw new Error(mensajeErrorSupabase(error))
  }
  if (!data) return null

  const fila = data as FilaPension
  const [armada] = await armarPensiones(clubId, [fila])
  if (!armada) return null
  const items = (await itemsDe(clubId, [fila.id])).get(fila.id) ?? []
  items.sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde) || a.conceptoNombre.localeCompare(b.conceptoNombre, 'es'))

  return {
    id: armada.id,
    caballoId: armada.caballoId,
    caballoNombre: armada.caballoNombre,
    responsableId: armada.responsableId,
    responsableNombre: armada.responsableNombre,
    diaVencimiento: armada.diaVencimiento,
    inicio: armada.inicio,
    fin: armada.fin,
    estado: armada.estado,
    caballoDeBaja: armada.caballoDeBaja,
    items,
  }
}

export async function obtenerPensionActivaDeCaballo(
  clubId: string,
  caballoId: string,
): Promise<PensionResumen | null> {
  const { data, error } = await supabase
    .from('pensiones')
    .select('id, caballo_id, responsable_id, dia_vencimiento, inicio, fin, estado')
    .eq('club_id', clubId)
    .eq('caballo_id', caballoId)
    .eq('estado', 'activa')
    .maybeSingle()

  if (error) throw new Error(mensajeErrorSupabase(error))
  if (!data) return null
  const [pension] = await armarPensiones(clubId, [data as FilaPension])
  if (!pension) return null
  return {
    id: pension.id,
    responsableId: pension.responsableId,
    responsableNombre: pension.responsableNombre,
    diaVencimiento: pension.diaVencimiento,
    inicio: pension.inicio,
    totalVigente: pension.totalVigente,
  }
}

export async function crearPension(clubId: string, datos: DatosPension): Promise<string> {
  if (!datos.caballoId) throw new Error('Elegí el caballo.')
  if (!datos.responsableId) throw new Error('Elegí el responsable.')
  if (!Number.isInteger(datos.diaVencimiento) || datos.diaVencimiento < 1 || datos.diaVencimiento > 28) {
    throw new Error('El día de vencimiento tiene que estar entre 1 y 28.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.inicio)) throw new Error('Ingresá la fecha de inicio.')

  const { data, error } = await supabase
    .from('pensiones')
    .insert({
      club_id: clubId,
      caballo_id: datos.caballoId,
      responsable_id: datos.responsableId,
      dia_vencimiento: datos.diaVencimiento,
      inicio: datos.inicio,
    })
    .select('id')

  const filas = data as { id: string }[] | null
  exigirFilas(filas, error, 'pension')
  const id = filas?.[0]?.id
  if (!id) throw new Error('No se pudo crear la pensión.')
  return id
}

export async function finalizarPension(
  clubId: string,
  pensionId: string,
  fin: string,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fin)) throw new Error('Ingresá la fecha de baja.')

  const { data: actual, error: errorLectura } = await supabase
    .from('pensiones')
    .select('inicio')
    .eq('id', pensionId)
    .eq('club_id', clubId)
    .eq('estado', 'activa')
    .maybeSingle()

  if (errorLectura) throw new Error(mensajeErrorSupabase(errorLectura))
  const inicio = (actual as { inicio: string | null } | null)?.inicio?.slice(0, 10)
  if (!inicio) throw new Error('No se encontró la pensión.')
  if (fin < inicio) throw new Error('La fecha de baja no puede ser anterior al inicio.')

  const { data, error } = await supabase
    .from('pensiones')
    .update({ estado: 'finalizada', fin })
    .eq('id', pensionId)
    .eq('club_id', clubId)
    .eq('estado', 'activa')
    .select('id')

  exigirFilas(data as { id: string }[] | null, error, 'pension')
}

export type ItemAltaPension = {
  conceptoId: string
  monto: number
}

export async function crearPensionConItems(
  clubId: string,
  datos: DatosPension,
  items: ItemAltaPension[],
): Promise<string> {
  const preparados = items.map((item) => {
    if (!item.conceptoId) throw new Error('Elegí un concepto.')
    return {
      concepto_id: item.conceptoId,
      monto: montoItem(item.monto),
      vigente_desde: datos.inicio,
    }
  })

  const id = await crearPension(clubId, datos)
  if (preparados.length === 0) return id

  const alta = await supabase
    .from('pension_items')
    .insert(
      preparados.map((item) => ({
        club_id: clubId,
        pension_id: id,
        ...item,
      })),
    )
    .select('id')

  if (alta.error || !alta.data || (alta.data as { id: string }[]).length !== preparados.length) {
    const borrado = await supabase
      .from('pensiones')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
      .select('id')
    const mensaje = alta.error
      ? mensajeDe(alta.error, 'item')
      : 'No se pudieron guardar los ítems.'
    if (borrado.error || !borrado.data || (borrado.data as { id: string }[]).length === 0) {
      throw new Error(`${mensaje} La pensión quedó creada y hay que revisarla.`)
    }
    throw new Error(mensaje)
  }

  return id
}

export async function agregarItemPension(
  clubId: string,
  pensionId: string,
  conceptoId: string,
  monto: number,
  vigenteDesde: string,
): Promise<void> {
  if (!conceptoId) throw new Error('Elegí un concepto.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) throw new Error('Ingresá desde cuándo rige el ítem.')
  const { data, error } = await supabase
    .from('pension_items')
    .insert({
      club_id: clubId,
      pension_id: pensionId,
      concepto_id: conceptoId,
      monto: montoItem(monto),
      vigente_desde: vigenteDesde,
    })
    .select('id')

  exigirFilas(data as { id: string }[] | null, error, 'item')
}

async function leerItem(clubId: string, itemId: string): Promise<ItemPension & { pensionId: string }> {
  const { data, error } = await supabase
    .from('pension_items')
    .select('id, pension_id, concepto_id, monto, vigente_desde, vigente_hasta')
    .eq('club_id', clubId)
    .eq('id', itemId)
    .maybeSingle()

  if (error) throw new Error(mensajeErrorSupabase(error))
  const fila = data as (FilaItem & { id: string; pension_id: string; concepto_id: string }) | null
  if (!fila?.id || !fila.pension_id || !fila.concepto_id || !fila.vigente_desde) {
    throw new Error('No se encontró el ítem.')
  }
  return {
    id: fila.id,
    pensionId: fila.pension_id,
    conceptoId: fila.concepto_id,
    conceptoNombre: '',
    monto: comoNumero(fila.monto),
    vigenteDesde: fila.vigente_desde.slice(0, 10),
    vigenteHasta: fila.vigente_hasta ? fila.vigente_hasta.slice(0, 10) : null,
  }
}

export async function cambiarMontoItem(
  clubId: string,
  itemId: string,
  monto: number,
  desde: string,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Error('Ingresá desde cuándo rige el monto.')
  const nuevo = montoItem(monto)
  const item = await leerItem(clubId, itemId)
  if (item.vigenteHasta && item.vigenteHasta < fechaHoy()) {
    throw new Error('Ese ítem ya está cerrado.')
  }
  if (desde < item.vigenteDesde) {
    throw new Error('La fecha tiene que ser igual o posterior al inicio del ítem.')
  }
  if (desde === item.vigenteDesde) {
    const { data, error } = await supabase
      .from('pension_items')
      .update({ monto: nuevo })
      .eq('id', itemId)
      .eq('club_id', clubId)
      .select('id')
    exigirFilas(data as { id: string }[] | null, error, 'item')
    return
  }

  const hasta = diaAnterior(desde)
  const { data, error } = await supabase
    .from('pension_items')
    .update({ vigente_hasta: hasta })
    .eq('id', itemId)
    .eq('club_id', clubId)
    .select('id')
  exigirFilas(data as { id: string }[] | null, error, 'item')

  const alta = await supabase
    .from('pension_items')
    .insert({
      club_id: clubId,
      pension_id: item.pensionId,
      concepto_id: item.conceptoId,
      monto: nuevo,
      vigente_desde: desde,
    })
    .select('id')

  if (alta.error || !alta.data || (alta.data as { id: string }[]).length === 0) {
    await supabase
      .from('pension_items')
      .update({ vigente_hasta: item.vigenteHasta })
      .eq('id', itemId)
      .eq('club_id', clubId)
    if (alta.error) throw new Error(mensajeDe(alta.error, 'item'))
    throw new Error('No se pudo crear el ítem con el monto nuevo.')
  }
}

export async function quitarItem(clubId: string, itemId: string): Promise<void> {
  const item = await leerItem(clubId, itemId)
  const hoy = fechaHoy()
  if (item.vigenteDesde >= hoy) {
    const { data, error } = await supabase
      .from('pension_items')
      .delete()
      .eq('id', itemId)
      .eq('club_id', clubId)
      .select('id')
    exigirFilas(data as { id: string }[] | null, error, 'item')
    return
  }

  const { data, error } = await supabase
    .from('pension_items')
    .update({ vigente_hasta: diaAnterior(hoy) })
    .eq('id', itemId)
    .eq('club_id', clubId)
    .select('id')
  exigirFilas(data as { id: string }[] | null, error, 'item')
}
