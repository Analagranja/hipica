import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Disclosure } from '../components/ui/Disclosure.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../context/auth-state.ts'
import {
  agregarBoxes,
  cambiarActivaCuadra,
  cambiarEstadoBox,
  crearBox,
  crearCuadraConBoxes,
  numerosDeBoxes,
  obtenerCuadras,
  renombrarCuadra,
  textoVistaPrevia,
  type Cuadra,
  type EstadoBox,
} from '../lib/cuadras.ts'

function textoBoxes(cantidad: number): string {
  return cantidad === 1 ? '1 box' : `${cantidad} boxes`
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

type Ejecutar = (accion: () => Promise<unknown>) => Promise<boolean>

function leerCantidad(valor: string, minimo: number, maximo: number): number | null {
  const limpio = valor.trim()
  if (!/^\d+$/.test(limpio)) return null
  const numero = Number(limpio)
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) return null
  return numero
}

const FORMULARIO_CERRADO = {
  abierto: false,
  nombre: '',
  cantidad: '0',
  prefijo: '',
}

type ListaCuadras = {
  clubId: string
  cuadras: Cuadra[]
  error: string | null
}

const SIN_ABIERTAS = new Set<string>()

export default function Cuadras() {
  const { clubActual, tieneRol } = useAuth()
  const esAdmin = tieneRol('administrador')
  const clubId = clubActual?.club_id
  const clubIdRef = useRef(clubId)
  const ocupadoRef = useRef(false)
  const [lista, setLista] = useState<ListaCuadras | null>(null)
  const [paneles, setPaneles] = useState<{ clubId: string; ids: Set<string> } | null>(null)
  const [formulario, setFormulario] = useState<{
    clubId: string
    abierto: boolean
    nombre: string
    cantidad: string
    prefijo: string
  } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState<{ clubId: string; mensaje: string } | null>(null)
  const cuadras = lista && lista.clubId === clubId ? lista.cuadras : []
  const cargandoLista = Boolean(clubId) && (!lista || lista.clubId !== clubId)
  const creando = formulario !== null && formulario.clubId === clubId && formulario.abierto
  const nombreNuevo = formulario !== null && formulario.clubId === clubId ? formulario.nombre : ''
  const cantidadNueva =
    formulario !== null && formulario.clubId === clubId ? formulario.cantidad : '0'
  const prefijoNuevo = formulario !== null && formulario.clubId === clubId ? formulario.prefijo : ''
  const cantidadCrear = leerCantidad(cantidadNueva, 0, 100)
  const vistaCrear =
    cantidadCrear !== null && cantidadCrear > 0
      ? textoVistaPrevia(numerosDeBoxes([], cantidadCrear, prefijoNuevo), prefijoNuevo)
      : ''
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
    if (!clubId) return
    let activo = true
    const club = clubId

    void obtenerCuadras(club)
      .then((cuadrasCargadas) => {
        if (!activo) return
        setLista({ clubId: club, cuadras: cuadrasCargadas, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setLista({ clubId: club, cuadras: [], error: mensajeDe(causa) })
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
      const cuadrasCargadas = await obtenerCuadras(clubDeLaAccion)
      if (clubIdRef.current !== clubDeLaAccion) return false
      setLista({ clubId: clubDeLaAccion, cuadras: cuadrasCargadas, error: null })
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

  async function guardarCuadra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId) return
    const nombre = nombreNuevo.trim()
    if (!nombre) {
      informarError('Ingresá el nombre de la cuadra.')
      return
    }
    if (cantidadCrear === null) {
      informarError('La cantidad tiene que ser un entero de 0 a 100.')
      return
    }
    const resultado = { aviso: null as string | null }
    const ok = await ejecutar(async () => {
      resultado.aviso = await crearCuadraConBoxes(clubId, nombre, cantidadCrear, prefijoNuevo)
    })
    if (!ok || !clubId) return
    setFormulario({ clubId, ...FORMULARIO_CERRADO })
    if (resultado.aviso) informarError(resultado.aviso)
  }

  function cambiarPaneles(actualizar: (ids: Set<string>) => Set<string>) {
    if (!clubId) return
    setPaneles((actual) => {
      const base = actual?.clubId === clubId ? actual.ids : new Set<string>()
      return { clubId, ids: actualizar(base) }
    })
  }

  function alternar(cuadraId: string) {
    cambiarPaneles((ids) => {
      const siguiente = new Set(ids)
      if (siguiente.has(cuadraId)) siguiente.delete(cuadraId)
      else siguiente.add(cuadraId)
      return siguiente
    })
  }

  function abrir(cuadraId: string) {
    cambiarPaneles((ids) => new Set(ids).add(cuadraId))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cuadras"
        description="Cuadras y boxes del club."
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
                  nombre: creando ? '' : nombreNuevo,
                  cantidad: creando ? '0' : cantidadNueva,
                  prefijo: creando ? '' : prefijoNuevo,
                })
                setErrorAccion(null)
              }}
            >
              Nueva cuadra
            </Button>
          ) : null
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {creando ? (
        <Card>
          <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void guardarCuadra(event)}>
            <TextField
              id="nombre-cuadra"
              label="Nombre de la cuadra"
              value={nombreNuevo}
              onChange={(valor) => {
                if (!clubId) return
                setFormulario({
                  clubId,
                  abierto: true,
                  nombre: valor,
                  cantidad: cantidadNueva,
                  prefijo: prefijoNuevo,
                })
              }}
              disabled={ocupado}
            />
            <TextField
              id="cantidad-cuadra"
              label="Cantidad de boxes"
              value={cantidadNueva}
              inputMode="numeric"
              onChange={(valor) => {
                if (!clubId) return
                setFormulario({
                  clubId,
                  abierto: true,
                  nombre: nombreNuevo,
                  cantidad: valor,
                  prefijo: prefijoNuevo,
                })
              }}
              disabled={ocupado}
            />
            <TextField
              id="prefijo-cuadra"
              label="Prefijo"
              value={prefijoNuevo}
              onChange={(valor) => {
                if (!clubId) return
                setFormulario({
                  clubId,
                  abierto: true,
                  nombre: nombreNuevo,
                  cantidad: cantidadNueva,
                  prefijo: valor,
                })
              }}
              disabled={ocupado}
            />
            {cantidadNueva.trim() !== '' && cantidadCrear === null ? (
              <p className="font-body text-danger-text">
                La cantidad tiene que ser un entero de 0 a 100.
              </p>
            ) : null}
            {vistaCrear ? (
              <p className="font-body text-ink" role="status">
                {vistaCrear}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
                Crear cuadra
              </Button>
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => {
                  if (!clubId) return
                  setFormulario({ clubId, ...FORMULARIO_CERRADO })
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {cargandoLista ? (
        <p className="font-body text-muted" role="status">
          Cargando cuadras…
        </p>
      ) : cuadras.length === 0 ? (
        <Card>
          <p className="font-body text-muted">Todavía no hay cuadras.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {cuadras.map((cuadra) => (
            <FilaCuadra
              key={cuadra.id}
              cuadra={cuadra}
              esAdmin={esAdmin}
              abierta={abiertas.has(cuadra.id)}
              ocupado={ocupado}
              onToggle={() => alternar(cuadra.id)}
              onAbrir={() => abrir(cuadra.id)}
              clubId={clubId ?? ''}
              onEjecutar={ejecutar}
              onError={informarError}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type FilaCuadraProps = {
  cuadra: Cuadra
  esAdmin: boolean
  abierta: boolean
  ocupado: boolean
  onToggle: () => void
  onAbrir: () => void
  clubId: string
  onEjecutar: Ejecutar
  onError: (mensaje: string) => void
}

function FilaCuadra({
  cuadra,
  esAdmin,
  abierta,
  ocupado,
  onToggle,
  onAbrir,
  clubId,
  onEjecutar,
  onError,
}: FilaCuadraProps) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(cuadra.nombre)
  const [numero, setNumero] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [prefijo, setPrefijo] = useState('')
  const cantidadNumero = leerCantidad(cantidad, 1, 100)
  const vista =
    cantidadNumero === null
      ? ''
      : textoVistaPrevia(
          numerosDeBoxes(
            cuadra.boxes.map((box) => box.numero),
            cantidadNumero,
            prefijo,
          ),
          prefijo,
        )

  async function guardarNombre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) {
      onError('Ingresá el nombre de la cuadra.')
      return
    }
    const ok = await onEjecutar(() => renombrarCuadra(clubId, cuadra.id, limpio))
    if (ok) setEditando(false)
  }

  async function guardarBox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const limpio = numero.trim()
    if (!limpio) {
      onError('Ingresá el número del box.')
      return
    }
    const ok = await onEjecutar(() => crearBox(clubId, cuadra.id, limpio))
    if (ok) setNumero('')
  }

  async function guardarVarios(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (cantidadNumero === null) {
      onError('La cantidad tiene que ser un entero de 1 a 100.')
      return
    }
    const ok = await onEjecutar(() =>
      agregarBoxes(
        clubId,
        cuadra.id,
        cuadra.boxes.map((box) => box.numero),
        cantidadNumero,
        prefijo,
      ),
    )
    if (ok) {
      setCantidad('')
      setPrefijo('')
    }
  }

  function cambiarEstado(estado: EstadoBox, boxId: string) {
    const siguiente: EstadoBox = estado === 'activo' ? 'mantenimiento' : 'activo'
    void onEjecutar(() => cambiarEstadoBox(clubId, boxId, siguiente))
  }

  return (
    <Disclosure
      title={cuadra.nombre}
      open={abierta}
      onToggle={onToggle}
      detail={
        <>
          <StatusBadge tone={cuadra.activa ? 'ok' : 'warn'}>
            {cuadra.activa ? 'Activa' : 'Inactiva'}
          </StatusBadge>
          <span className="font-body text-muted">{textoBoxes(cuadra.boxes.length)}</span>
        </>
      }
      actions={
        esAdmin ? (
          <>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => {
                setNombre(cuadra.nombre)
                setCantidad('')
                setPrefijo('')
                setEditando(true)
                onAbrir()
              }}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={() => void onEjecutar(() => cambiarActivaCuadra(clubId, cuadra.id, !cuadra.activa))}
            >
              {cuadra.activa ? 'Desactivar' : 'Activar'}
            </Button>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {editando ? (
          <form className="flex flex-col gap-3" noValidate onSubmit={(event) => void guardarNombre(event)}>
            <TextField
              id={`nombre-${cuadra.id}`}
              label="Nombre de la cuadra"
              value={nombre}
              onChange={setNombre}
              disabled={ocupado}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
                Guardar
              </Button>
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => {
                  setNombre(cuadra.nombre)
                  setEditando(false)
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        {editando ? (
          <form
            className="flex flex-col gap-3 border-t border-line pt-4"
            noValidate
            onSubmit={(event) => void guardarVarios(event)}
          >
            <h3 className="text-lg">Agregar boxes</h3>
            <TextField
              id={`cantidad-${cuadra.id}`}
              label="Cantidad"
              value={cantidad}
              inputMode="numeric"
              onChange={setCantidad}
              disabled={ocupado}
            />
            <TextField
              id={`prefijo-${cuadra.id}`}
              label="Prefijo"
              value={prefijo}
              onChange={setPrefijo}
              disabled={ocupado}
            />
            {cantidad.trim() !== '' && cantidadNumero === null ? (
              <p className="font-body text-danger-text">
                La cantidad tiene que ser un entero de 1 a 100.
              </p>
            ) : null}
            {vista ? (
              <p className="font-body text-ink" role="status">
                {vista}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={ocupado || cantidadNumero === null}
            >
              Crear boxes
            </Button>
          </form>
        ) : null}

        {cuadra.boxes.length === 0 ? (
          <p className="font-body text-muted">Esta cuadra no tiene boxes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cuadra.boxes.map((box) => (
              <li
                key={box.id}
                className="flex flex-col gap-2 border-b border-line pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-ink">Box {box.numero}</span>
                  <StatusBadge tone={box.estado === 'activo' ? 'ok' : 'warn'}>
                    {box.estado === 'activo' ? 'Activo' : 'Mantenimiento'}
                  </StatusBadge>
                </div>
                {esAdmin ? (
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={ocupado}
                    onClick={() => cambiarEstado(box.estado, box.id)}
                  >
                    {box.estado === 'activo' ? 'Pasar a mantenimiento' : 'Marcar activo'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {esAdmin ? (
          <form className="flex flex-col gap-3" noValidate onSubmit={(event) => void guardarBox(event)}>
            <TextField
              id={`box-${cuadra.id}`}
              label="Número del box"
              value={numero}
              onChange={setNumero}
              disabled={ocupado}
            />
            <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
              Agregar box
            </Button>
          </form>
        ) : null}
      </div>
    </Disclosure>
  )
}
