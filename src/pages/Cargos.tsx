import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { MetricCard } from '../components/ui/MetricCard.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { Table } from '../components/ui/Table.tsx'
import { TextArea } from '../components/ui/TextArea.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import { obtenerPersonasActivas, type PersonaActiva } from '../lib/caballos.ts'
import { fechaHoy, pesos } from '../lib/cobranza.ts'
import {
  anularCargo,
  crearCargoManual,
  etiquetaEstadoCobro,
  generarCargosMes,
  obtenerCargosDelMes,
  obtenerItemsDeCargo,
  type CargoMes,
  type EstadoCobro,
  type ItemCargo,
} from '../lib/pagos.ts'
import {
  desplazarMes,
  mesDeFecha,
  mesesAlrededor,
  nombreMes,
  textoFecha,
  textoPeriodo,
} from './texto-caballo.ts'
import { aCentavos, desdeCentavos, leerMonto } from './texto-monto.ts'

type Lista = {
  clave: string
  cargos: CargoMes[]
  error: string | null
}

type FiltroEstado = '' | EstadoCobro

type Items = {
  items: ItemCargo[]
  error: string | null
}

type Manual = {
  personaId: string
  descripcion: string
  monto: string
  periodo: string
  vencimiento: string
}

const ESTADOS: EstadoCobro[] = ['pagado', 'parcial', 'vencido', 'pendiente', 'anulado']

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function tonoCobro(estado: EstadoCobro): 'ok' | 'warn' | 'danger' {
  if (estado === 'pagado') return 'ok'
  if (estado === 'vencido' || estado === 'anulado') return 'danger'
  return 'warn'
}

function sumar(cargos: CargoMes[], campo: 'total' | 'pagado' | 'saldo'): number {
  return desdeCentavos(cargos.reduce((suma, cargo) => suma + aCentavos(cargo[campo]), 0))
}

function vencimientoInicial(periodo: string): string {
  return `${periodo.slice(0, 7)}-10`
}

function textoGenerados(cantidad: number): string {
  if (cantidad === 0) return 'No había cargos nuevos para generar'
  if (cantidad === 1) return 'Se generó 1 cargo'
  return `Se generaron ${cantidad} cargos`
}

function manualVacio(periodo: string): Manual {
  return {
    personaId: '',
    descripcion: '',
    monto: '',
    periodo,
    vencimiento: vencimientoInicial(periodo),
  }
}

export default function Cargos() {
  const navigate = useNavigate()
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const [mes, setMes] = useState(() => mesDeFecha(fechaHoy()))
  const [lista, setLista] = useState<Lista | null>(null)
  const [estado, setEstado] = useState<FiltroEstado>('')
  const [busqueda, setBusqueda] = useState('')
  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [confirmarGenerar, setConfirmarGenerar] = useState(false)
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const [items, setItems] = useState<Record<string, Items>>({})
  const [manual, setManual] = useState<Manual | null>(null)
  const [personas, setPersonas] = useState<{ clubId: string; personas: PersonaActiva[] } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const ocupadoRef = useRef(false)
  const clubIdRef = useRef(clubId)
  const clave = clubId ? `${clubId}:${mes}` : ''

  const cargos = lista && lista.clave === clave ? lista.cargos : []
  const cargando = Boolean(clave) && (!lista || lista.clave !== clave)
  const error = errorAccion ?? (lista && lista.clave === clave ? lista.error : null)
  const emitidos = cargos.filter((cargo) => cargo.estado === 'emitido')
  const listaPersonas = personas && personas.clubId === clubId ? personas.personas : []

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

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

  async function recargar(club: string, periodo: string) {
    const cargosCargados = await obtenerCargosDelMes(club, periodo)
    if (clubIdRef.current !== club) return
    setLista({ clave: `${club}:${periodo}`, cargos: cargosCargados, error: null })
  }

  async function ejecutar(accion: () => Promise<void>) {
    if (!clubId || ocupadoRef.current) return
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    setAviso(null)
    try {
      await accion()
    } catch (causa) {
      setErrorAccion(mensajeDe(causa))
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  function cambiarMes(siguiente: string) {
    setMes(siguiente)
    setConfirmarGenerar(false)
    setAnulando(null)
    setErrorAccion(null)
    setAviso(null)
  }

  function generar() {
    if (!clubId) return
    const club = clubId
    const periodo = mes
    void ejecutar(async () => {
      const cantidad = await generarCargosMes(club, periodo)
      await recargar(club, periodo)
      setConfirmarGenerar(false)
      setAviso(textoGenerados(cantidad))
    })
  }

  function confirmarAnulacion(cargoId: string) {
    if (!clubId) return
    if (!motivo.trim()) {
      setErrorAccion('El motivo de la anulación es obligatorio.')
      return
    }
    const club = clubId
    const periodo = mes
    const texto = motivo
    void ejecutar(async () => {
      await anularCargo(club, cargoId, texto)
      await recargar(club, periodo)
      setAnulando(null)
      setMotivo('')
      setAviso('Cargo anulado')
    })
  }

  function alternarItems(cargoId: string) {
    const abrir = !abiertos[cargoId]
    setAbiertos((actual) => ({ ...actual, [cargoId]: abrir }))
    if (!abrir || !clubId || items[cargoId]) return
    void obtenerItemsDeCargo(clubId, cargoId)
      .then((lista) => setItems((actual) => ({ ...actual, [cargoId]: { items: lista, error: null } })))
      .catch((causa: unknown) =>
        setItems((actual) => ({ ...actual, [cargoId]: { items: [], error: mensajeDe(causa) } })),
      )
  }

  function abrirManual() {
    setManual(manualVacio(mes))
    setErrorAccion(null)
    setAviso(null)
    if (!clubId || (personas && personas.clubId === clubId)) return
    const club = clubId
    void obtenerPersonasActivas(club)
      .then((lista) => setPersonas({ clubId: club, personas: lista }))
      .catch((causa: unknown) => setErrorAccion(mensajeDe(causa)))
  }

  function guardarManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId || !manual) return
    if (!manual.personaId) {
      setErrorAccion('Elegí la persona.')
      return
    }
    if (!manual.descripcion.trim()) {
      setErrorAccion('Ingresá la descripción.')
      return
    }
    const monto = leerMonto(manual.monto)
    if (monto == null || monto <= 0) {
      setErrorAccion('El monto debe ser mayor a cero.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(manual.vencimiento)) {
      setErrorAccion('Ingresá el vencimiento.')
      return
    }
    const club = clubId
    const datos = {
      personaId: manual.personaId,
      descripcion: manual.descripcion,
      montoCentavos: aCentavos(monto),
      periodo: mesDeFecha(manual.periodo),
      vencimiento: manual.vencimiento,
    }
    void ejecutar(async () => {
      await crearCargoManual(club, datos)
      setManual(null)
      if (datos.periodo === mes) {
        await recargar(club, datos.periodo)
      } else {
        setMes(datos.periodo)
      }
      setAviso('Cargo creado')
    })
  }

  const texto = busqueda.trim().toLocaleLowerCase('es')
  const visibles = cargos.filter((cargo) => {
    const coincideEstado = !estado || cargo.estadoCobro === estado
    const coincideTexto =
      !texto ||
      cargo.personaNombre.toLocaleLowerCase('es').includes(texto) ||
      (cargo.caballoNombre ?? '').toLocaleLowerCase('es').includes(texto)
    return coincideEstado && coincideTexto
  })
  const etiquetaMes = nombreMes(mes)

  return (
    <div className="flex flex-col gap-6">
      {aviso ? <Alert tone="ok">{aviso}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          aria-label="Mes anterior"
          disabled={ocupado}
          onClick={() => cambiarMes(desplazarMes(mes, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 className="text-center text-lg">{textoPeriodo(mes)}</h2>
        <Button
          variant="secondary"
          aria-label="Mes siguiente"
          disabled={ocupado}
          onClick={() => cambiarMes(desplazarMes(mes, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          className="w-full sm:w-auto"
          disabled={ocupado}
          onClick={() => {
            setConfirmarGenerar(true)
            setErrorAccion(null)
            setAviso(null)
          }}
        >
          Generar cargos de {etiquetaMes}
        </Button>
        <Button variant="secondary" className="w-full sm:w-auto" disabled={ocupado} onClick={abrirManual}>
          Nuevo cargo manual
        </Button>
      </div>

      {confirmarGenerar ? (
        <Card>
          <div className="flex flex-col gap-3">
            <p className="font-body text-ink">
              Se van a generar los cargos de {etiquetaMes} para las pensiones activas. Los cargos que ya
              existen no se duplican.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full sm:w-auto" disabled={ocupado} onClick={generar}>
                Confirmar
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => setConfirmarGenerar(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {manual ? (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={guardarManual}>
            <h2 className="text-lg">Nuevo cargo manual</h2>
            <Select
              id="manual-persona"
              label="Persona"
              value={manual.personaId}
              onChange={(valor) => setManual({ ...manual, personaId: valor })}
              disabled={ocupado}
              options={[
                { value: '', label: 'Elegí una persona' },
                ...listaPersonas.map((persona) => ({
                  value: persona.id,
                  label: persona.apellido ? `${persona.apellido}, ${persona.nombre}` : persona.nombre,
                })),
              ]}
            />
            <TextField
              id="manual-descripcion"
              label="Descripción"
              value={manual.descripcion}
              onChange={(valor) => setManual({ ...manual, descripcion: valor })}
              disabled={ocupado}
            />
            <TextField
              id="manual-monto"
              label="Monto"
              value={manual.monto}
              onChange={(valor) => setManual({ ...manual, monto: valor })}
              disabled={ocupado}
              inputMode="decimal"
            />
            <Select
              id="manual-mes"
              label="Mes"
              value={manual.periodo}
              onChange={(valor) =>
                setManual({ ...manual, periodo: valor, vencimiento: vencimientoInicial(valor) })
              }
              disabled={ocupado}
              options={mesesAlrededor(mes)}
            />
            <TextField
              id="manual-vencimiento"
              label="Vencimiento"
              type="date"
              value={manual.vencimiento}
              onChange={(valor) => setManual({ ...manual, vencimiento: valor })}
              disabled={ocupado}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
                Guardar cargo
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => setManual(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Total emitido" value={cargando ? '…' : pesos(sumar(emitidos, 'total'))} />
        <MetricCard label="Total cobrado" value={cargando ? '…' : pesos(sumar(emitidos, 'pagado'))} />
        <MetricCard label="Saldo del mes" value={cargando ? '…' : pesos(sumar(emitidos, 'saldo'))} />
      </div>

      <div className="flex flex-col gap-3">
        <Select
          id="estado-cargos"
          label="Estado"
          value={estado}
          onChange={(valor) => setEstado(ESTADOS.find((item) => item === valor) ?? '')}
          options={[
            { value: '', label: 'Todos' },
            ...ESTADOS.map((item) => ({ value: item, label: etiquetaEstadoCobro(item) })),
          ]}
        />
        <TextField
          id="buscar-cargo"
          label="Buscar por responsable o caballo"
          value={busqueda}
          onChange={setBusqueda}
        />
      </div>

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando cargos…
        </p>
      ) : cargos.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay cargos en ese mes.</p>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay cargos con ese criterio.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibles.map((cargo) => {
            const detalle = items[cargo.id]
            const abierto = Boolean(abiertos[cargo.id])
            return (
              <Card key={cargo.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg">{cargo.personaNombre}</h2>
                    <StatusBadge tone={tonoCobro(cargo.estadoCobro)}>
                      {etiquetaEstadoCobro(cargo.estadoCobro)}
                    </StatusBadge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DatoFicha etiqueta="Caballo" valor={cargo.caballoNombre ?? 'Sin caballo'} />
                    {cargo.descripcion ? <DatoFicha etiqueta="Descripción" valor={cargo.descripcion} /> : null}
                    <DatoFicha etiqueta="Vencimiento" valor={textoFecha(cargo.vencimiento)} />
                    <DatoFicha etiqueta="Total" valor={pesos(cargo.total)} />
                    <DatoFicha etiqueta="Pagado" valor={pesos(cargo.pagado)} />
                    <DatoFicha etiqueta="Saldo" valor={pesos(cargo.saldo)} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto"
                      aria-expanded={abierto}
                      onClick={() => alternarItems(cargo.id)}
                    >
                      {abierto ? 'Ocultar ítems' : 'Ver ítems'}
                    </Button>
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
                        onClick={() => {
                          setAnulando(anulando === cargo.id ? null : cargo.id)
                          setMotivo('')
                          setErrorAccion(null)
                        }}
                      >
                        Anular
                      </Button>
                    ) : null}
                  </div>
                  {abierto ? (
                    !detalle ? (
                      <p className="font-body text-muted" role="status">
                        Cargando ítems…
                      </p>
                    ) : detalle.error ? (
                      <Alert tone="danger">{detalle.error}</Alert>
                    ) : detalle.items.length === 0 ? (
                      <p className="font-body text-muted">Este cargo no tiene ítems.</p>
                    ) : (
                      <Table
                        columns={['Descripción', 'Monto']}
                        rows={detalle.items.map((item) => ({
                          id: item.id,
                          cells: [item.descripcion, pesos(item.monto)],
                        }))}
                      />
                    )
                  ) : null}
                  {anulando === cargo.id ? (
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={(event) => {
                        event.preventDefault()
                        confirmarAnulacion(cargo.id)
                      }}
                    >
                      <TextArea
                        id={`motivo-cargo-${cargo.id}`}
                        label="Motivo de la anulación"
                        value={motivo}
                        onChange={setMotivo}
                        disabled={ocupado}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
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
                    </form>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
