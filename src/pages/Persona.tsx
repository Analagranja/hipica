import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Avatar } from '../components/ui/Avatar.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { MetricCard } from '../components/ui/MetricCard.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { useAuth } from '../context/auth-state.ts'
import { obtenerCaballosDePropietario, type Caballo } from '../lib/caballos.ts'
import {
  etiquetaEstadoPension,
  obtenerPensionesDeResponsable,
  pesos,
  type PensionLista,
} from '../lib/cobranza.ts'
import {
  etiquetaEstadoCobro,
  obtenerCargosDePersonaConSaldo,
  obtenerPagos,
  obtenerSaldosPersona,
  textoRecibo,
  type CargoSaldo,
  type PagoLista,
  type SaldosPersona,
} from '../lib/pagos.ts'
import {
  actualizarPersona,
  cambiarActivaPersona,
  cancelarInvitacion,
  invitarPersona,
  obtenerPersona,
  type PersonaClub,
} from '../lib/personas.ts'
import { type Rol } from '../lib/roles.ts'
import { etiquetaEstado, textoFecha, textoOpcional, textoPeriodo, textoUbicacion } from './texto-caballo.ts'
import { aCentavos } from './texto-monto.ts'
import {
  datosDe,
  enlaceInvitacion,
  enlaceWhatsapp,
  ETIQUETA,
  FormularioPersona,
  mensajeDe,
  nombreCompleto,
} from './Personas.tsx'

type Ficha = {
  caballos: Caballo[]
  pensiones: PensionLista[]
  cargos: CargoSaldo[]
  pagos: PagoLista[]
  saldos: SaldosPersona
}

type Carga = Ficha & {
  clave: string
  persona: PersonaClub | null
  error: string | null
}

const FICHA_VACIA: Ficha = {
  caballos: [],
  pensiones: [],
  cargos: [],
  pagos: [],
  saldos: { deuda: 0, deudaVencida: 0, saldoAFavor: 0 },
}

async function cargarFicha(club: string, personaId: string): Promise<Ficha> {
  const [caballos, pensiones, cargos, pagos, saldos] = await Promise.all([
    obtenerCaballosDePropietario(club, personaId),
    obtenerPensionesDeResponsable(club, personaId),
    obtenerCargosDePersonaConSaldo(club, personaId),
    obtenerPagos(club, personaId),
    obtenerSaldosPersona(club, personaId),
  ])
  return { caballos, pensiones, cargos, pagos, saldos }
}

function textoAcceso(persona: PersonaClub): string {
  if (persona.acceso === 'con-acceso') return 'Con acceso'
  if (persona.acceso === 'pendiente') return 'Invitación pendiente'
  return 'Sin acceso'
}

function textoRoles(roles: Rol[]): string {
  if (roles.length === 0) return 'Sin roles'
  return roles.map((rol) => ETIQUETA[rol]).join(', ')
}

export default function Persona() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clubActual, tieneRol } = useAuth()
  const esAdmin = tieneRol('administrador')
  const clubId = clubActual?.club_id
  const personaActualId = clubActual?.persona_id ?? ''
  const clubNombre = clubActual?.club.nombre ?? 'el club'
  const clave = clubId && id ? `${clubId}:${id}` : ''
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clave: string; mensaje: string } | null>(null)

  const lista = carga && carga.clave === clave ? carga : null
  const persona = lista?.persona ?? null
  const cargando = Boolean(clave) && esAdmin && !lista
  const error =
    errorAccion !== null && errorAccion.clave === clave ? errorAccion.mensaje : lista?.error ?? null
  const propia = persona?.id === personaActualId

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

  useEffect(() => {
    if (!clubId || !id || !esAdmin) return
    let activo = true
    const club = clubId
    const personaId = id
    const claveCarga = `${club}:${personaId}`

    void obtenerPersona(club, personaId)
      .then(async (personaCargada) => {
        if (!activo) return null
        if (!personaCargada) {
          setCarga({ clave: claveCarga, persona: null, ...FICHA_VACIA, error: null })
          return null
        }
        const ficha = await cargarFicha(club, personaId)
        return { persona: personaCargada, ...ficha }
      })
      .then((resultado) => {
        if (!activo || !resultado) return
        setCarga({ clave: claveCarga, ...resultado, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setCarga({ clave: claveCarga, persona: null, ...FICHA_VACIA, error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, id, esAdmin])

  async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
    if (!clubId || !id || ocupadoRef.current) return false
    const clubDeLaAccion = clubId
    const personaId = id
    const claveAccion = `${clubDeLaAccion}:${personaId}`
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await accion()
      const personaCargada = await obtenerPersona(clubDeLaAccion, personaId)
      const ficha = personaCargada ? await cargarFicha(clubDeLaAccion, personaId) : FICHA_VACIA
      if (clubIdRef.current !== clubDeLaAccion) return false
      setCarga({
        clave: claveAccion,
        persona: personaCargada,
        ...ficha,
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

  if (!esAdmin) return <Navigate to="/" replace />
  if (!id) return <Navigate to="/personas" replace />

  const invitacion = persona?.invitacion ?? null
  const url = invitacion ? enlaceInvitacion(invitacion.token) : ''
  const mensajeInvitacion = `Hola, te invito a ${clubNombre}. Entrá a la app con este enlace: ${url}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={persona ? nombreCompleto(persona) : 'Persona'}
        description="Ficha de la persona."
        action={
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => navigate('/personas')}>
            Volver
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando persona…
        </p>
      ) : !persona || !lista ? (
        <Card>
          <p className="font-body text-muted">No se encontró la persona.</p>
        </Card>
      ) : (
        <>
          {editando === clave ? null : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DatoFicha etiqueta="Nombre" valor={persona.nombre} />
              <DatoFicha etiqueta="Apellido" valor={textoOpcional(persona.apellido, 'Sin apellido')} />
              <DatoFicha etiqueta="Teléfono" valor={textoOpcional(persona.telefono, 'Sin teléfono')} />
              <DatoFicha etiqueta="Correo" valor={textoOpcional(persona.email, 'Sin correo')} />
              <DatoFicha etiqueta="Documento" valor={textoOpcional(persona.documento, 'Sin documento')} />
              <DatoFicha etiqueta="Roles" valor={textoRoles(persona.roles)} />
              <DatoFicha etiqueta="Estado" valor={persona.activa ? 'Activa' : 'Inactiva'} />
              <DatoFicha etiqueta="Acceso" valor={textoAcceso(persona)} />
            </div>
          )}

          <EditorPersona
            key={persona.id}
            persona={persona}
            propia={propia}
            personaActualId={personaActualId}
            clubId={clubId ?? ''}
            ocupado={ocupado}
            editando={editando === clave}
            onEditando={(abierto) => setEditando(abierto ? clave : null)}
            onEjecutar={ejecutar}
            onError={(mensaje) => setErrorAccion({ clave, mensaje })}
          />

          {persona.acceso === 'sin-acceso' && !persona.email ? (
            <p className="font-body text-muted">Agregá un correo para invitarla a la app.</p>
          ) : null}

          {invitacion ? (
            <Card>
              <div className="flex flex-col gap-3">
                <p className="font-body break-all text-ink">{url}</p>
                {copiado === clave ? (
                  <p className="font-body text-ok-text" role="status">
                    Enlace copiado.
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                      void navigator.clipboard.writeText(url).then(
                        () => setCopiado(clave),
                        () => setErrorAccion({ clave, mensaje: 'No se pudo copiar el enlace.' }),
                      )
                    }}
                  >
                    Copiar enlace
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      window.open(
                        enlaceWhatsapp(persona.telefono, mensajeInvitacion),
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  >
                    WhatsApp
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto"
                    disabled={ocupado}
                    onClick={() => {
                      setCopiado(null)
                      void ejecutar(() => cancelarInvitacion(clubId ?? '', invitacion.id))
                    }}
                  >
                    Cancelar invitación
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-lg">Caballos</h2>
            {lista.caballos.length === 0 ? (
              <p className="font-body text-muted">No tiene caballos.</p>
            ) : (
              lista.caballos.map((caballo) => (
                <Card key={caballo.id}>
                  <Link
                    to={`/caballos/${caballo.id}`}
                    className="flex items-center gap-3 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
                  >
                    <Avatar nombre={caballo.nombre} src={caballo.fotoUrl} alt={caballo.nombre} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg">{caballo.nombre}</h3>
                        <StatusBadge tone={caballo.estado === 'activo' ? 'ok' : 'danger'}>
                          {etiquetaEstado(caballo.estado)}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 font-body text-muted">{textoUbicacion(caballo)}</p>
                    </div>
                  </Link>
                </Card>
              ))
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg">Pensiones a su cargo</h2>
            {lista.pensiones.length === 0 ? (
              <p className="font-body text-muted">No tiene pensiones a su cargo.</p>
            ) : (
              lista.pensiones.map((pension) => (
                <Card key={pension.id}>
                  <Link
                    to={`/cobranza/pensiones/${pension.id}`}
                    className="block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg">{pension.caballoNombre}</h3>
                      <StatusBadge tone={pension.estado === 'activa' ? 'ok' : 'warn'}>
                        {etiquetaEstadoPension(pension.estado)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 font-body text-ink">{pesos(pension.totalVigente)}</p>
                  </Link>
                </Card>
              ))
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg">Cargos</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <MetricCard label="Deuda" value={pesos(lista.saldos.deuda)} />
              <MetricCard label="Deuda vencida" value={pesos(lista.saldos.deudaVencida)} />
              <MetricCard label="Saldo a favor" value={pesos(lista.saldos.saldoAFavor)} />
            </div>
            {lista.cargos.length === 0 ? (
              <p className="font-body text-muted">No tiene cargos.</p>
            ) : (
              lista.cargos.map((cargo) => (
                <Card key={cargo.id}>
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <DatoFicha etiqueta="Período" valor={textoPeriodo(cargo.periodo)} />
                      <DatoFicha etiqueta="Descripción" valor={cargo.descripcion ?? 'Cargo'} />
                      <DatoFicha etiqueta="Total" valor={pesos(cargo.total)} />
                      <DatoFicha etiqueta="Pagado" valor={pesos(cargo.pagado)} />
                      <DatoFicha etiqueta="Saldo" valor={pesos(cargo.saldo)} />
                      <DatoFicha etiqueta="Vencimiento" valor={textoFecha(cargo.vencimiento)} />
                      <DatoFicha etiqueta="Estado" valor={etiquetaEstadoCobro(cargo.estadoCobro)} />
                    </div>
                    {cargo.estado !== 'anulado' && aCentavos(cargo.saldo) > 0 ? (
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() =>
                          navigate(`/cobranza/pagos/nuevo?persona=${persona.id}&cargo=${cargo.id}`)
                        }
                      >
                        Registrar pago
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg">Pagos</h2>
              <Button
                className="w-full sm:w-auto"
                onClick={() => navigate(`/cobranza/pagos/nuevo?persona=${persona.id}`)}
              >
                Registrar pago
              </Button>
            </div>
            {lista.pagos.length === 0 ? (
              <p className="font-body text-muted">No tiene pagos.</p>
            ) : (
              lista.pagos.slice(0, 10).map((pago) => (
                <Card key={pago.id}>
                  <Link
                    to={`/cobranza/pagos/${pago.id}`}
                    className="block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <DatoFicha etiqueta="Recibo" valor={`N.º ${textoRecibo(pago.numeroRecibo)}`} />
                      <DatoFicha etiqueta="Fecha" valor={textoFecha(pago.fecha)} />
                      <DatoFicha etiqueta="Monto" valor={pesos(pago.monto)} />
                      <DatoFicha etiqueta="Estado" valor={pago.estado === 'anulado' ? 'Anulado' : 'Confirmado'} />
                    </div>
                  </Link>
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </div>
  )
}

type EditorProps = {
  persona: PersonaClub
  propia: boolean
  personaActualId: string
  clubId: string
  ocupado: boolean
  editando: boolean
  onEditando: (abierto: boolean) => void
  onEjecutar: (accion: () => Promise<unknown>) => Promise<boolean>
  onError: (mensaje: string) => void
}

function EditorPersona({
  persona,
  propia,
  personaActualId,
  clubId,
  ocupado,
  editando,
  onEditando,
  onEjecutar,
  onError,
}: EditorProps) {
  const [datos, setDatos] = useState(() => datosDe(persona))

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!datos.nombre.trim()) {
      onError('Ingresá el nombre.')
      return
    }
    const roles =
      propia && !datos.roles.includes('administrador')
        ? (['administrador', ...datos.roles] as Rol[])
        : datos.roles
    const ok = await onEjecutar(() =>
      actualizarPersona(clubId, persona.id, personaActualId, { ...datos, roles }),
    )
    if (ok) onEditando(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {editando ? (
        <Card>
          <FormularioPersona
            idPrefijo={`editar-${persona.id}`}
            datos={datos}
            propia={propia}
            ocupado={ocupado}
            enviar="Guardar"
            onChange={setDatos}
            onSubmit={(event) => void guardar(event)}
            onCancel={() => {
              setDatos(datosDe(persona))
              onEditando(false)
            }}
          />
        </Card>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          disabled={ocupado}
          onClick={() => {
            setDatos(datosDe(persona))
            onEditando(true)
          }}
        >
          Editar
        </Button>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={ocupado || (propia && persona.activa)}
          onClick={() =>
            void onEjecutar(() =>
              cambiarActivaPersona(clubId, persona.id, personaActualId, !persona.activa),
            )
          }
        >
          {persona.activa ? 'Desactivar' : 'Activar'}
        </Button>
        {persona.acceso === 'sin-acceso' && persona.email ? (
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={ocupado}
            onClick={() => {
              if (!persona.email) return
              void onEjecutar(() => invitarPersona(clubId, persona.id, persona.email ?? ''))
            }}
          >
            Invitar a la app
          </Button>
        ) : null}
      </div>
    </div>
  )
}
