import type { Caballo, EstadoCaballo, SexoCaballo, TipoCaballo } from '../lib/caballos.ts'

export function etiquetaTipo(tipo: TipoCaballo): string {
  return tipo === 'escuela' ? 'Escuela' : 'Particular'
}

export function etiquetaEstado(estado: EstadoCaballo): string {
  return estado === 'activo' ? 'Activo' : 'Baja'
}

export function etiquetaSexo(sexo: SexoCaballo | null): string {
  if (sexo === 'yegua') return 'Yegua'
  if (sexo === 'padrillo') return 'Padrillo'
  if (sexo === 'castrado') return 'Castrado'
  return 'Sin sexo'
}

export function etiquetaPersona(persona: { nombre: string; apellido: string | null }): string {
  const apellido = persona.apellido?.trim()
  return apellido ? `${persona.nombre} ${apellido}` : persona.nombre
}

export function textoPropietario(caballo: Caballo): string {
  if (!caballo.propietarioId) return 'Sin propietario'
  if (!caballo.propietario) return 'Propietario'
  return etiquetaPersona(caballo.propietario)
}

export function textoUbicacion(caballo: Caballo): string {
  if (!caballo.ubicacion) return 'Sin box'
  return `${caballo.ubicacion.cuadraNombre} · Box ${caballo.ubicacion.numero}`
}

export function textoPeriodo(iso: string): string {
  const [anio, mes] = iso.slice(0, 10).split('-')
  const fecha = new Date(Number(anio), Number(mes) - 1, 1)
  if (!anio || !mes || Number.isNaN(fecha.getTime())) return iso
  const texto = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(fecha)
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1)
}

export function mesDeFecha(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

export function opcionesDeMes(cantidad = 18): { value: string; label: string }[] {
  const hoy = new Date()
  const opciones: { value: string; label: string }[] = []
  for (let indice = 0; indice < cantidad; indice += 1) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - indice, 1)
    const iso = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
    opciones.push({ value: iso, label: textoPeriodo(iso) })
  }
  return opciones
}

export function textoFecha(valor: string | null): string {
  if (!valor) return 'Sin fecha'
  const [anio, mes, dia] = valor.slice(0, 10).split('-')
  if (!anio || !mes || !dia) return valor
  return `${dia}/${mes}/${anio}`
}

export function textoOpcional(valor: string | null, vacio: string): string {
  const limpio = valor?.trim()
  return limpio || vacio
}
