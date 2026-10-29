import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { pesos } from '../lib/cobranza.ts'
import { validarReparto, type CargoSaldo, type ImputacionAlta } from '../lib/pagos.ts'
import { textoPeriodo } from './texto-caballo.ts'
import { aCentavos, desdeCentavos, leerMonto } from './texto-monto.ts'

type RepartoCargosProps = {
  cargos: CargoSaldo[]
  montoCentavos: number
  textos: Record<string, string>
  onTexto: (cargoId: string, valor: string) => void
  onAutomatico: () => void
  deshabilitado: boolean
  idPrefijo: string
}

export function leerReparto(
  cargos: CargoSaldo[],
  textos: Record<string, string>,
  montoCentavos: number,
): { aplicarCentavos: number; error: string | null; items: ImputacionAlta[] } {
  const filas: { saldoCentavos: number; aplicarCentavos: number }[] = []
  const items: ImputacionAlta[] = []
  for (const cargo of cargos) {
    const texto = textos[cargo.id] ?? ''
    if (!texto.trim()) {
      filas.push({ saldoCentavos: aCentavos(cargo.saldo), aplicarCentavos: 0 })
      continue
    }
    const monto = leerMonto(texto)
    if (monto == null || monto < 0) {
      return { aplicarCentavos: 0, error: 'Revisá el importe a aplicar.', items: [] }
    }
    const aplicarCentavos = aCentavos(monto)
    filas.push({ saldoCentavos: aCentavos(cargo.saldo), aplicarCentavos })
    if (aplicarCentavos > 0) items.push({ cargoId: cargo.id, centavos: aplicarCentavos })
  }
  const aplicarCentavos = filas.reduce((suma, fila) => suma + fila.aplicarCentavos, 0)
  return {
    aplicarCentavos,
    error: validarReparto(montoCentavos, filas),
    items,
  }
}

export function RepartoCargos({
  cargos,
  montoCentavos,
  textos,
  onTexto,
  onAutomatico,
  deshabilitado,
  idPrefijo,
}: RepartoCargosProps) {
  const reparto = leerReparto(cargos, textos, Math.max(0, montoCentavos))
  const sinAplicar = montoCentavos - reparto.aplicarCentavos

  return (
    <div className="flex flex-col gap-4">
      {cargos.length === 0 ? (
        <p className="font-body text-muted">
          No tiene cargos abiertos. El importe queda como saldo a favor.
        </p>
      ) : (
        <>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={deshabilitado || montoCentavos <= 0}
            onClick={onAutomatico}
          >
            Aplicar automáticamente
          </Button>
          {cargos.map((cargo) => (
            <Card key={cargo.id}>
              <div className="flex flex-col gap-3">
                <DatoFicha etiqueta="Período" valor={textoPeriodo(cargo.periodo)} />
                <DatoFicha etiqueta="Descripción" valor={cargo.descripcion ?? 'Cargo'} />
                <DatoFicha etiqueta="Saldo" valor={pesos(cargo.saldo)} />
                <TextField
                  id={`${idPrefijo}-aplicar-${cargo.id}`}
                  label="Aplicar"
                  value={textos[cargo.id] ?? ''}
                  onChange={(valor) => onTexto(cargo.id, valor)}
                  disabled={deshabilitado}
                  inputMode="decimal"
                />
              </div>
            </Card>
          ))}
        </>
      )}
      <div className="grid grid-cols-1 gap-3">
        <DatoFicha etiqueta="A aplicar" valor={pesos(desdeCentavos(reparto.aplicarCentavos))} />
        <DatoFicha
          etiqueta="Sin aplicar (queda como saldo a favor)"
          valor={pesos(desdeCentavos(sinAplicar))}
        />
      </div>
      {reparto.error && reparto.error !== 'El monto debe ser mayor a cero.' ? (
        <Alert tone="danger">{reparto.error}</Alert>
      ) : null}
    </div>
  )
}
