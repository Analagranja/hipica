import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  etiquetaEstadoPension,
  obtenerPensiones,
  pesos,
  type EstadoPension,
  type PensionLista,
} from '../lib/cobranza.ts'

type FiltroEstado = EstadoPension

type Lista = {
  clubId: string
  pensiones: PensionLista[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

export default function Pensiones() {
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const [lista, setLista] = useState<Lista | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('activa')

  const pensiones = lista && lista.clubId === clubId ? lista.pensiones : []
  const cargando = Boolean(clubId) && (!lista || lista.clubId !== clubId)
  const error = lista !== null && lista.clubId === clubId ? lista.error : null

  useEffect(() => {
    if (!clubId) return
    let activo = true
    const club = clubId

    void obtenerPensiones(club)
      .then((pensionesCargadas) => {
        if (!activo) return
        setLista({ clubId: club, pensiones: pensionesCargadas, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clubId: club, pensiones: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId])

  const texto = busqueda.trim().toLocaleLowerCase('es')
  const visibles = pensiones.filter((pension) => {
    const caballo = pension.caballoNombre.toLocaleLowerCase('es')
    const responsable = pension.responsableNombre.toLocaleLowerCase('es')
    const coincideTexto = !texto || caballo.includes(texto) || responsable.includes(texto)
    return coincideTexto && pension.estado === filtro
  })

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-col gap-3">
        <TextField
          id="buscar-pension"
          label="Buscar por caballo o responsable"
          value={busqueda}
          onChange={setBusqueda}
        />
        <Select
          id="filtro-pension"
          label="Estado"
          value={filtro}
          onChange={(valor) => setFiltro(valor === 'finalizada' ? 'finalizada' : 'activa')}
          options={[
            { value: 'activa', label: 'Activas' },
            { value: 'finalizada', label: 'De baja' },
          ]}
        />
      </div>

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando pensiones…
        </p>
      ) : pensiones.length === 0 ? (
        <Card>
          <p className="font-body text-muted">Todavía no hay pensiones.</p>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay pensiones con ese criterio.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibles.map((pension) => (
            <Card key={pension.id}>
              <Link
                to={`/cobranza/pensiones/${pension.id}`}
                className="block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg">{pension.caballoNombre}</h2>
                  <StatusBadge tone={pension.estado === 'activa' ? 'ok' : 'warn'}>
                    {etiquetaEstadoPension(pension.estado)}
                  </StatusBadge>
                </div>
                <p className="mt-2 font-body text-muted">{pension.responsableNombre}</p>
                <p className="font-body text-ink">{pesos(pension.totalVigente)}</p>
                <p className="font-body text-muted">Vence el día {pension.diaVencimiento}</p>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
