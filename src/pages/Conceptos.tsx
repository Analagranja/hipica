import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { Tag } from '../components/ui/Tag.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  actualizarConcepto,
  cambiarActivoConcepto,
  crearConcepto,
  etiquetaCategoria,
  obtenerConceptos,
  pesos,
  type CategoriaConcepto,
  type Concepto,
} from '../lib/cobranza.ts'
import { leerMonto, textoMonto } from './texto-monto.ts'

const CATEGORIAS: CategoriaConcepto[] = [
  'pension',
  'derecho_pista',
  'alimentacion',
  'herraje',
  'sanidad',
  'alquiler_pista',
  'clase',
  'otro',
]

type DatosFormulario = {
  nombre: string
  categoria: CategoriaConcepto
  monto: string
}

const VACIO: DatosFormulario = {
  nombre: '',
  categoria: 'otro',
  monto: '',
}

type Lista = {
  clubId: string
  conceptos: Concepto[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function esCategoria(valor: string): valor is CategoriaConcepto {
  return CATEGORIAS.some((categoria) => categoria === valor)
}

function datosDe(concepto: Concepto): DatosFormulario {
  return {
    nombre: concepto.nombre,
    categoria: concepto.categoria,
    monto: textoMonto(concepto.montoSugerido),
  }
}

export default function Conceptos() {
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [lista, setLista] = useState<Lista | null>(null)
  const [formulario, setFormulario] = useState<{
    clubId: string
    abierto: boolean
    datos: DatosFormulario
  } | null>(null)
  const [edicion, setEdicion] = useState<{
    clubId: string
    id: string
    datos: DatosFormulario
  } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clubId: string; mensaje: string } | null>(null)

  const conceptos = lista && lista.clubId === clubId ? lista.conceptos : []
  const cargando = Boolean(clubId) && (!lista || lista.clubId !== clubId)
  const creando = formulario !== null && formulario.clubId === clubId && formulario.abierto
  const datosNuevos = formulario !== null && formulario.clubId === clubId ? formulario.datos : VACIO
  const error =
    errorAccion !== null && errorAccion.clubId === clubId
      ? errorAccion.mensaje
      : lista !== null && lista.clubId === clubId
        ? lista.error
        : null

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

  useEffect(() => {
    if (!clubId) return
    let activo = true
    const club = clubId

    void obtenerConceptos(club)
      .then((conceptosCargados) => {
        if (!activo) return
        setLista({ clubId: club, conceptos: conceptosCargados, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clubId: club, conceptos: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId])

  function informarError(mensaje: string) {
    if (!clubId) return
    setErrorAccion({ clubId, mensaje })
  }

  async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
    if (!clubId || ocupadoRef.current) return false
    const clubDeLaAccion = clubId
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await accion()
      const conceptosCargados = await obtenerConceptos(clubDeLaAccion)
      if (clubIdRef.current !== clubDeLaAccion) return false
      setLista({ clubId: clubDeLaAccion, conceptos: conceptosCargados, error: null })
      return true
    } catch (causa) {
      if (clubIdRef.current === clubDeLaAccion) {
        setErrorAccion({ clubId: clubDeLaAccion, mensaje: mensajeDe(causa) })
      }
      return false
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  function montoDe(datos: DatosFormulario): number | null {
    if (!datos.nombre.trim()) {
      informarError('Ingresá el nombre.')
      return null
    }
    const monto = leerMonto(datos.monto)
    if (monto === null) {
      informarError('Ingresá el monto sugerido.')
      return null
    }
    return monto
  }

  async function guardarNuevo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId) return
    const monto = montoDe(datosNuevos)
    if (monto === null) return
    const ok = await ejecutar(() =>
      crearConcepto(clubId, {
        nombre: datosNuevos.nombre,
        categoria: datosNuevos.categoria,
        montoSugerido: monto,
      }),
    )
    if (ok) setFormulario({ clubId, abierto: false, datos: VACIO })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          disabled={ocupado}
          onClick={() => {
            if (!clubId) return
            setFormulario({
              clubId,
              abierto: !creando,
              datos: creando ? VACIO : datosNuevos,
            })
            setEdicion(null)
            setErrorAccion(null)
          }}
        >
          Nuevo concepto
        </Button>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {creando ? (
        <Card>
          <FormularioConcepto
            idPrefijo="nuevo-concepto"
            datos={datosNuevos}
            ocupado={ocupado}
            enviar="Crear concepto"
            onChange={(datos) => {
              if (!clubId) return
              setFormulario({ clubId, abierto: true, datos })
            }}
            onSubmit={(event) => void guardarNuevo(event)}
            onCancel={() => {
              if (!clubId) return
              setFormulario({ clubId, abierto: false, datos: VACIO })
            }}
          />
        </Card>
      ) : null}

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando conceptos…
        </p>
      ) : conceptos.length === 0 ? (
        <Card>
          <p className="font-body text-muted">Todavía no hay conceptos.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {conceptos.map((concepto) => {
            const editandoEste =
              edicion !== null && edicion.clubId === clubId && edicion.id === concepto.id
            return (
              <Card key={concepto.id}>
                {editandoEste && edicion ? (
                  <FormularioConcepto
                    idPrefijo={`concepto-${concepto.id}`}
                    datos={edicion.datos}
                    ocupado={ocupado}
                    enviar="Guardar"
                    onChange={(datos) => {
                      if (!clubId) return
                      setEdicion({ clubId, id: concepto.id, datos })
                    }}
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!clubId) return
                      const monto = montoDe(edicion.datos)
                      if (monto === null) return
                      void ejecutar(() =>
                        actualizarConcepto(clubId, concepto.id, {
                          nombre: edicion.datos.nombre,
                          categoria: edicion.datos.categoria,
                          montoSugerido: monto,
                        }),
                      ).then((ok) => {
                        if (ok) setEdicion(null)
                      })
                    }}
                    onCancel={() => setEdicion(null)}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg">{concepto.nombre}</h2>
                      <Tag>{etiquetaCategoria(concepto.categoria)}</Tag>
                      <StatusBadge tone={concepto.activo ? 'ok' : 'warn'}>
                        {concepto.activo ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </div>
                    <p className="font-body text-ink">{pesos(concepto.montoSugerido)}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="w-full sm:w-auto"
                        disabled={ocupado}
                        onClick={() => {
                          if (!clubId) return
                          setEdicion({ clubId, id: concepto.id, datos: datosDe(concepto) })
                          setFormulario((actual) =>
                            actual?.clubId === clubId
                              ? { clubId, abierto: false, datos: VACIO }
                              : actual,
                          )
                          setErrorAccion(null)
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        disabled={ocupado}
                        onClick={() => {
                          if (!clubId) return
                          void ejecutar(() =>
                            cambiarActivoConcepto(clubId, concepto.id, !concepto.activo),
                          )
                        }}
                      >
                        {concepto.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

type FormularioProps = {
  idPrefijo: string
  datos: DatosFormulario
  ocupado: boolean
  enviar: string
  onChange: (datos: DatosFormulario) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

function FormularioConcepto({
  idPrefijo,
  datos,
  ocupado,
  enviar,
  onChange,
  onSubmit,
  onCancel,
}: FormularioProps) {
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <TextField
        id={`${idPrefijo}-nombre`}
        label="Nombre"
        value={datos.nombre}
        disabled={ocupado}
        onChange={(nombre) => onChange({ ...datos, nombre })}
      />
      <div className="flex flex-col gap-2">
        <Select
          id={`${idPrefijo}-categoria`}
          label="Categoría"
          value={datos.categoria}
          disabled={ocupado}
          options={CATEGORIAS.map((categoria) => ({
            value: categoria,
            label: etiquetaCategoria(categoria),
          }))}
          onChange={(valor) => {
            if (esCategoria(valor)) onChange({ ...datos, categoria: valor })
          }}
        />
        <p className="font-body text-muted">
          Sirve para agrupar en los reportes, por ejemplo cuánto ingresó por derecho de pista
        </p>
      </div>
      <TextField
        id={`${idPrefijo}-monto`}
        label="Monto sugerido"
        value={datos.monto}
        disabled={ocupado}
        inputMode="decimal"
        onChange={(monto) => onChange({ ...datos, monto })}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
          {enviar}
        </Button>
        <Button variant="ghost" className="w-full sm:w-auto" disabled={ocupado} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
