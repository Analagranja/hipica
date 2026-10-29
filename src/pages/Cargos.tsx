import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { MetricCard } from '../components/ui/MetricCard.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { useAuth } from '../context/auth-state.ts'
import { fechaHoy, pesos } from '../lib/cobranza.ts'
import {
  anularCargo,
  etiquetaEstadoCobro,
  obtenerCargosDelMes,
  type CargoSaldo,
  type EstadoCobro,
} from '../lib/pagos.ts'
import { mesDeFecha, opcionesDeMes, textoFecha, textoPeriodo } from './texto-caballo.ts'
import { aCentavos, desdeCentavos } from './texto-monto.ts'

type Lista = {
  clave: string
  cargos: CargoSaldo[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function tonoCobro(estado: EstadoCobro): 'ok' | 'warn' | 'danger' {
  if (estado === 'pagado') return 'ok'
  if (estado === 'vencido' || estado === 'anulado') return 'danger'
  return 'warn'
}

function sumar(cargos: CargoSaldo[], campo: 'total' | 'pagado' | 'saldo'): number {
  return desdeCentavos(cargos.reduce((suma, cargo) => suma + aCentavos(cargo[campo]), 0))
}

export default function Cargos() {
  const navigate = useNavigate()
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const [mes, setMes] = useState(() => mesDeFecha(fechaHoy()))
  const [lista, setLista] = useState<Lista | null>(null)
  const [anulando, setAnulando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const ocupadoRef = useRef(false)
  const clave = clubId ? `${clubId}:${mes}` : ''

  const cargos = lista && lista.clave === clave ? lista.cargos : []
  const cargando = Boolean(clave) && (!lista || lista.clave !== clave)
  const error = errorAccion ?? (lista && lista.clave === clave ? lista.error : null)
  const emitidos = cargos.filter((cargo) => cargo.estado === 'emitido')

  useEffect(() => {
    if (!clubId) return
    let activo = true
    const club = clubId
    const periodo = mes
    const claveCarga = `${club}:${periodo}`

    void obtenerCargosDelMes(club, periodo)
      .then((cargosCargados) => {
        if (!activo) return
        setLista({ clave: claveCarga, cargos: cargosCargados, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clave: claveCarga, cargos: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, mes])

  async function confirmarAnulacion(cargoId: string) {
    if (!clubId || ocupadoRef.current) return
    const club = clubId
    const periodo = mes
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await anularCargo(club, cargoId)
      const cargosCargados = await obtenerCargosDelMes(club, periodo)
      setLista({ clave: `${club}:${periodo}`, cargos: cargosCargados, error: null })
      setAnulando(null)
    } catch (causa) {
      setErrorAccion(mensajeDe(causa))
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Select id="mes-cargos" label="Mes" value={mes} onChange={setMes} options={opcionesDeMes()} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Total emitido" value={cargando ? '…' : pesos(sumar(emitidos, 'total'))} />
        <MetricCard label="Total cobrado" value={cargando ? '…' : pesos(sumar(emitidos, 'pagado'))} />
        <MetricCard label="Saldo del mes" value={cargando ? '…' : pesos(sumar(emitidos, 'saldo'))} />
      </div>

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando cargos…
        </p>
      ) : cargos.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay cargos en ese mes.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {cargos.map((cargo) => (
            <Card key={cargo.id}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg">{cargo.personaNombre}</h2>
                  <StatusBadge tone={tonoCobro(cargo.estadoCobro)}>
                    {etiquetaEstadoCobro(cargo.estadoCobro)}
                  </StatusBadge>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <DatoFicha etiqueta="Período" valor={textoPeriodo(cargo.periodo)} />
                  <DatoFicha etiqueta="Descripción" valor={cargo.descripcion ?? 'Cargo'} />
                  <DatoFicha etiqueta="Vencimiento" valor={textoFecha(cargo.vencimiento)} />
                  <DatoFicha etiqueta="Total" valor={pesos(cargo.total)} />
                  <DatoFicha etiqueta="Pagado" valor={pesos(cargo.pagado)} />
                  <DatoFicha etiqueta="Saldo" valor={pesos(cargo.saldo)} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {cargo.estado !== 'anulado' && aCentavos(cargo.saldo) > 0 ? (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() =>
                        navigate(`/cobranza/pagos/nuevo?persona=${cargo.personaId}&cargo=${cargo.id}`)
                      }
                    >
                      Registrar pago
                    </Button>
                  ) : null}
                  {cargo.estado === 'emitido' ? (
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={ocupado}
                      onClick={() => setAnulando(anulando === cargo.id ? null : cargo.id)}
                    >
                      Anular
                    </Button>
                  ) : null}
                </div>
                {anulando === cargo.id ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-body text-ink">Se va a anular este cargo.</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="w-full sm:w-auto"
                        disabled={ocupado}
                        onClick={() => void confirmarAnulacion(cargo.id)}
                      >
                        Confirmar anulación
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        disabled={ocupado}
                        onClick={() => setAnulando(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
