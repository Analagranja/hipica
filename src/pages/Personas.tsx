import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Checkbox } from '../components/ui/Checkbox.tsx'
import { Disclosure } from '../components/ui/Disclosure.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { Tag } from '../components/ui/Tag.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  actualizarPersona,
  cambiarActivaPersona,
  cancelarInvitacion,
  crearPersona,
  invitarPersona,
  obtenerPersonas,
  type DatosPersona,
  type PersonaClub,
} from '../lib/personas.ts'
import { type Rol } from '../lib/roles.ts'

const ETIQUETA: Record<Rol, string> = {
  administrador: 'Administrador',
  profesor: 'Profesor',
  caballerizo: 'Caballerizo',
  propietario: 'Propietario',
  alumno: 'Alumno',
}

const ROLES = Object.keys(ETIQUETA) as Rol[]

const VACIO: DatosPersona = {
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
  documento: '',
  roles: [],
}

const SIN_ABIERTAS = new Set<string>()

type ListaPersonas = {
  clubId: string
  personas: PersonaClub[]
  error: string | null
}

type Ejecutar = (accion: () => Promise<unknown>) => Promise<boolean>

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function nombreCompleto(persona: PersonaClub): string {
  return [persona.nombre, persona.apellido].filter(Boolean).join(' ')
}

function datosDe(persona: PersonaClub): DatosPersona {
  return {
    nombre: persona.nombre,
    apellido: persona.apellido ?? '',
    telefono: persona.telefono ?? '',
    email: persona.email ?? '',
    documento: persona.documento ?? '',
    roles: persona.roles,
  }
}

function enlaceInvitacion(token: string): string {
  return `${window.location.origin}/invitacion/${token}`
}

function enlaceWhatsapp(telefono: string | null, mensaje: string): string {
  const texto = encodeURIComponent(mensaje)
  const numero = (telefono ?? '').replace(/\D/g, '')
  if (!numero) return `https://wa.me/?text=${texto}`
  return `https://wa.me/${numero}?text=${texto}`
}

export default function Personas() {
  const { clubActual, tieneRol } = useAuth()
  const esAdmin = tieneRol('administrador')
  const clubId = clubActual?.club_id
  const personaActualId = clubActual?.persona_id
  const clubNombre = clubActual?.club.nombre ?? 'el club'
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [lista, setLista] = useState<ListaPersonas | null>(null)
  const [paneles, setPaneles] = useState<{ clubId: string; ids: Set<string> } | null>(null)
  const [formulario, setFormulario] = useState<{
    clubId: string
    abierto: boolean
    datos: DatosPersona
  } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | Rol>('todos')
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clubId: string; mensaje: string } | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  const personas = lista && lista.clubId === clubId ? lista.personas : []
  const cargandoLista = Boolean(clubId) && esAdmin && (!lista || lista.clubId !== clubId)
  const creando = formulario !== null && formulario.clubId === clubId && formulario.abierto
  const datosNuevos =
    formulario !== null && formulario.clubId === clubId ? formulario.datos : VACIO
  const abiertas = paneles !== null && paneles.clubId === clubId ? paneles.ids : SIN_ABIERTAS
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
    if (!clubId || !esAdmin) return
    let activo = true
    const club = clubId

    void obtenerPersonas(club)
      .then((personasCargadas) => {
        if (!activo) return
        setLista({ clubId: club, personas: personasCargadas, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clubId: club, personas: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, esAdmin])

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
      const personasCargadas = await obtenerPersonas(clubDeLaAccion)
      if (clubIdRef.current !== clubDeLaAccion) return false
      setLista({ clubId: clubDeLaAccion, personas: personasCargadas, error: null })
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

  async function guardarNueva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId) return
    if (!datosNuevos.nombre.trim()) {
      informarError('Ingresá el nombre.')
      return
    }
    const ok = await ejecutar(() => crearPersona(clubId, datosNuevos))
    if (ok) setFormulario({ clubId, abierto: false, datos: VACIO })
  }

  function abrir(personaId: string) {
    if (!clubId) return
    setPaneles((actual) => {
      const base = actual?.clubId === clubId ? actual.ids : new Set<string>()
      const siguiente = new Set(base)
      siguiente.add(personaId)
      return { clubId, ids: siguiente }
    })
  }

  function alternar(personaId: string) {
    if (!clubId) return
    setPaneles((actual) => {
      const base = actual?.clubId === clubId ? actual.ids : new Set<string>()
      const siguiente = new Set(base)
      if (siguiente.has(personaId)) siguiente.delete(personaId)
      else siguiente.add(personaId)
      return { clubId, ids: siguiente }
    })
  }

  const texto = busqueda.trim().toLocaleLowerCase('es')
  const visibles = personas.filter((persona) => {
    const nombre = nombreCompleto(persona).toLocaleLowerCase('es')
    const coincideNombre = !texto || nombre.includes(texto)
    const coincideRol = filtro === 'todos' || persona.roles.includes(filtro)
    return coincideNombre && coincideRol
  })

  if (!esAdmin) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Personas"
        description="Personas del club y su acceso a la app."
        action={
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
              setErrorAccion(null)
            }}
          >
            Nueva persona
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {creando ? (
        <Card>
          <FormularioPersona
            idPrefijo="nueva"
            datos={datosNuevos}
            propia={false}
            ocupado={ocupado}
            enviar="Crear persona"
            onChange={(datos) => {
              if (!clubId) return
              setFormulario({ clubId, abierto: true, datos })
            }}
            onSubmit={(event) => void guardarNueva(event)}
            onCancel={() => {
              if (!clubId) return
              setFormulario({ clubId, abierto: false, datos: VACIO })
            }}
          />
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <TextField
          id="buscar-persona"
          label="Buscar por nombre"
          value={busqueda}
          onChange={setBusqueda}
        />
        <Select
          id="filtro-rol"
          label="Rol"
          value={filtro}
          onChange={(valor) => setFiltro(valor as 'todos' | Rol)}
          options={[
            { value: 'todos', label: 'Todos los roles' },
            ...ROLES.map((rol) => ({ value: rol, label: ETIQUETA[rol] })),
          ]}
        />
      </div>

      {cargandoLista ? (
        <p className="font-body text-muted" role="status">
          Cargando personas…
        </p>
      ) : personas.length === 0 ? (
        <Card>
          <p className="font-body text-muted">Todavía no hay personas.</p>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay personas con ese criterio.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibles.map((persona) => (
            <FilaPersona
              key={persona.id}
              persona={persona}
              abierta={abiertas.has(persona.id)}
              propia={persona.id === personaActualId}
              personaActualId={personaActualId ?? ''}
              clubId={clubId ?? ''}
              clubNombre={clubNombre}
              ocupado={ocupado}
              copiado={copiadoId === persona.id}
              onToggle={() => alternar(persona.id)}
              onAbrir={() => abrir(persona.id)}
              onEjecutar={ejecutar}
              onError={informarError}
              onCopiado={() => setCopiadoId(persona.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type FormularioProps = {
  idPrefijo: string
  datos: DatosPersona
  propia: boolean
  ocupado: boolean
  enviar: string
  onChange: (datos: DatosPersona) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

function FormularioPersona({
  idPrefijo,
  datos,
  propia,
  ocupado,
  enviar,
  onChange,
  onSubmit,
  onCancel,
}: FormularioProps) {
  function alternarRol(rol: Rol, marcado: boolean) {
    if (propia && rol === 'administrador') return
    const roles = marcado
      ? [...datos.roles, rol]
      : datos.roles.filter((actual) => actual !== rol)
    onChange({ ...datos, roles })
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <TextField
        id={`${idPrefijo}-nombre`}
        label="Nombre"
        autoComplete="given-name"
        value={datos.nombre}
        disabled={ocupado}
        onChange={(nombre) => onChange({ ...datos, nombre })}
      />
      <TextField
        id={`${idPrefijo}-apellido`}
        label="Apellido"
        autoComplete="family-name"
        value={datos.apellido}
        disabled={ocupado}
        onChange={(apellido) => onChange({ ...datos, apellido })}
      />
      <TextField
        id={`${idPrefijo}-telefono`}
        label="Teléfono"
        autoComplete="tel"
        value={datos.telefono}
        disabled={ocupado}
        onChange={(telefono) => onChange({ ...datos, telefono })}
      />
      <TextField
        id={`${idPrefijo}-email`}
        label="Correo"
        autoComplete="email"
        value={datos.email}
        disabled={ocupado}
        onChange={(email) => onChange({ ...datos, email })}
      />
      <TextField
        id={`${idPrefijo}-documento`}
        label="Documento"
        value={datos.documento}
        disabled={ocupado}
        onChange={(documento) => onChange({ ...datos, documento })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-body text-ink">Roles</legend>
        {ROLES.map((rol) => (
          <Checkbox
            key={rol}
            id={`${idPrefijo}-${rol}`}
            label={ETIQUETA[rol]}
            checked={datos.roles.includes(rol) || (propia && rol === 'administrador')}
            disabled={ocupado || (propia && rol === 'administrador')}
            onChange={(marcado) => alternarRol(rol, marcado)}
          />
        ))}
      </fieldset>
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

type FilaProps = {
  persona: PersonaClub
  abierta: boolean
  propia: boolean
  personaActualId: string
  clubId: string
  clubNombre: string
  ocupado: boolean
  copiado: boolean
  onToggle: () => void
  onAbrir: () => void
  onEjecutar: Ejecutar
  onError: (mensaje: string) => void
  onCopiado: () => void
}

function FilaPersona({
  persona,
  abierta,
  propia,
  personaActualId,
  clubId,
  clubNombre,
  ocupado,
  copiado,
  onToggle,
  onAbrir,
  onEjecutar,
  onError,
  onCopiado,
}: FilaProps) {
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState<DatosPersona>(() => datosDe(persona))

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
      actualizarPersona(clubId, persona.id, personaActualId, {
        ...datos,
        roles,
      }),
    )
    if (ok) setEditando(false)
  }

  const invitacion = persona.invitacion
  const url = invitacion ? enlaceInvitacion(invitacion.token) : ''
  const mensaje = `Hola, te invito a ${clubNombre}. Entrá a la app con este enlace: ${url}`

  return (
    <Disclosure
      title={nombreCompleto(persona)}
      open={abierta}
      onToggle={onToggle}
      detail={
        <>
          <StatusBadge tone={persona.activa ? 'ok' : 'warn'}>
            {persona.activa ? 'Activa' : 'Inactiva'}
          </StatusBadge>
          {persona.acceso === 'con-acceso' ? <StatusBadge tone="ok">Con acceso</StatusBadge> : null}
          {persona.acceso === 'pendiente' ? (
            <StatusBadge tone="warn">Invitación pendiente</StatusBadge>
          ) : null}
          {persona.acceso === 'sin-acceso' ? <Tag>Sin acceso</Tag> : null}
          {persona.roles.length === 0 ? (
            <span className="font-body text-muted">Sin roles</span>
          ) : (
            persona.roles.map((rol) => <Tag key={rol}>{ETIQUETA[rol]}</Tag>)
          )}
          <span className="font-body text-muted">{persona.telefono ?? 'Sin teléfono'}</span>
        </>
      }
      actions={
        <>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={ocupado}
            onClick={() => {
              setDatos(datosDe(persona))
              setEditando(true)
              onAbrir()
            }}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
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
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => {
                if (!persona.email) return
                onAbrir()
                void onEjecutar(() => invitarPersona(clubId, persona.id, persona.email ?? ''))
              }}
            >
              Invitar a la app
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="font-body text-muted">
          {persona.email ? persona.email : 'Sin correo'}
          {persona.documento ? ` · ${persona.documento}` : ''}
        </p>

        {persona.acceso === 'sin-acceso' && !persona.email ? (
          <p className="font-body text-muted">Agregá un correo para invitarla a la app.</p>
        ) : null}

        {invitacion ? (
          <div className="flex flex-col gap-3">
            <p className="font-body break-all text-ink">{url}</p>
            {copiado ? (
              <p className="font-body text-ok-text" role="status">
                Enlace copiado.
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  void navigator.clipboard.writeText(url).then(
                    () => onCopiado(),
                    () => onError('No se pudo copiar el enlace.'),
                  )
                }}
              >
                Copiar enlace
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() =>
                  window.open(enlaceWhatsapp(persona.telefono, mensaje), '_blank', 'noopener,noreferrer')
                }
              >
                WhatsApp
              </Button>
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => void onEjecutar(() => cancelarInvitacion(clubId, invitacion.id))}
              >
                Cancelar invitación
              </Button>
            </div>
          </div>
        ) : null}

        {editando ? (
          <FormularioPersona
            idPrefijo={persona.id}
            datos={datos}
            propia={propia}
            ocupado={ocupado}
            enviar="Guardar"
            onChange={setDatos}
            onSubmit={(event) => void guardar(event)}
            onCancel={() => {
              setDatos(datosDe(persona))
              setEditando(false)
            }}
          />
        ) : null}
      </div>
    </Disclosure>
  )
}
