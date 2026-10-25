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
  crearPension,
  fechaHoy,
  obtenerPensionActivaDeCaballo,
  pesos,
  type PensionResumen,
} from '../lib/cobranza.ts'
import { etiquetaPersona, textoFecha } from './texto-caballo.ts'

type Carga = {
  clave: string
  pension: PensionResumen | null
  personas: PersonaActiva[]
  error: string | null
}

type Formulario = {
  clave: string
  abierto: boolean
  responsableId: string
  dia: string
  inicio: string
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

export function SeccionPension({ clubId, caballo }: { clubId: string; caballo: Caballo }) {
  const navigate = useNavigate()
  const clave = `${clubId}:${caballo.id}`
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clave: string; mensaje: string } | null>(null)

  const lista = carga && carga.clave === clave ? carga : null
  const cargando = !lista
  const pension = lista?.pension ?? null
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
    ])
      .then(([pensionCargada, personas]) => {
        if (!activo) return
        setCarga({ clave: claveCarga, pension: pensionCargada, personas, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setCarga({ clave: claveCarga, pension: null, personas: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, caballo.id])

  async function recargar(): Promise<PensionResumen | null> {
    const pensionCargada = await obtenerPensionActivaDeCaballo(clubId, caballo.id)
    const personas = carga?.clave === clave ? carga.personas : await obtenerPersonasActivas(clubId)
    if (clubIdRef.current !== clubId) return pensionCargada
    setCarga({ clave, pension: pensionCargada, personas, error: null })
    return pensionCargada
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
    })
    setErrorAccion(null)
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

    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await crearPension(clubId, {
        caballoId: caballo.id,
        responsableId,
        diaVencimiento: dia,
        inicio: form.inicio,
      })
      if (clubIdRef.current !== clubId) return
      await recargar()
      setFormulario({ ...form, abierto: false })
    } catch (causa) {
      if (clubIdRef.current !== clubId) return
      const mensaje = mensajeDe(causa)
      if (mensaje === 'Este caballo ya tiene una pensión activa') {
        try {
          await recargar()
          setFormulario({ ...form, abierto: false })
        } catch {
          // La pensión ya existe; el mensaje de abajo lo explica si no se puede releer.
        }
      }
      setErrorAccion({ clave, mensaje })
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
            <DatoFicha etiqueta="Total vigente" valor={pesos(pension.totalVigente)} />
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto" disabled={ocupado || opciones.length === 0}>
              Crear pensión
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
