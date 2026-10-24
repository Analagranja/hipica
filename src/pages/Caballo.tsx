import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Avatar } from '../components/ui/Avatar.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  actualizarCaballo,
  darDeBajaCaballo,
  obtenerBoxesDisponibles,
  obtenerCaballo,
  obtenerPersonasActivas,
  reactivarCaballo,
  type BoxDisponible,
  type Caballo,
  type DatosCaballo,
  type PersonaActiva,
} from '../lib/caballos.ts'
import { prepararFoto } from '../lib/foto.ts'
import { FormularioCaballo } from './FormularioCaballo.tsx'
import {
  etiquetaEstado,
  etiquetaSexo,
  etiquetaTipo,
  textoFecha,
  textoOpcional,
  textoPropietario,
} from './texto-caballo.ts'

type Ficha = {
  clave: string
  caballo: Caballo | null
  error: string | null
}

type Edicion = {
  clave: string
  datos: DatosCaballo
}

type Opciones = {
  clave: string
  personas: PersonaActiva[]
  boxes: BoxDisponible[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function datosDe(caballo: Caballo): DatosCaballo {
  return {
    nombre: caballo.nombre,
    tipo: caballo.tipo,
    propietarioId: caballo.propietarioId ?? '',
    boxId: caballo.ubicacion?.boxId ?? '',
    nacimiento: caballo.nacimiento?.slice(0, 10) ?? '',
    raza: caballo.raza ?? '',
    pelaje: caballo.pelaje ?? '',
    sexo: caballo.sexo ?? '',
    numeroRegistro: caballo.numeroRegistro ?? '',
    observaciones: caballo.observaciones ?? '',
  }
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-body text-muted">{etiqueta}</dt>
      <dd className="font-body whitespace-pre-wrap text-ink">{valor}</dd>
    </div>
  )
}

export default function Caballo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clubActual, tieneRol } = useAuth()
  const esAdmin = tieneRol('administrador')
  const clubId = clubActual?.club_id
  const clave = clubId && id ? `${clubId}:${id}` : ''
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const [baja, setBaja] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clave: string; mensaje: string } | null>(null)
  const caballo = ficha && ficha.clave === clave ? ficha.caballo : null
  const cargando = Boolean(clave) && (!ficha || ficha.clave !== clave)
  const editando = edicion !== null && edicion.clave === clave
  const datos = editando && edicion ? edicion.datos : null
  const opcionesListas = opciones !== null && opciones.clave === clave ? opciones : null
  const confirmando = baja === clave
  const error =
    errorAccion !== null && errorAccion.clave === clave
      ? errorAccion.mensaje
      : opcionesListas?.error
        ? opcionesListas.error
        : ficha !== null && ficha.clave === clave
          ? ficha.error
          : null

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

  useEffect(() => {
    if (!clubId || !id) return
    let activo = true
    const club = clubId
    const caballoId = id
    const claveCarga = `${club}:${caballoId}`

    void obtenerCaballo(club, caballoId)
      .then((cargado) => {
        if (!activo) return
        setFicha({ clave: claveCarga, caballo: cargado, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setFicha({ clave: claveCarga, caballo: null, error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, id])

  useEffect(() => {
    if (!clubId || !id || !editando || !caballo) return
    let activo = true
    const club = clubId
    const claveCarga = `${club}:${id}`
    const boxId = caballo.ubicacion?.boxId ?? null

    void Promise.all([obtenerPersonasActivas(club), obtenerBoxesDisponibles(club, boxId)])
      .then(([personas, boxes]) => {
        if (!activo) return
        setOpciones({ clave: claveCarga, personas, boxes, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setOpciones({ clave: claveCarga, personas: [], boxes: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, id, editando, caballo])

  async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
    if (!clubId || !id || ocupadoRef.current) return false
    const clubDeLaAccion = clubId
    const caballoId = id
    const claveAccion = `${clubDeLaAccion}:${caballoId}`
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await accion()
      const fresco = await obtenerCaballo(clubDeLaAccion, caballoId)
      if (clubIdRef.current !== clubDeLaAccion) return false
      setFicha({ clave: claveAccion, caballo: fresco, error: null })
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

  async function guardar(event: FormEvent<HTMLFormElement>, foto: File | null) {
    event.preventDefault()
    if (!clubId || !id || !datos) return
    const valores = datos
    const ok = await ejecutar(async () => {
      const blob = foto ? await prepararFoto(foto) : undefined
      await actualizarCaballo(clubId, id, valores, blob)
    })
    if (ok) setEdicion(null)
  }

  if (!id) return <Navigate to="/caballos" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={caballo?.nombre ?? 'Caballo'}
        description="Ficha del caballo."
        action={
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => navigate('/caballos')}>
            Volver
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando caballo…
        </p>
      ) : !caballo ? (
        <Card>
          <p className="font-body text-muted">No se encontró el caballo.</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-col items-center gap-4">
              <Avatar nombre={caballo.nombre} src={caballo.fotoUrl} size="lg" alt={caballo.nombre} />
              {editando && datos && opcionesListas && !opcionesListas.error ? (
                <div className="w-full">
                  <FormularioCaballo
                    idPrefijo="editar-caballo"
                    valores={datos}
                    personas={opcionesListas.personas}
                    boxes={opcionesListas.boxes}
                    propietarioActual={caballo.propietario}
                    ocupado={ocupado}
                    enviar="Guardar"
                    onChange={(siguientes) => setEdicion({ clave, datos: siguientes })}
                    onSubmit={(event, foto) => void guardar(event, foto)}
                    onCancel={() => setEdicion(null)}
                  />
                </div>
              ) : editando && !opcionesListas ? (
                <p className="font-body text-muted" role="status">
                  Cargando formulario…
                </p>
              ) : editando ? (
                <Button variant="ghost" onClick={() => setEdicion(null)}>
                  Cancelar
                </Button>
              ) : (
                <dl className="grid w-full gap-4 sm:grid-cols-2">
                  <Dato etiqueta="Tipo" valor={etiquetaTipo(caballo.tipo)} />
                  <div className="flex flex-col gap-1">
                    <dt className="font-body text-muted">Estado</dt>
                    <dd>
                      <StatusBadge tone={caballo.estado === 'activo' ? 'ok' : 'danger'}>
                        {etiquetaEstado(caballo.estado)}
                      </StatusBadge>
                    </dd>
                  </div>
                  <Dato etiqueta="Propietario" valor={textoPropietario(caballo)} />
                  <Dato etiqueta="Cuadra" valor={caballo.ubicacion?.cuadraNombre ?? 'Sin cuadra'} />
                  <Dato
                    etiqueta="Box"
                    valor={caballo.ubicacion ? `Box ${caballo.ubicacion.numero}` : 'Sin box'}
                  />
                  <Dato etiqueta="Nacimiento" valor={textoFecha(caballo.nacimiento)} />
                  <Dato etiqueta="Raza" valor={textoOpcional(caballo.raza, 'Sin raza')} />
                  <Dato etiqueta="Pelaje" valor={textoOpcional(caballo.pelaje, 'Sin pelaje')} />
                  <Dato etiqueta="Sexo" valor={etiquetaSexo(caballo.sexo)} />
                  <Dato
                    etiqueta="Número de registro"
                    valor={textoOpcional(caballo.numeroRegistro, 'Sin número')}
                  />
                  <div className="sm:col-span-2">
                    <Dato
                      etiqueta="Observaciones"
                      valor={textoOpcional(caballo.observaciones, 'Sin observaciones')}
                    />
                  </div>
                </dl>
              )}
            </div>
          </Card>

          {esAdmin && !editando ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => {
                  setEdicion({ clave, datos: datosDe(caballo) })
                  setBaja(null)
                  setErrorAccion(null)
                }}
              >
                Editar
              </Button>
              {caballo.estado === 'activo' ? (
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={ocupado}
                  onClick={() => setBaja(clave)}
                >
                  Dar de baja
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(() => {
                      if (!clubId) return Promise.resolve()
                      return reactivarCaballo(clubId, caballo.id)
                    })
                  }
                >
                  Reactivar
                </Button>
              )}
            </div>
          ) : null}

          {esAdmin && confirmando ? (
            <Card>
              <p className="font-body text-ink">
                Se va a dar de baja a {caballo.nombre} y queda sin box.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full sm:w-auto"
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(() => {
                      if (!clubId) return Promise.resolve()
                      return darDeBajaCaballo(clubId, caballo.id)
                    }).then((ok) => {
                      if (ok) setBaja(null)
                    })
                  }
                >
                  Confirmar baja
                </Button>
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto"
                  disabled={ocupado}
                  onClick={() => setBaja(null)}
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
