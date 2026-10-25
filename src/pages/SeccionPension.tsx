import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { Select } from '../components/ui/Select.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import {
  obtenerPersonasActivas,
  type Caballo,
  type PersonaActiva,
} from '../lib/caballos.ts'
import {
  crearPensionConItems,
  fechaHoy,
  obtenerConceptos,
  obtenerPensionActivaDeCaballo,
  pesos,
  type Concepto,
  type PensionResumen,
} from '../lib/cobranza.ts'
import { etiquetaPersona, textoFecha } from './texto-caballo.ts'
import { leerMonto, textoMonto } from './texto-monto.ts'

type Carga = {
  clave: string
  pension: PensionResumen | null
  personas: PersonaActiva[]
  conceptos: Concepto[]
  error: string | null
}

type FilaItem = {
  clave: string
  conceptoId: string
  monto: string
}

type Formulario = {
  clave: string
  abierto: boolean
  responsableId: string
  dia: string
  inicio: string
  items: FilaItem[]
}

const DIAS = Array.from({ length: 28 }, (_, indice) => String(indice + 1))

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function opcionesResponsable(personas: PersonaActiva[], caballo: Caballo) {
  const opciones = personas.map((persona) => ({
    value: persona.id,
    label: etiquetaPersona(persona),
  }))
  if (caballo.propietarioId && !opciones.some((opcion) => opcion.value === caballo.propietarioId)) {
    opciones.unshift({
      value: caballo.propietarioId,
      label: caballo.propietario ? etiquetaPersona(caballo.propietario) : 'Propietario',
    })
  }
  return opciones
}

function totalItems(items: FilaItem[]): number {
  const total = items.reduce((suma, item) => {
    const monto = leerMonto(item.monto)
    if (monto === null || monto === 0) return suma
    return suma + monto
  }, 0)
  return Math.round(total * 100) / 100
}

export function SeccionPension({ clubId, caballo }: { clubId: string; caballo: Caballo }) {
  const navigate = useNavigate()
  const clave = `${clubId}:${caballo.id}`
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const filaRef = useRef(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clave: string; mensaje: string } | null>(null)

  const lista = carga && carga.clave === clave ? carga : null
  const cargando = !lista
  const pension = lista?.pension ?? null
  const conceptos = (lista?.conceptos ?? []).filter((concepto) => concepto.activo)
  const opciones = opcionesResponsable(lista?.personas ?? [], caballo)
  const form = formulario !== null && formulario.clave === clave ? formulario : null
  const error =
    errorAccion !== null && errorAccion.clave === clave ? errorAccion.mensaje : lista?.error ?? null

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

  useEffect(() => {
    let activo = true
    const club = clubId
    const caballoId = caballo.id
    const claveCarga = `${club}:${caballoId}`

    void Promise.all([
      obtenerPensionActivaDeCaballo(club, caballoId),
      obtenerPersonasActivas(club),
      obtenerConceptos(club),
    ])
      .then(([pensionCargada, personas, conceptosCargados]) => {
        if (!activo) return
        setCarga({
          clave: claveCarga,
          pension: pensionCargada,
          personas,
          conceptos: conceptosCargados,
          error: null,
        })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setCarga({
          clave: claveCarga,
          pension: null,
          personas: [],
          conceptos: [],
          error: mensajeDe(causa),
        })
      })

    return () => {
      activo = false
    }
  }, [clubId, caballo.id])

  function filaNueva(concepto?: Concepto): FilaItem {
    filaRef.current += 1
    return {
      clave: String(filaRef.current),
      conceptoId: concepto?.id ?? '',
      monto: concepto ? textoMonto(concepto.montoSugerido) : '',
    }
  }

  function abrir() {
    const responsable =
      caballo.propietarioId && opciones.some((opcion) => opcion.value === caballo.propietarioId)
        ? caballo.propietarioId
        : (opciones[0]?.value ?? '')
    setFormulario({
      clave,
      abierto: true,
      responsableId: responsable,
      dia: '10',
      inicio: fechaHoy(),
      items: conceptos[0] ? [filaNueva(conceptos[0])] : [],
    })
    setErrorAccion(null)
  }

  function cambiarItems(items: FilaItem[]) {
    if (!form) return
    setFormulario({ ...form, items })
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || ocupadoRef.current) return
    const responsableId = opciones.some((opcion) => opcion.value === form.responsableId)
      ? form.responsableId
      : (opciones[0]?.value ?? '')
    if (!responsableId) {
      setErrorAccion({ clave, mensaje: 'Elegí el responsable.' })
      return
    }
    const dia = Number(form.dia)
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
      setErrorAccion({ clave, mensaje: 'El día de vencimiento tiene que estar entre 1 y 28.' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.inicio)) {
      setErrorAccion({ clave, mensaje: 'Ingresá la fecha de inicio.' })
      return
    }

    const items = []
    for (const item of form.items) {
      if (!item.conceptoId) {
        setErrorAccion({ clave, mensaje: 'Elegí un concepto.' })
        return
      }
      const monto = leerMonto(item.monto)
      if (monto === null) {
        setErrorAccion({ clave, mensaje: 'Ingresá un monto.' })
        return
      }
      if (monto === 0) {
        setErrorAccion({ clave, mensaje: 'El monto no puede ser cero.' })
        return
      }
      items.push({ conceptoId: item.conceptoId, monto })
    }

    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      const id = await crearPensionConItems(
        clubId,
        {
          caballoId: caballo.id,
          responsableId,
          diaVencimiento: dia,
          inicio: form.inicio,
        },
        items,
      )
      if (clubIdRef.current !== clubId) return
      navigate(`/cobranza/pensiones/${id}`, { state: { aviso: 'Pensión guardada' } })
    } catch (causa) {
      if (clubIdRef.current !== clubId) return
      setErrorAccion({ clave, mensaje: mensajeDe(causa) })
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg">Pensión</h2>
      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      {cargando ? (
        <p className="mt-4 font-body text-muted" role="status">
          Cargando pensión…
        </p>
      ) : pension ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <DatoFicha etiqueta="Responsable" valor={pension.responsableNombre} />
            <DatoFicha etiqueta="Día de vencimiento" valor={String(pension.diaVencimiento)} />
            <DatoFicha etiqueta="Inicio" valor={textoFecha(pension.inicio)} />
            <DatoFicha etiqueta="Total mensual vigente" valor={pesos(pension.totalVigente)} />
          </div>
          <Button
            variant="secondary"
            className="mt-4 w-full sm:w-auto"
            onClick={() => navigate(`/cobranza/pensiones/${pension.id}`)}
          >
            Ver pensión
          </Button>
        </>
      ) : form?.abierto ? (
        <form className="mt-4 flex flex-col gap-4" noValidate onSubmit={(event) => void guardar(event)}>
          {opciones.length === 0 ? (
            <p className="font-body text-muted">No hay personas activas para asignar como responsable.</p>
          ) : (
            <Select
              id={`pension-responsable-${caballo.id}`}
              label="Responsable"
              value={
                opciones.some((opcion) => opcion.value === form.responsableId)
                  ? form.responsableId
                  : (opciones[0]?.value ?? '')
              }
              disabled={ocupado}
              options={opciones}
              onChange={(responsableId) => setFormulario({ ...form, responsableId })}
            />
          )}
          <Select
            id={`pension-dia-${caballo.id}`}
            label="Día de vencimiento"
            value={form.dia}
            disabled={ocupado}
            options={DIAS.map((dia) => ({ value: dia, label: dia }))}
            onChange={(dia) => setFormulario({ ...form, dia })}
          />
          <TextField
            id={`pension-inicio-${caballo.id}`}
            label="Inicio"
            type="date"
            value={form.inicio}
            disabled={ocupado}
            onChange={(inicio) => setFormulario({ ...form, inicio })}
          />

          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Ítems</h3>
            {form.items.length === 0 ? (
              <p className="font-body text-muted">Todavía no hay ítems.</p>
            ) : (
              form.items.map((item) => (
                <div key={item.clave} className="flex flex-col gap-3 border-t border-line pt-4">
                  <Select
                    id={`pension-concepto-${item.clave}`}
                    label="Concepto"
                    value={item.conceptoId}
                    disabled={ocupado || conceptos.length === 0}
                    options={conceptos.map((concepto) => ({
                      value: concepto.id,
                      label: concepto.nombre,
                    }))}
                    onChange={(conceptoId) => {
                      const concepto = conceptos.find((actual) => actual.id === conceptoId)
                      cambiarItems(
                        form.items.map((actual) =>
                          actual.clave === item.clave
                            ? {
                                ...actual,
                                conceptoId,
                                monto: concepto ? textoMonto(concepto.montoSugerido) : actual.monto,
                              }
                            : actual,
                        ),
                      )
                    }}
                  />
                  <TextField
                    id={`pension-monto-${item.clave}`}
                    label="Monto"
                    value={item.monto}
                    disabled={ocupado}
                    inputMode="decimal"
                    onChange={(monto) =>
                      cambiarItems(
                        form.items.map((actual) =>
                          actual.clave === item.clave ? { ...actual, monto } : actual,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto"
                    disabled={ocupado}
                    onClick={() => cambiarItems(form.items.filter((actual) => actual.clave !== item.clave))}
                  >
                    Quitar
                  </Button>
                </div>
              ))
            )}
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={ocupado || conceptos.length === 0}
              onClick={() => cambiarItems([...form.items, filaNueva(conceptos[0])])}
            >
              Agregar ítem
            </Button>
            {conceptos.length === 0 ? (
              <p className="font-body text-muted">No hay conceptos activos.</p>
            ) : null}
            <DatoFicha etiqueta="Total mensual" valor={pesos(totalItems(form.items))} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto" disabled={ocupado || opciones.length === 0}>
              Guardar pensión
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => setFormulario({ ...form, abierto: false })}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : error ? null : (
        <Button className="mt-4 w-full sm:w-auto" onClick={abrir}>
          Crear pensión
        </Button>
      )}
    </Card>
  )
}
