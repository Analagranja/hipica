import { mensajeErrorSupabase } from './errores.ts'
import { supabase } from './supabase.ts'
import { aCentavos, desdeCentavos } from '../pages/texto-monto.ts'

export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'
export type EstadoPago = 'confirmado' | 'anulado'
export type EstadoCobro = 'pagado' | 'parcial' | 'vencido' | 'pendiente' | 'anulado'
export type EstadoCargo = 'emitido' | 'anulado'

export type PagoLista = {
  id: string
  personaId: string
  personaNombre: string
  monto: number
  fecha: string
  medio: MedioPago
  estado: EstadoPago
  numeroRecibo: number
  sinAplicar: number
}

export type ImputacionDetalle = {
  cargoId: string
  monto: number
  periodo: string
  descripcion: string
}

export type PagoDetalle = {
  id: string
  personaId: string
  nombre: string
  personaNombre: string
  telefono: string | null
  email: string | null
  monto: number
  fecha: string
  medio: MedioPago
  referencia: string | null
  observaciones: string | null
  numeroRecibo: number
  estado: EstadoPago
  motivoAnulacion: string | null
  anuladoAt: string | null
  aplicado: number
  sinAplicar: number
  imputaciones: ImputacionDetalle[]
}

export type CargoSaldo = {
  id: string
  personaId: string
  personaNombre: string
  periodo: string
  vencimiento: string
  descripcion: string | null
  total: number
  pagado: number
  saldo: number
  estado: EstadoCargo
  estadoCobro: EstadoCobro
}

export type SaldosPersona = {
  deuda: number
  deudaVencida: number
  saldoAFavor: number
}

export type ImputacionAlta = {
  cargoId: string
  centavos: number
}

type ErrorDato = {
  code?: string
  message?: string
  details?: string | null
}

const MEDIOS: MedioPago[] = ['efectivo', 'transferencia', 'tarjeta', 'otro']
const ESTADOS_PAGO: EstadoPago[] = ['confirmado', 'anulado']
const ESTADOS_COBRO: EstadoCobro[] = ['pagado', 'parcial', 'vencido', 'pendiente', 'anulado']

export function etiquetaMedio(medio: MedioPago): string {
  const etiquetas: Record<MedioPago, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    otro: 'Otro',
  }
  return etiquetas[medio]
}

export function etiquetaEstadoPago(estado: EstadoPago): string {
  return estado === 'anulado' ? 'Anulado' : 'Confirmado'
}

export function etiquetaEstadoCobro(estado: EstadoCobro): string {
  const etiquetas: Record<EstadoCobro, string> = {
    pagado: 'Pagado',
    parcial: 'Parcial',
    vencido: 'Vencido',
    pendiente: 'Pendiente',
    anulado: 'Anulado',
  }
  return etiquetas[estado]
}

export function textoRecibo(numero: number): string {
  return String(numero).padStart(4, '0')
}

export function repartirMonto(
  montoCentavos: number,
  cargos: { id: string; saldoCentavos: number; vencimiento: string }[],
): Map<string, number> {
  const ordenados = [...cargos].sort(
    (a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.id.localeCompare(b.id),
  )
  const reparto = new Map<string, number>()
  let resto = Math.max(0, Math.round(montoCentavos))
  for (const cargo of ordenados) {
    if (resto <= 0) break
    const aplicar = Math.min(resto, Math.max(0, cargo.saldoCentavos))
    if (aplicar > 0) {
      reparto.set(cargo.id, aplicar)
      resto -= aplicar
    }
  }
  return reparto
}

export function validarReparto(
  montoCentavos: number,
  filas: { saldoCentavos: number; aplicarCentavos: number }[],
): string | null {
  if (montoCentavos <= 0) return 'El monto debe ser mayor a cero.'
  let suma = 0
  for (const fila of filas) {
    if (fila.aplicarCentavos < 0) return 'Cada importe a aplicar debe ser mayor a cero.'
    if (fila.aplicarCentavos > fila.saldoCentavos) return 'El importe supera el saldo del cargo.'
    suma += fila.aplicarCentavos
  }
  if (suma > montoCentavos) return 'Lo aplicado supera el monto del pago.'
  return null
}

function mensajeTalCual(error: ErrorDato | null): string {
  const texto = (error?.message ?? error?.details ?? '').trim()
  return texto || 'No se pudo completar la acción.'
}

function comoNumero(valor: number | string | null): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return desdeCentavos(aCentavos(valor))
  if (typeof valor === 'string' && valor.trim()) {
    const numero = Number(valor)
    if (Number.isFinite(numero)) return desdeCentavos(aCentavos(numero))
  }
  return 0
}

function esMedio(valor: string | null): valor is MedioPago {
  return MEDIOS.some((medio) => medio === valor)
}

function esEstadoPago(valor: string | null): valor is EstadoPago {
  return ESTADOS_PAGO.some((estado) => estado === valor)
}

function esEstadoCobro(valor: string | null): valor is EstadoCobro {
  return ESTADOS_COBRO.some((estado) => estado === valor)
}

function esEstadoCargo(valor: string | null): valor is EstadoCargo {
  return valor === 'emitido' || valor === 'anulado'
}

function nombrePersona(nombre: string, apellido: string | null): string {
  const resto = apellido?.trim()
  return resto ? `${nombre} ${resto}` : nombre
}

function fechaCorta(valor: string | null): string {
  return valor ? valor.slice(0, 10) : ''
}

type FilaPersona = {
  id: string
  nombre: string | null
  apellido: string | null
  telefono?: string | null
  email?: string | null
}

async function leerPersonas(
  clubId: string,
  ids: string[],
  conContacto: boolean,
): Promise<Map<string, FilaPersona>> {
  const mapa = new Map<string, FilaPersona>()
  if (ids.length === 0) return mapa
  const consulta = conContacto
    ? await supabase
        .from('personas')
        .select('id, nombre, apellido, telefono, email')
        .eq('club_id', clubId)
        .in('id', ids)
    : await supabase
        .from('personas')
        .select('id, nombre, apellido')
        .eq('club_id', clubId)
        .in('id', ids)
  if (consulta.error) throw new Error(mensajeErrorSupabase(consulta.error))
  for (const fila of (consulta.data ?? []) as FilaPersona[]) {
    if (fila.id && fila.nombre) mapa.set(fila.id, fila)
  }
  return mapa
}

type FilaPago = {
  id: string
  persona_id: string | null
  monto: number | string | null
  fecha: string | null
  medio: string | null
  referencia: string | null
  observaciones: string | null
  numero_recibo: number | null
  estado: string | null
  motivo_anulacion: string | null
  anulado_at: string | null
  aplicado: number | string | null
  sin_aplicar: number | string | null
}

function aLista(fila: FilaPago, personas: Map<string, FilaPersona>): PagoLista | null {
  if (!fila.id || !fila.persona_id || !fila.fecha || !esMedio(fila.medio) || !esEstadoPago(fila.estado)) {
    return null
  }
  if (fila.numero_recibo == null) return null
  const persona = personas.get(fila.persona_id)
  return {
    id: fila.id,
    personaId: fila.persona_id,
    personaNombre: persona?.nombre ? nombrePersona(persona.nombre, persona.apellido ?? null) : 'Persona',
    monto: comoNumero(fila.monto),
    fecha: fechaCorta(fila.fecha),
    medio: fila.medio,
    estado: fila.estado,
    numeroRecibo: fila.numero_recibo,
    sinAplicar: comoNumero(fila.sin_aplicar),
  }
}

export async function obtenerPagos(clubId: string, personaId?: string): Promise<PagoLista[]> {
  let consulta = supabase
    .from('pagos_con_aplicado')
    .select('id, persona_id, monto, fecha, medio, numero_recibo, estado, aplicado, sin_aplicar')
    .eq('club_id', clubId)
  if (personaId) consulta = consulta.eq('persona_id', personaId)
  const { data, error } = await consulta

  if (error) throw new Error(mensajeErrorSupabase(error))
  const filas = (data ?? []) as FilaPago[]
  const personas = await leerPersonas(
    clubId,
    [...new Set(filas.flatMap((fila) => (fila.persona_id ? [fila.persona_id] : [])))],
    false,
  )
  const lista = filas.flatMap((fila) => {
    const pago = aLista(fila, personas)
    return pago ? [pago] : []
  })
  lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numeroRecibo - a.numeroRecibo)
  return lista
}

export async function obtenerPago(clubId: string, pagoId: string): Promise<PagoDetalle | null> {
  const { data, error } = await supabase
    .from('pagos_con_aplicado')
    .select(
      'id, persona_id, monto, fecha, medio, referencia, observaciones, numero_recibo, estado, motivo_anulacion, anulado_at, aplicado, sin_aplicar',
    )
    .eq('club_id', clubId)
    .eq('id', pagoId)
    .maybeSingle()

  if (error) {
    if (error.code === '22P02') return null
    throw new Error(mensajeErrorSupabase(error))
  }
  if (!data) return null
  const fila = data as FilaPago
  const lista = aLista(fila, new Map())
  if (!lista || !fila.persona_id) return null

  const [personas, imputaciones] = await Promise.all([
    leerPersonas(clubId, [fila.persona_id], true),
    leerImputaciones(clubId, fila.id),
  ])
  const persona = personas.get(fila.persona_id)

  return {
    ...lista,
    nombre: persona?.nombre ?? lista.personaNombre,
    personaNombre: persona?.nombre ? nombrePersona(persona.nombre, persona.apellido ?? null) : lista.personaNombre,
    telefono: persona?.telefono ?? null,
    email: persona?.email ?? null,
    referencia: fila.referencia,
    observaciones: fila.observaciones,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoAt: fila.anulado_at,
    aplicado: comoNumero(fila.aplicado),
    imputaciones,
  }
}

async function leerImputaciones(clubId: string, pagoId: string): Promise<ImputacionDetalle[]> {
  const { data, error } = await supabase
    .from('imputaciones')
    .select('cargo_id, monto')
    .eq('club_id', clubId)
    .eq('pago_id', pagoId)
  if (error) throw new Error(mensajeErrorSupabase(error))
  const filas = (data ?? []) as { cargo_id: string | null; monto: number | string | null }[]
  const cargoIds = [...new Set(filas.flatMap((fila) => (fila.cargo_id ? [fila.cargo_id] : [])))]
  const cargos = new Map<string, { periodo: string; descripcion: string }>()
  if (cargoIds.length > 0) {
    const consulta = await supabase
      .from('cargos')
      .select('id, periodo, descripcion')
      .eq('club_id', clubId)
      .in('id', cargoIds)
    if (consulta.error) throw new Error(mensajeErrorSupabase(consulta.error))
    for (const cargo of (consulta.data ?? []) as {
      id: string
      periodo: string | null
      descripcion: string | null
    }[]) {
      if (!cargo.id) continue
      cargos.set(cargo.id, {
        periodo: fechaCorta(cargo.periodo),
        descripcion: cargo.descripcion?.trim() || 'Cargo',
      })
    }
  }
  return filas.flatMap((fila) => {
    if (!fila.cargo_id) return []
    const cargo = cargos.get(fila.cargo_id)
    const item: ImputacionDetalle = {
      cargoId: fila.cargo_id,
      monto: comoNumero(fila.monto),
      periodo: cargo?.periodo ?? '',
      descripcion: cargo?.descripcion ?? 'Cargo',
    }
    return [item]
  })
}

type FilaCargo = {
  id: string
  persona_id: string | null
  periodo: string | null
  vencimiento: string | null
  descripcion: string | null
  total: number | string | null
  pagado: number | string | null
  saldo: number | string | null
  estado: string | null
  estado_cobro: string | null
}

function aCargo(fila: FilaCargo, personas: Map<string, FilaPersona>): CargoSaldo | null {
  if (!fila.id || !fila.persona_id || !fila.periodo || !fila.vencimiento) return null
  if (!esEstadoCargo(fila.estado) || !esEstadoCobro(fila.estado_cobro)) return null
  const persona = personas.get(fila.persona_id)
  return {
    id: fila.id,
    personaId: fila.persona_id,
    personaNombre: persona?.nombre ? nombrePersona(persona.nombre, persona.apellido ?? null) : 'Persona',
    periodo: fechaCorta(fila.periodo),
    vencimiento: fechaCorta(fila.vencimiento),
    descripcion: fila.descripcion?.trim() || null,
    total: comoNumero(fila.total),
    pagado: comoNumero(fila.pagado),
    saldo: comoNumero(fila.saldo),
    estado: fila.estado,
    estadoCobro: fila.estado_cobro,
  }
}

async function consultarCargos(
  clubId: string,
  filtro: { personaId?: string; periodo?: string },
): Promise<CargoSaldo[]> {
  let consulta = supabase
    .from('cargos_con_saldo')
    .select('id, persona_id, periodo, vencimiento, descripcion, total, pagado, saldo, estado, estado_cobro')
    .eq('club_id', clubId)
  if (filtro.personaId) consulta = consulta.eq('persona_id', filtro.personaId)
  if (filtro.periodo) consulta = consulta.eq('periodo', filtro.periodo)
  const { data, error } = await consulta
  if (error) throw new Error(mensajeErrorSupabase(error))
  const filas = (data ?? []) as FilaCargo[]
  const personas = await leerPersonas(
    clubId,
    [...new Set(filas.flatMap((fila) => (fila.persona_id ? [fila.persona_id] : [])))],
    false,
  )
  return filas.flatMap((fila) => {
    const cargo = aCargo(fila, personas)
    return cargo ? [cargo] : []
  })
}

export async function obtenerCargosAbiertos(clubId: string, personaId: string): Promise<CargoSaldo[]> {
  const lista = await consultarCargos(clubId, { personaId })
  return lista
    .filter((cargo) => cargo.estado !== 'anulado' && aCentavos(cargo.saldo) > 0)
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.periodo.localeCompare(b.periodo))
}

export async function obtenerCargosDePersonaConSaldo(
  clubId: string,
  personaId: string,
): Promise<CargoSaldo[]> {
  const lista = await consultarCargos(clubId, { personaId })
  lista.sort((a, b) => b.periodo.localeCompare(a.periodo) || b.vencimiento.localeCompare(a.vencimiento))
  return lista
}

export async function obtenerCargosDelMes(clubId: string, periodo: string): Promise<CargoSaldo[]> {
  const lista = await consultarCargos(clubId, { periodo })
  lista.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.personaNombre.localeCompare(b.personaNombre, 'es'))
  return lista
}

export async function obtenerSaldosPersona(clubId: string, personaId: string): Promise<SaldosPersona> {
  const { data, error } = await supabase
    .from('saldos_persona')
    .select('deuda, deuda_vencida, saldo_a_favor')
    .eq('club_id', clubId)
    .eq('persona_id', personaId)
    .maybeSingle()
  if (error) throw new Error(mensajeErrorSupabase(error))
  const fila = data as {
    deuda: number | string | null
    deuda_vencida: number | string | null
    saldo_a_favor: number | string | null
  } | null
  return {
    deuda: comoNumero(fila?.deuda ?? 0),
    deudaVencida: comoNumero(fila?.deuda_vencida ?? 0),
    saldoAFavor: comoNumero(fila?.saldo_a_favor ?? 0),
  }
}

function montoRpc(centavos: number): string {
  const absoluto = Math.abs(Math.round(centavos))
  const entero = Math.floor(absoluto / 100)
  const fraccion = String(absoluto % 100).padStart(2, '0')
  return `${centavos < 0 ? '-' : ''}${entero}.${fraccion}`
}

function imputacionesRpc(items: ImputacionAlta[]) {
  return items
    .filter((item) => item.centavos > 0)
    .map((item) => ({
      cargo_id: item.cargoId,
      monto: montoRpc(item.centavos),
    }))
}

export async function registrarPago(
  clubId: string,
  personaId: string,
  montoCentavos: number,
  fecha: string,
  medio: MedioPago,
  referencia: string,
  observaciones: string,
  imputaciones: ImputacionAlta[],
): Promise<{ id: string; numeroRecibo: number }> {
  if (montoCentavos <= 0) throw new Error('El monto debe ser mayor a cero.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Ingresá la fecha.')
  const { data, error } = await supabase.rpc('registrar_pago', {
    p_club: clubId,
    p_persona: personaId,
    p_monto: montoRpc(montoCentavos),
    p_fecha: fecha,
    p_medio: medio,
    p_referencia: referencia.trim() || null,
    p_observaciones: observaciones.trim() || null,
    p_imputaciones: imputacionesRpc(imputaciones),
  })
  if (error) throw new Error(mensajeTalCual(error))
  const id = typeof data === 'string' ? data : null
  if (!id) throw new Error('No se pudo registrar el pago.')

  const recibo = await supabase
    .from('pagos')
    .select('numero_recibo')
    .eq('club_id', clubId)
    .eq('id', id)
    .maybeSingle()
  if (recibo.error) throw new Error(mensajeErrorSupabase(recibo.error))
  const numero = (recibo.data as { numero_recibo: number | null } | null)?.numero_recibo
  if (numero == null) throw new Error('No se pudo leer el número de recibo.')
  return { id, numeroRecibo: numero }
}

export async function imputarPago(pagoId: string, imputaciones: ImputacionAlta[]): Promise<void> {
  const items = imputacionesRpc(imputaciones)
  if (items.length === 0) throw new Error('Cada importe a aplicar debe ser mayor a cero.')
  const { error } = await supabase.rpc('imputar_pago', {
    p_pago: pagoId,
    p_imputaciones: items,
  })
  if (error) throw new Error(mensajeTalCual(error))
}

export async function anularPago(pagoId: string, motivo: string): Promise<void> {
  const texto = motivo.trim()
  if (!texto) throw new Error('El motivo de la anulación es obligatorio.')
  const { error } = await supabase.rpc('anular_pago', {
    p_pago: pagoId,
    p_motivo: texto,
  })
  if (error) throw new Error(mensajeTalCual(error))
}

export async function anularCargo(clubId: string, cargoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('cargos')
    .update({ estado: 'anulado' })
    .eq('id', cargoId)
    .eq('club_id', clubId)
    .eq('estado', 'emitido')
    .select('id')
  if (error) throw new Error(mensajeTalCual(error))
  if (!data || (data as { id: string }[]).length === 0) {
    throw new Error('No se pudo anular el cargo.')
  }
}
