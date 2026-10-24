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
const MENSAJE_BOXES_PARCIAL =
  'La cuadra se creó, pero no se pudieron crear los boxes. Agregalos desde Editar'

export function numerosDeBoxes(existentes: string[], cantidad: number, prefijo: string): string[] {
  if (cantidad <= 0) return []
  const prefijoLimpio = prefijo.trim()
  const usados = new Set(existentes)
  let siguiente = mayorConPrefijo(existentes, prefijoLimpio) + 1
  const limite = siguiente + cantidad + existentes.length
  const numeros: string[] = []

  while (numeros.length < cantidad) {
    if (siguiente > limite) {
      throw new Error('No se pudieron calcular números libres para los boxes.')
    }
    const numero = `${prefijoLimpio}${siguiente}`
    if (!usados.has(numero)) {
      numeros.push(numero)
      usados.add(numero)
    }
    siguiente += 1
  }

  return numeros
}

export function textoVistaPrevia(numeros: string[], prefijo: string): string {
  if (numeros.length === 0) return ''
  if (numeros.length === 1) return `Se creará el box ${numeros[0]}`
  if (sonConsecutivos(numeros, prefijo.trim())) {
    return `Se crearán los boxes ${numeros[0]} a ${numeros[numeros.length - 1]}`
  }
  return `Se crearán los boxes ${enumerar(numeros)}`
}

function mayorConPrefijo(numeros: string[], prefijo: string): number {
  let mayor = 0
  for (const numero of numeros) {
    const valor = sufijo(numero, prefijo)
    if (valor !== null && valor > mayor) mayor = valor
  }
  return mayor
}

function sufijo(numero: string, prefijo: string): number | null {
  if (!numero.startsWith(prefijo)) return null
  const resto = numero.slice(prefijo.length)
  if (!/^\d+$/.test(resto)) return null
  const valor = Number(resto)
  if (!Number.isSafeInteger(valor)) return null
  return valor
}

function sonConsecutivos(numeros: string[], prefijo: string): boolean {
  const primero = sufijo(numeros[0] ?? '', prefijo)
  if (primero === null) return false
  return numeros.every((numero, indice) => sufijo(numero, prefijo) === primero + indice)
}

function enumerar(numeros: string[]): string {
  if (numeros.length <= 1) return numeros[0] ?? ''
  if (numeros.length === 2) return `${numeros[0]} y ${numeros[1]}`
  return `${numeros.slice(0, -1).join(', ')} y ${numeros[numeros.length - 1]}`
}

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

export async function crearCuadra(clubId: string, nombre: string): Promise<string> {
  const { data, error } = await supabase
    .from('cuadras')
    .insert({ club_id: clubId, nombre })
    .select('id')

  const filas = data as { id: string }[] | null
  exigirCambio(filas, error, MENSAJE_CUADRA)
  const id = filas?.[0]?.id
  if (!id) throw new Error('No se pudo crear la cuadra.')
  return id
}

export async function crearCuadraConBoxes(
  clubId: string,
  nombre: string,
  cantidad: number,
  prefijo: string,
): Promise<string | null> {
  if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > 100) {
    throw new Error('La cantidad tiene que ser un entero de 0 a 100.')
  }

  const cuadraId = await crearCuadra(clubId, nombre)
  if (cantidad === 0) return null

  try {
    await agregarBoxes(clubId, cuadraId, [], cantidad, prefijo)
    return null
  } catch {
    return MENSAJE_BOXES_PARCIAL
  }
}

export async function agregarBoxes(
  clubId: string,
  cuadraId: string,
  existentes: string[],
  cantidad: number,
  prefijo: string,
): Promise<void> {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
    throw new Error('La cantidad tiene que ser un entero de 1 a 100.')
  }

  await crearBoxes(clubId, cuadraId, numerosDeBoxes(existentes, cantidad, prefijo))
}

async function crearBoxes(clubId: string, cuadraId: string, numeros: string[]): Promise<void> {
  if (numeros.length === 0) return

  const { data, error } = await supabase
    .from('boxes')
    .insert(numeros.map((numero) => ({ club_id: clubId, cuadra_id: cuadraId, numero })))
    .select('id')

  const filas = data as { id: string }[] | null
  if (error) throw new Error(mensajeDeOperacion(error, MENSAJE_BOX))
  if (!filas || filas.length !== numeros.length) {
    throw new Error('No tenés permiso para hacer eso.')
  }
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
