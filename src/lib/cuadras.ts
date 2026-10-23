import { mensajeErrorSupabase } from './errores.ts'
import { supabase } from './supabase.ts'

export type EstadoBox = 'activo' | 'mantenimiento'

export type Box = {
  id: string
  numero: string
  estado: EstadoBox
}

export type Cuadra = {
  id: string
  nombre: string
  activa: boolean
  boxes: Box[]
}

type ErrorDato = {
  code?: string
  message?: string
  details?: string | null
}

type BoxCrudo = {
  id: string
  numero: string | null
  estado: string | null
}

type CuadraCruda = {
  id: string
  nombre: string | null
  activa: boolean | null
  boxes: BoxCrudo[] | BoxCrudo | null
}

const MENSAJE_CUADRA = 'Ya existe una cuadra con ese nombre'
const MENSAJE_BOX = 'Ya existe un box con ese número en esta cuadra'

function esEstado(valor: string | null): valor is EstadoBox {
  return valor === 'activo' || valor === 'mantenimiento'
}

function esDuplicado(error: ErrorDato): boolean {
  const texto = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return (
    error.code === '23505' ||
    texto.includes('duplicate key') ||
    texto.includes('unique constraint')
  )
}

function mensajeDeOperacion(error: ErrorDato | null, duplicado: string): string {
  if (error && esDuplicado(error)) return duplicado
  return mensajeErrorSupabase(error)
}

function filas<T>(valor: T[] | T | null): T[] {
  if (!valor) return []
  return Array.isArray(valor) ? valor : [valor]
}

function normalizarBoxes(valor: BoxCrudo[] | BoxCrudo | null): Box[] {
  const boxes = filas(valor).flatMap((fila) => {
    if (!fila.id || !fila.numero?.trim()) return []
    const box: Box = {
      id: fila.id,
      numero: fila.numero,
      estado: esEstado(fila.estado) ? fila.estado : 'activo',
    }
    return [box]
  })

  boxes.sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))
  return boxes
}

function exigirCambio(
  data: { id: string }[] | null,
  error: ErrorDato | null,
  duplicado: string,
) {
  if (error) throw new Error(mensajeDeOperacion(error, duplicado))
  if (!data || data.length === 0) throw new Error('No tenés permiso para hacer eso.')
}

export async function obtenerCuadras(clubId: string): Promise<Cuadra[]> {
  const { data, error } = await supabase
    .from('cuadras')
    .select('id, nombre, activa, boxes(id, numero, estado)')
    .eq('club_id', clubId)
    .order('nombre')

  if (error) throw new Error(mensajeErrorSupabase(error))

  const lista = ((data ?? []) as CuadraCruda[]).flatMap((fila) => {
    if (!fila.id || !fila.nombre) return []
    const cuadra: Cuadra = {
      id: fila.id,
      nombre: fila.nombre,
      activa: Boolean(fila.activa),
      boxes: normalizarBoxes(fila.boxes),
    }
    return [cuadra]
  })

  return lista
}

export async function crearCuadra(clubId: string, nombre: string): Promise<void> {
  const { data, error } = await supabase
    .from('cuadras')
    .insert({ club_id: clubId, nombre })
    .select('id')

  exigirCambio(data as { id: string }[] | null, error, MENSAJE_CUADRA)
}

export async function renombrarCuadra(
  clubId: string,
  cuadraId: string,
  nombre: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('cuadras')
    .update({ nombre })
    .eq('id', cuadraId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error, MENSAJE_CUADRA)
}

export async function cambiarActivaCuadra(
  clubId: string,
  cuadraId: string,
  activa: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('cuadras')
    .update({ activa })
    .eq('id', cuadraId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error, MENSAJE_CUADRA)
}

export async function crearBox(clubId: string, cuadraId: string, numero: string): Promise<void> {
  const { data, error } = await supabase
    .from('boxes')
    .insert({ club_id: clubId, cuadra_id: cuadraId, numero })
    .select('id')

  exigirCambio(data as { id: string }[] | null, error, MENSAJE_BOX)
}

export async function cambiarEstadoBox(
  clubId: string,
  boxId: string,
  estado: EstadoBox,
): Promise<void> {
  const { data, error } = await supabase
    .from('boxes')
    .update({ estado })
    .eq('id', boxId)
    .eq('club_id', clubId)
    .select('id')

  exigirCambio(data as { id: string }[] | null, error, MENSAJE_BOX)
}
