import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { MetricCard } from '../components/ui/MetricCard.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { Tag } from '../components/ui/Tag.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import { fechaHoy, pesos } from '../lib/cobranza.ts'
import {
  etiquetaEstadoPago,
  etiquetaMedio,
  obtenerPagos,
  textoRecibo,
  type EstadoPago,
  type PagoLista,
} from '../lib/pagos.ts'
import { mesDeFecha, opcionesDeMes, textoFecha } from './texto-caballo.ts'
import { aCentavos, desdeCentavos } from './texto-monto.ts'

type FiltroEstado = '' | EstadoPago

type Lista = {
  clubId: string
  pagos: PagoLista[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

export default function Pagos() {
  const navigate = useNavigate()
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const [lista, setLista] = useState<Lista | null>(null)
  const [mes, setMes] = useState(() => mesDeFecha(fechaHoy()))
  const [estado, setEstado] = useState<FiltroEstado>('')
  const [busqueda, setBusqueda] = useState('')

  const pagos = lista && lista.clubId === clubId ? lista.pagos : []
  const cargando = Boolean(clubId) && (!lista || lista.clubId !== clubId)
  const error = lista !== null && lista.clubId === clubId ? lista.error : null

  useEffect(() => {
    if (!clubId) return
    let activo = true
    const club = clubId

    void obtenerPagos(club)
      .then((pagosCargados) => {
        if (!activo) return
        setLista({ clubId: club, pagos: pagosCargados, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clubId: club, pagos: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId])

  const texto = busqueda.trim().toLocaleLowerCase('es')
  const delMes = pagos.filter((pago) => mesDeFecha(pago.fecha) === mes)
  const cobrado = desdeCentavos(
    delMes
      .filter((pago) => pago.estado !== 'anulado')
      .reduce((suma, pago) => suma + aCentavos(pago.monto), 0),
  )
  const visibles = delMes.filter((pago) => {
    const coincideEstado = !estado || pago.estado === estado
    const coincideTexto = !texto || pago.personaNombre.toLocaleLowerCase('es').includes(texto)
    return coincideEstado && coincideTexto
  })

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <MetricCard label="Total cobrado del mes" value={pesos(cobrado)} />
        <Button className="w-full sm:w-auto" onClick={() => navigate('/cobranza/pagos/nuevo')}>
          Registrar pago
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <Select
          id="mes-pagos"
          label="Mes"
          value={mes}
          onChange={setMes}
          options={opcionesDeMes()}
        />
        <Select
          id="estado-pagos"
          label="Estado"
          value={estado}
          onChange={(valor) => setEstado(valor === 'confirmado' || valor === 'anulado' ? valor : '')}
          options={[
            { value: '', label: 'Todos' },
            { value: 'confirmado', label: 'Confirmado' },
            { value: 'anulado', label: 'Anulado' },
          ]}
        />
        <TextField
          id="buscar-pago"
          label="Buscar por persona"
          value={busqueda}
          onChange={setBusqueda}
        />
      </div>

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando pagos…
        </p>
      ) : visibles.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay pagos con ese criterio.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibles.map((pago) => (
            <Card key={pago.id}>
              <Link
                to={`/cobranza/pagos/${pago.id}`}
                className="block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg">N.º {textoRecibo(pago.numeroRecibo)}</h2>
                  <StatusBadge tone={pago.estado === 'anulado' ? 'danger' : 'ok'}>
                    {etiquetaEstadoPago(pago.estado)}
                  </StatusBadge>
                  {pago.estado === 'confirmado' && aCentavos(pago.sinAplicar) > 0 ? (
                    <Tag>Sin aplicar</Tag>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <DatoFicha etiqueta="Fecha" valor={textoFecha(pago.fecha)} />
                  <DatoFicha etiqueta="Persona" valor={pago.personaNombre} />
                  <DatoFicha etiqueta="Monto" valor={pesos(pago.monto)} />
                  <DatoFicha etiqueta="Medio" valor={etiquetaMedio(pago.medio)} />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
