import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { Disclosure } from '../components/ui/Disclosure.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Select } from '../components/ui/Select.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  agregarItemPension,
  cambiarMontoItem,
  fechaHoy,
  finalizarPension,
  obtenerConceptos,
  obtenerPension,
  pesos,
  quitarItem,
  type Concepto,
  type ItemPension,
  type PensionDetalle,
} from '../lib/cobranza.ts'
import { textoFecha } from './texto-caballo.ts'
import { leerMonto, textoMonto } from './texto-monto.ts'

type Carga = {
  clave: string
  pension: PensionDetalle | null
  conceptos: Concepto[]
  error: string | null
}

type AltaItem = {
  conceptoId: string
  monto: string
  desde: string
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function fechaInicialCambio(vigenteDesde: string): string {
  const hoy = fechaHoy()
  return vigenteDesde > hoy ? vigenteDesde : hoy
}

function totalVigente(items: ItemPension[]): number {
  const hoy = fechaHoy()
  return items
    .filter((item) => item.vigenteDesde <= hoy && (item.vigenteHasta === null || item.vigenteHasta >= hoy))
    .reduce((suma, item) => suma + item.monto, 0)
}

function etiquetaEstado(estado: PensionDetalle['estado']): string {
  return estado === 'activa' ? 'Activa' : 'Finalizada'
}

export default function Pension() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const clave = clubId && id ? `${clubId}:${id}` : ''
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [alta, setAlta] = useState<{ clave: string; abierta: boolean; datos: AltaItem } | null>(null)
  const [finalizar, setFinalizar] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clave: string; mensaje: string } | null>(null)

  const lista = carga && carga.clave === clave ? carga : null
  const pension = lista?.pension ?? null
  const conceptos = lista?.conceptos ?? []
  const cargando = Boolean(clave) && !lista
  const error =
    errorAccion !== null && errorAccion.clave === clave
      ? errorAccion.mensaje
      : lista
        ? lista.error
        : null
  const hoy = fechaHoy()
  const vigentes = (pension?.items ?? []).filter(
    (item) => item.vigenteHasta === null || item.vigenteHasta >= hoy,
  )
  const cerrados = (pension?.items ?? []).filter(
    (item) => item.vigenteHasta !== null && item.vigenteHasta < hoy,
  )
  const activos = conceptos.filter((concepto) => concepto.activo)
  const altaActual = alta !== null && alta.clave === clave ? alta : null

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

  useEffect(() => {
    if (!clubId || !id) return
    let activo = true
    const club = clubId
    const pensionId = id
    const claveCarga = `${club}:${pensionId}`

    void Promise.all([obtenerPension(club, pensionId), obtenerConceptos(club)])
      .then(([pensionCargada, conceptosCargados]) => {
        if (!activo) return
        setCarga({
          clave: claveCarga,
          pension: pensionCargada,
          conceptos: conceptosCargados,
          error: null,
        })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setCarga({ clave: claveCarga, pension: null, conceptos: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, id])

  async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
    if (!clubId || !id || ocupadoRef.current) return false
    const clubDeLaAccion = clubId
    const pensionId = id
    const claveAccion = `${clubDeLaAccion}:${pensionId}`
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await accion()
      const [fresca, conceptosCargados] = await Promise.all([
        obtenerPension(clubDeLaAccion, pensionId),
        obtenerConceptos(clubDeLaAccion),
      ])
      if (clubIdRef.current !== clubDeLaAccion) return false
      setCarga({
        clave: claveAccion,
        pension: fresca,
        conceptos: conceptosCargados,
        error: null,
      })
      return true
    } catch (causa) {
      if (clubIdRef.current === clubDeLaAccion) {
        setErrorAccion({ clave: claveAccion, mensaje: mensajeDe(causa) })
      }
      return false
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  function abrirAlta() {
    if (!clave) return
    const primero = activos[0]
    setAlta({
      clave,
      abierta: true,
      datos: {
        conceptoId: primero?.id ?? '',
        monto: primero ? textoMonto(primero.montoSugerido) : '',
        desde: fechaHoy(),
      },
    })
    setErrorAccion(null)
  }

  async function guardarItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId || !id || !altaActual?.abierta) return
    const datos = altaActual.datos
    if (!datos.conceptoId) {
      setErrorAccion({ clave, mensaje: 'Elegí un concepto.' })
      return
    }
    const monto = leerMonto(datos.monto)
    if (monto === null) {
      setErrorAccion({ clave, mensaje: 'Ingresá un monto.' })
      return
    }
    if (monto === 0) {
      setErrorAccion({ clave, mensaje: 'El monto no puede ser cero.' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.desde)) {
      setErrorAccion({ clave, mensaje: 'Ingresá desde cuándo rige el ítem.' })
      return
    }
    const ok = await ejecutar(() =>
      agregarItemPension(clubId, id, datos.conceptoId, monto, datos.desde),
    )
    if (ok) setAlta({ clave, abierta: false, datos })
  }

  if (!id) return <Navigate to="/cobranza/pensiones" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={pension?.caballoNombre ?? 'Pensión'}
        description="Pensión."
        action={
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => navigate('/cobranza/pensiones')}
          >
            Volver
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando pensión…
        </p>
      ) : !pension ? (
        <Card>
          <p className="font-body text-muted">No se encontró la pensión.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DatoFicha etiqueta="Caballo" valor={pension.caballoNombre} />
            <DatoFicha etiqueta="Responsable" valor={pension.responsableNombre} />
            <DatoFicha etiqueta="Día de vencimiento" valor={String(pension.diaVencimiento)} />
            <DatoFicha etiqueta="Inicio" valor={textoFecha(pension.inicio)} />
            <DatoFicha etiqueta="Fin" valor={pension.fin ? textoFecha(pension.fin) : 'Sin fin'} />
            <DatoFicha etiqueta="Estado" valor={etiquetaEstado(pension.estado)} />
            <DatoFicha etiqueta="Total vigente" valor={pesos(totalVigente(pension.items))} />
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg">Ítems vigentes</h2>
            {vigentes.length === 0 ? (
              <p className="font-body text-muted">Esta pensión no tiene ítems vigentes.</p>
            ) : (
              vigentes.map((item) => (
                <FilaItem
                  key={item.id}
                  clubId={clubId ?? ''}
                  item={item}
                  ocupado={ocupado}
                  onEjecutar={ejecutar}
                  onError={(mensaje) => setErrorAccion({ clave, mensaje })}
                />
              ))
            )}
          </section>

          {cerrados.length > 0 ? <HistorialCerrado key={pension.id} items={cerrados} /> : null}

          {altaActual?.abierta ? (
            <Card>
              {activos.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <p className="font-body text-muted">No hay conceptos activos.</p>
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => setAlta({ clave, abierta: false, datos: altaActual.datos })}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void guardarItem(event)}>
                  <Select
                    id="item-concepto"
                    label="Concepto"
                    value={altaActual.datos.conceptoId}
                    disabled={ocupado}
                    options={activos.map((concepto) => ({
                      value: concepto.id,
                      label: concepto.nombre,
                    }))}
                    onChange={(conceptoId) => {
                      const concepto = activos.find((actual) => actual.id === conceptoId)
                      setAlta({
                        clave,
                        abierta: true,
                        datos: {
                          ...altaActual.datos,
                          conceptoId,
                          monto: concepto ? textoMonto(concepto.montoSugerido) : altaActual.datos.monto,
                        },
                      })
                    }}
                  />
                  <TextField
                    id="item-monto"
                    label="Monto"
                    value={altaActual.datos.monto}
                    disabled={ocupado}
                    inputMode="decimal"
                    onChange={(monto) =>
                      setAlta({ clave, abierta: true, datos: { ...altaActual.datos, monto } })
                    }
                  />
                  <TextField
                    id="item-desde"
                    label="Vigente desde"
                    type="date"
                    value={altaActual.datos.desde}
                    disabled={ocupado}
                    onChange={(desde) =>
                      setAlta({ clave, abierta: true, datos: { ...altaActual.datos, desde } })
                    }
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
                      Agregar ítem
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto"
                      disabled={ocupado}
                      onClick={() => setAlta({ clave, abierta: false, datos: altaActual.datos })}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          ) : (
            <Button className="w-full sm:w-auto" disabled={ocupado} onClick={abrirAlta}>
              Agregar ítem
            </Button>
          )}

          {pension.estado === 'activa' && finalizar === clave ? (
            <Card>
              <p className="font-body text-ink">Se va a finalizar la pensión hoy.</p>
              {pension.inicio > fechaHoy() ? (
                <p className="mt-2 font-body text-muted">
                  La fecha de fin no puede ser anterior al inicio.
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full sm:w-auto"
                  disabled={ocupado || pension.inicio > fechaHoy()}
                  onClick={() => {
                    if (!clubId || pension.inicio > fechaHoy()) return
                    void ejecutar(() => finalizarPension(clubId, pension.id)).then((ok) => {
                      if (ok) setFinalizar(null)
                    })
                  }}
                >
                  Confirmar
                </Button>
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto"
                  disabled={ocupado}
                  onClick={() => setFinalizar(null)}
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          ) : null}

          {pension.estado === 'activa' && finalizar !== clave ? (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => setFinalizar(clave)}
            >
              Finalizar pensión
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

function HistorialCerrado({ items }: { items: ItemPension[] }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <Disclosure title="Ítems cerrados" open={abierto} onToggle={() => setAbierto((valor) => !valor)}>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DatoFicha etiqueta="Concepto" valor={item.conceptoNombre} />
            <DatoFicha etiqueta="Monto" valor={pesos(item.monto)} />
            <DatoFicha etiqueta="Vigente desde" valor={textoFecha(item.vigenteDesde)} />
            <DatoFicha etiqueta="Vigente hasta" valor={textoFecha(item.vigenteHasta)} />
          </div>
        ))}
      </div>
    </Disclosure>
  )
}

type FilaProps = {
  clubId: string
  item: ItemPension
  ocupado: boolean
  onEjecutar: (accion: () => Promise<unknown>) => Promise<boolean>
  onError: (mensaje: string) => void
}

function FilaItem({ clubId, item, ocupado, onEjecutar, onError }: FilaProps) {
  const [modo, setModo] = useState<'ver' | 'monto' | 'quitar'>('ver')
  const [monto, setMonto] = useState(() => textoMonto(item.monto))
  const [desde, setDesde] = useState(() => fechaInicialCambio(item.vigenteDesde))
  const yaEmpezo = item.vigenteDesde < fechaHoy()

  function abrirMonto() {
    setMonto(textoMonto(item.monto))
    setDesde(fechaInicialCambio(item.vigenteDesde))
    setModo('monto')
  }

  async function guardarMonto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nuevo = leerMonto(monto)
    if (nuevo === null) {
      onError('Ingresá un monto.')
      return
    }
    if (nuevo === 0) {
      onError('El monto no puede ser cero.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      onError('Ingresá desde cuándo rige el monto.')
      return
    }
    const ok = await onEjecutar(() => cambiarMontoItem(clubId, item.id, nuevo, desde))
    if (ok) setModo('ver')
  }

  return (
    <Card>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DatoFicha etiqueta="Concepto" valor={item.conceptoNombre} />
        <DatoFicha etiqueta="Monto" valor={pesos(item.monto)} />
        <DatoFicha etiqueta="Vigente desde" valor={textoFecha(item.vigenteDesde)} />
        {item.vigenteHasta ? (
          <DatoFicha etiqueta="Vigente hasta" valor={textoFecha(item.vigenteHasta)} />
        ) : null}
      </div>

      {modo === 'ver' ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" disabled={ocupado} onClick={abrirMonto}>
            Cambiar monto
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={ocupado}
            onClick={() => setModo('quitar')}
          >
            Quitar
          </Button>
        </div>
      ) : null}

      {modo === 'monto' ? (
        <form className="mt-4 flex flex-col gap-4" noValidate onSubmit={(event) => void guardarMonto(event)}>
          <TextField
            id={`monto-${item.id}`}
            label="Monto"
            value={monto}
            disabled={ocupado}
            inputMode="decimal"
            onChange={setMonto}
          />
          <TextField
            id={`desde-${item.id}`}
            label="Vigente desde"
            type="date"
            value={desde}
            disabled={ocupado}
            onChange={setDesde}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
              Guardar monto
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => setModo('ver')}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {modo === 'quitar' ? (
        <div className="mt-4">
          <p className="font-body text-ink">
            {yaEmpezo ? 'El ítem queda cerrado ayer.' : 'Se va a borrar el ítem.'}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => {
                void onEjecutar(() => quitarItem(clubId, item.id)).then((ok) => {
                  if (ok) setModo('ver')
                })
              }}
            >
              Confirmar
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => setModo('ver')}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
