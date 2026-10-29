export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, '')
  if (!limpio) return null
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizado)) return null
  const numero = Number(normalizado)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100) / 100
}

export function textoMonto(monto: number): string {
  return String(monto).replace('.', ',')
}

export function aCentavos(monto: number): number {
  return Math.round(monto * 100)
}

export function desdeCentavos(centavos: number): number {
  return Math.round(centavos) / 100
}
