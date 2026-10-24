import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Avatar } from '../components/ui/Avatar.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Select } from '../components/ui/Select.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { Tag } from '../components/ui/Tag.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  crearCaballo,
  obtenerBoxesDisponibles,
  obtenerCaballos,
  obtenerPersonasActivas,
  type BoxDisponible,
  type Caballo,
  type DatosCaballo,
  type EstadoCaballo,
  type PersonaActiva,
  type TipoCaballo,
} from '../lib/caballos.ts'
import { prepararFoto } from '../lib/foto.ts'
import { FormularioCaballo } from './FormularioCaballo.tsx'
import { etiquetaEstado, etiquetaTipo, textoPropietario, textoUbicacion } from './texto-caballo.ts'

const VACIO: DatosCaballo = {
  nombre: '',
  tipo: 'particular',
  propietarioId: '',
  boxId: '',
  nacimiento: '',
  raza: '',
  pelaje: '',
  sexo: '',
  numeroRegistro: '',
  observaciones: '',
}

type ListaCaballos = {
  clubId: string
  caballos: Caballo[]
  error: string | null
}

type Filtros = {
  clubId: string
  texto: string
  tipo: 'todos' | TipoCaballo
  cuadraId: string
  estado: 'todos' | EstadoCaballo
}

type Formulario = {
  clubId: string
  abierto: boolean
  datos: DatosCaballo
}

type Opciones = {
  clubId: string
  personas: PersonaActiva[]
  boxes: BoxDisponible[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function esTipoFiltro(valor: string): valor is 'todos' | TipoCaballo {
  return valor === 'todos' || valor === 'escuela' || valor === 'particular'
}

function esEstadoFiltro(valor: string): valor is 'todos' | EstadoCaballo {
  return valor === 'todos' || valor === 'activo' || valor === 'baja'
}

export default function Caballos() {
  const { clubActual, roles, tieneRol } = useAuth()
  const esAdmin = tieneRol('administrador')
  const soloPropietario = roles.length > 0 && roles.every((rol) => rol === 'propietario')
  const clubId = clubActual?.club_id
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [lista, setLista] = useState<ListaCaballos | null>(null)
  const [filtros, setFiltros] = useState<Filtros | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clubId: string; mensaje: string } | null>(null)
  const caballos = lista && lista.clubId === clubId ? lista.caballos : []
  const cargandoLista = Boolean(clubId) && (!lista || lista.clubId !== clubId)
  const creando = formulario !== null && formulario.clubId === clubId && formulario.abierto
  const datosNuevos = formulario !== null && formulario.clubId === clubId ? formulario.datos : VACIO
  const opcionesListas = opciones !== null && opciones.clubId === clubId ? opciones : null
  const texto = filtros !== null && filtros.clubId === clubId ? filtros.texto : ''
  const tipo = filtros !== null && filtros.clubId === clubId ? filtros.tipo : 'todos'
  const cuadraId = filtros !== null && filtros.clubId === clubId ? filtros.cuadraId : ''
  const estado = filtros !== null && filtros.clubId === clubId ? filtros.estado : 'activo'
  const error =
    errorAccion !== null && errorAccion.clubId === clubId
      ? errorAccion.mensaje
      : creando && opcionesListas?.error
        ? opcionesListas.error
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

    void obtenerCaballos(club)
      .then((caballosCargados) => {
        if (!activo) return
        setLista({ clubId: club, caballos: caballosCargados, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clubId: club, caballos: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId])

  useEffect(() => {
    if (!clubId || !creando) return
    let activo = true
    const club = clubId

    void Promise.all([obtenerPersonasActivas(club), obtenerBoxesDisponibles(club, null)])
      .then(([personas, boxes]) => {
        if (!activo) return
        setOpciones({ clubId: club, personas, boxes, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setOpciones({ clubId: club, personas: [], boxes: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, creando])

  async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
    if (!clubId || ocupadoRef.current) return false
    const clubDeLaAccion = clubId
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await accion()
      const caballosCargados = await obtenerCaballos(clubDeLaAccion)
      if (clubIdRef.current !== clubDeLaAccion) return false
      setLista({ clubId: clubDeLaAccion, caballos: caballosCargados, error: null })
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

  function cambiarFiltros(parcial: Partial<Omit<Filtros, 'clubId'>>) {
    if (!clubId) return
    setFiltros({
      clubId,
      texto,
      tipo,
      cuadraId,
      estado,
      ...parcial,
    })
  }

  async function guardarNuevo(event: FormEvent<HTMLFormElement>, foto: File | null) {
    event.preventDefault()
    if (!clubId) return
    const datos = datosNuevos
    const ok = await ejecutar(async () => {
      const blob = foto ? await prepararFoto(foto) : undefined
      await crearCaballo(clubId, datos, blob)
    })
    if (ok) setFormulario({ clubId, abierto: false, datos: VACIO })
  }

  const cuadras = new Map<string, string>()
  for (const caballo of caballos) {
    if (caballo.ubicacion) cuadras.set(caballo.ubicacion.cuadraId, caballo.ubicacion.cuadraNombre)
  }
  const opcionesCuadra = [...cuadras.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const busqueda = texto.trim().toLocaleLowerCase('es')
  const visibles = caballos.filter((caballo) => {
    const coincideNombre = !busqueda || caballo.nombre.toLocaleLowerCase('es').includes(busqueda)
    const coincideTipo = tipo === 'todos' || caballo.tipo === tipo
    const coincideCuadra = !cuadraId || caballo.ubicacion?.cuadraId === cuadraId
    const coincideEstado = estado === 'todos' || caballo.estado === estado
    return coincideNombre && coincideTipo && coincideCuadra && coincideEstado
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={soloPropietario ? 'Mis caballos' : 'Caballos'}
        description={soloPropietario ? 'Tus caballos en el club.' : 'Caballos del club.'}
        action={
          esAdmin ? (
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
              Nuevo caballo
            </Button>
          ) : null
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {creando && opcionesListas && !opcionesListas.error ? (
        <Card>
          <FormularioCaballo
            idPrefijo="nuevo-caballo"
            valores={datosNuevos}
            personas={opcionesListas.personas}
            boxes={opcionesListas.boxes}
            propietarioActual={null}
            ocupado={ocupado}
            enviar="Crear caballo"
            onChange={(datos) => {
              if (!clubId) return
              setFormulario({ clubId, abierto: true, datos })
            }}
            onSubmit={(event, foto) => void guardarNuevo(event, foto)}
            onCancel={() => {
              if (!clubId) return
              setFormulario({ clubId, abierto: false, datos: VACIO })
            }}
          />
        </Card>
      ) : null}

      {creando && !opcionesListas ? (
        <p className="font-body text-muted" role="status">
          Cargando formulario…
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField
            id="buscar-caballo"
            label="Buscar por nombre"
            value={texto}
            onChange={(valor) => cambiarFiltros({ texto: valor })}
          />
        </div>
        <Select
          id="filtro-tipo"
          label="Tipo"
          value={tipo}
          options={[
            { value: 'todos', label: 'Todos los tipos' },
            { value: 'escuela', label: 'Escuela' },
            { value: 'particular', label: 'Particular' },
          ]}
          onChange={(valor) => {
            if (esTipoFiltro(valor)) cambiarFiltros({ tipo: valor })
          }}
        />
        <Select
          id="filtro-cuadra"
          label="Cuadra"
          value={cuadraId}
          options={[{ value: '', label: 'Todas las cuadras' }, ...opcionesCuadra]}
          onChange={(valor) => cambiarFiltros({ cuadraId: valor })}
        />
        <Select
          id="filtro-estado"
          label="Estado"
          value={estado}
          options={[
            { value: 'activo', label: 'Activos' },
            { value: 'baja', label: 'De baja' },
            { value: 'todos', label: 'Todos' },
          ]}
          onChange={(valor) => {
            if (esEstadoFiltro(valor)) cambiarFiltros({ estado: valor })
          }}
        />
      </div>

      {cargandoLista ? (
        <p className="font-body text-muted" role="status">
          Cargando caballos…
        </p>
      ) : caballos.length === 0 ? (
        <Card>
          <p className="font-body text-muted">Todavía no hay caballos.</p>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <p className="font-body text-muted">No hay caballos con ese criterio.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibles.map((caballo) => (
            <Card key={caballo.id}>
              <Link
                to={`/caballos/${caballo.id}`}
                className="flex items-center gap-3 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
              >
                <Avatar nombre={caballo.nombre} src={caballo.fotoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg">{caballo.nombre}</h2>
                    <Tag>{etiquetaTipo(caballo.tipo)}</Tag>
                    <StatusBadge tone={caballo.estado === 'activo' ? 'ok' : 'danger'}>
                      {etiquetaEstado(caballo.estado)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 font-body text-muted">{textoPropietario(caballo)}</p>
                  <p className="font-body text-muted">{textoUbicacion(caballo)}</p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
