import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Select } from '../components/ui/Select.tsx'
import { TextArea } from '../components/ui/TextArea.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import { obtenerPersonasActivas, type PersonaActiva } from '../lib/caballos.ts'
import { fechaHoy } from '../lib/cobranza.ts'
import {
  etiquetaMedio,
  obtenerCargosAbiertos,
  registrarPago,
  repartirMonto,
  textoRecibo,
  type CargoSaldo,
  type MedioPago,
} from '../lib/pagos.ts'
import { leerReparto, RepartoCargos } from './RepartoCargos.tsx'
import { aCentavos, desdeCentavos, leerMonto, textoMonto } from './texto-monto.ts'

const MEDIOS: MedioPago[] = ['efectivo', 'transferencia', 'tarjeta', 'otro']

type CargaPersonas = {
  clubId: string
  personas: PersonaActiva[]
  error: string | null
}

type CargaCargos = {
  personaId: string
  cargos: CargoSaldo[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function esMedio(valor: string): valor is MedioPago {
  return MEDIOS.some((medio) => medio === valor)
}

export default function RegistrarPago() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const cargoInicial = params.get('cargo') ?? ''
  const [personas, setPersonas] = useState<CargaPersonas | null>(null)
  const [personaId, setPersonaId] = useState(params.get('persona') ?? '')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(fechaHoy)
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cargos, setCargos] = useState<CargaCargos | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tocado = useRef(false)
  const ocupadoRef = useRef(false)
  const montoRef = useRef(monto)
  montoRef.current = monto

  const listaPersonas = personas && personas.clubId === clubId ? personas.personas : []
  const cargandoPersonas = Boolean(clubId) && (!personas || personas.clubId !== clubId)
  const errorPersonas = personas && personas.clubId === clubId ? personas.error : null
  const cargosPersona = cargos && cargos.personaId === personaId ? cargos.cargos : []
  const cargandoCargos = Boolean(personaId) && (!cargos || cargos.personaId !== personaId)
  const montoLeido = leerMonto(monto)
  const montoCentavos = montoLeido != null && montoLeido > 0 ? aCentavos(montoLeido) : 0

  useEffect(() => {
    if (!clubId) return
    let activo = true
    const club = clubId
    void obtenerPersonasActivas(club)
      .then((lista) => {
        if (!activo) return
        setPersonas({ clubId: club, personas: lista, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setPersonas({ clubId: club, personas: [], error: mensajeDe(causa) })
      })
    return () => {
      activo = false
    }
  }, [clubId])

  useEffect(() => {
    if (!clubId || !personaId) return
    let activo = true
    const club = clubId
    const persona = personaId
    void obtenerCargosAbiertos(club, persona)
      .then((lista) => {
        if (!activo) return
        setCargos({ personaId: persona, cargos: lista, error: null })
        if (tocado.current || !cargoInicial) return
        const cargo = lista.find((item) => item.id === cargoInicial)
        const centavos = aCentavos(leerMonto(montoRef.current) ?? 0)
        if (!cargo || centavos <= 0) return
        tocado.current = true
        const aplicar = Math.min(centavos, aCentavos(cargo.saldo))
        setTextos(aplicar > 0 ? { [cargo.id]: textoMonto(desdeCentavos(aplicar)) } : {})
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setCargos({ personaId: persona, cargos: [], error: mensajeDe(causa) })
      })
    return () => {
      activo = false
    }
  }, [clubId, personaId, cargoInicial])

  function cambiarPersona(valor: string) {
    tocado.current = false
    setPersonaId(valor)
    setTextos({})
    setError(null)
  }

  function cambiarMonto(valor: string) {
    setMonto(valor)
    setError(null)
    if (tocado.current || !cargoInicial || !cargos || cargos.personaId !== personaId) return
    const cargo = cargos.cargos.find((item) => item.id === cargoInicial)
    const centavos = aCentavos(leerMonto(valor) ?? 0)
    if (!cargo || centavos <= 0) return
    tocado.current = true
    const aplicar = Math.min(centavos, aCentavos(cargo.saldo))
    setTextos(aplicar > 0 ? { [cargo.id]: textoMonto(desdeCentavos(aplicar)) } : {})
  }

  function aplicarAutomatico() {
    tocado.current = true
    const reparto = repartirMonto(
      montoCentavos,
      cargosPersona.map((cargo) => ({
        id: cargo.id,
        saldoCentavos: aCentavos(cargo.saldo),
        vencimiento: cargo.vencimiento,
      })),
    )
    const siguiente: Record<string, string> = {}
    for (const cargo of cargosPersona) {
      const centavos = reparto.get(cargo.id) ?? 0
      if (centavos > 0) siguiente[cargo.id] = textoMonto(desdeCentavos(centavos))
    }
    setTextos(siguiente)
    setError(null)
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId || ocupadoRef.current) return
    if (!personaId) {
      setError('Elegí la persona.')
      return
    }
    if (montoLeido == null || montoLeido <= 0) {
      setError('El monto debe ser mayor a cero.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError('Ingresá la fecha.')
      return
    }
    if (fecha > fechaHoy()) {
      setError('La fecha no puede ser futura.')
      return
    }
    const reparto = leerReparto(cargosPersona, textos, montoCentavos)
    if (reparto.error) {
      setError(reparto.error)
      return
    }
    ocupadoRef.current = true
    setOcupado(true)
    setError(null)
    try {
      const pago = await registrarPago(
        clubId,
        personaId,
        montoCentavos,
        fecha,
        medio,
        referencia,
        observaciones,
        reparto.items,
      )
      navigate(`/cobranza/pagos/${pago.id}`, {
        state: { aviso: `Pago registrado, recibo N.º ${textoRecibo(pago.numeroRecibo)}` },
      })
    } catch (causa) {
      setError(mensajeDe(causa))
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => void guardar(event)}>
      <h2 className="text-lg">Registrar pago</h2>
      {error || errorPersonas ? <Alert tone="danger">{error ?? errorPersonas}</Alert> : null}
      {cargos && cargos.personaId === personaId && cargos.error ? (
        <Alert tone="danger">{cargos.error}</Alert>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4">
          <Select
            id="pago-persona"
            label="Persona"
            value={personaId}
            onChange={cambiarPersona}
            disabled={ocupado || cargandoPersonas}
            options={[
              { value: '', label: 'Elegí una persona' },
              ...listaPersonas.map((persona) => ({
                value: persona.id,
                label: persona.apellido ? `${persona.apellido}, ${persona.nombre}` : persona.nombre,
              })),
            ]}
          />
          <TextField
            id="pago-monto"
            label="Monto"
            value={monto}
            onChange={cambiarMonto}
            disabled={ocupado}
            inputMode="decimal"
          />
          <TextField
            id="pago-fecha"
            label="Fecha"
            type="date"
            value={fecha}
            onChange={setFecha}
            disabled={ocupado}
          />
          <Select
            id="pago-medio"
            label="Medio"
            value={medio}
            onChange={(valor) => {
              if (esMedio(valor)) setMedio(valor)
            }}
            disabled={ocupado}
            options={MEDIOS.map((item) => ({ value: item, label: etiquetaMedio(item) }))}
          />
          <TextField
            id="pago-referencia"
            label="Referencia"
            value={referencia}
            onChange={setReferencia}
            disabled={ocupado}
          />
          <TextArea
            id="pago-observaciones"
            label="Observaciones"
            value={observaciones}
            onChange={setObservaciones}
            disabled={ocupado}
          />
        </div>
      </Card>

      {personaId ? (
        cargandoCargos ? (
          <p className="font-body text-muted" role="status">
            Cargando cargos…
          </p>
        ) : (
          <RepartoCargos
            cargos={cargosPersona}
            montoCentavos={montoCentavos}
            textos={textos}
            onTexto={(cargoId, valor) => {
              tocado.current = true
              setTextos((actual) => ({ ...actual, [cargoId]: valor }))
              setError(null)
            }}
            onAutomatico={aplicarAutomatico}
            deshabilitado={ocupado}
            idPrefijo="alta-pago"
          />
        )
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="w-full sm:w-auto" disabled={ocupado || cargandoPersonas}>
          Guardar
        </Button>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={ocupado}
          onClick={() => navigate('/cobranza/pagos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
