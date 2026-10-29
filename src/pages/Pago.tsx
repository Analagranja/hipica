import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Alert } from '../components/ui/Alert.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DatoFicha } from '../components/ui/DatoFicha.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Table } from '../components/ui/Table.tsx'
import { TextArea } from '../components/ui/TextArea.tsx'
import { useAuth } from '../context/auth-state.ts'
import { pesos } from '../lib/cobranza.ts'
import {
  anularPago,
  etiquetaEstadoPago,
  etiquetaMedio,
  imputarPago,
  obtenerCargosAbiertos,
  obtenerPago,
  repartirMonto,
  textoRecibo,
  type CargoSaldo,
  type PagoDetalle,
} from '../lib/pagos.ts'
import { leerReparto, RepartoCargos } from './RepartoCargos.tsx'
import { textoFecha, textoPeriodo } from './texto-caballo.ts'
import { aCentavos, desdeCentavos, textoMonto } from './texto-monto.ts'

type Carga = {
  clave: string
  pago: PagoDetalle | null
  cargos: CargoSaldo[]
  error: string | null
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la acción. Intentá de nuevo.'
}

function leerAviso(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('aviso' in state)) return null
  const aviso = (state as { aviso: unknown }).aviso
  return typeof aviso === 'string' && aviso ? aviso : null
}

function textoInstante(valor: string | null): string {
  if (!valor) return 'Sin fecha'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return textoFecha(valor.slice(0, 10))
  const iso = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  return textoFecha(iso)
}

function telefonoWhatsapp(telefono: string | null): string | null {
  if (!telefono?.trim()) return null
  const digitos = telefono.replace(/\D/g, '').replace(/^0+/, '')
  if (!digitos) return null
  if (digitos.startsWith('54')) return digitos
  if (digitos.length === 10) return `549${digitos}`
  return digitos
}

function mensajeRecibo(pago: PagoDetalle, club: string): string {
  return `Hola ${pago.nombre}, te enviamos el recibo N.º ${textoRecibo(pago.numeroRecibo)} de ${club} por ${pesos(pago.monto)} del ${textoFecha(pago.fecha)}. ¡Gracias!`
}

export default function Pago() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { clubActual } = useAuth()
  const clubId = clubActual?.club_id
  const clubNombre = clubActual?.club.nombre ?? 'el club'
  const clave = clubId && id ? `${clubId}:${id}` : ''
  const [carga, setCarga] = useState<Carga | null>(null)
  const [aviso, setAviso] = useState<string | null>(() => leerAviso(location.state))
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aplicar, setAplicar] = useState(false)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [anular, setAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const ocupadoRef = useRef(false)
  const clubIdRef = useRef(clubId)

  const lista = carga && carga.clave === clave ? carga : null
  const pago = lista?.pago ?? null
  const cargando = Boolean(clave) && !lista
  const error = errorAccion ?? lista?.error ?? null

  useEffect(() => {
    clubIdRef.current = clubId
  }, [clubId])

  useEffect(() => {
    if (!clubId || !id) return
    let activo = true
    const club = clubId
    const pagoId = id
    const claveCarga = `${club}:${pagoId}`

    void obtenerPago(club, pagoId)
      .then(async (detalle) => {
        if (!activo) return null
        const cargos =
          detalle && detalle.estado === 'confirmado' && aCentavos(detalle.sinAplicar) > 0
            ? await obtenerCargosAbiertos(club, detalle.personaId)
            : []
        return { detalle, cargos }
      })
      .then((resultado) => {
        if (!activo || !resultado) return
        setCarga({ clave: claveCarga, pago: resultado.detalle, cargos: resultado.cargos, error: null })
      })
      .catch((causa: unknown) => {
        if (!activo) return
        setCarga({ clave: claveCarga, pago: null, cargos: [], error: mensajeDe(causa) })
      })

    return () => {
      activo = false
    }
  }, [clubId, id])

  async function recargar(club: string, pagoId: string): Promise<void> {
    const detalle = await obtenerPago(club, pagoId)
    const cargos =
      detalle && detalle.estado === 'confirmado' && aCentavos(detalle.sinAplicar) > 0
        ? await obtenerCargosAbiertos(club, detalle.personaId)
        : []
    if (clubIdRef.current !== club) return
    setCarga({ clave: `${club}:${pagoId}`, pago: detalle, cargos, error: null })
  }

  function aplicarAutomatico() {
    if (!pago) return
    const reparto = repartirMonto(
      aCentavos(pago.sinAplicar),
      (lista?.cargos ?? []).map((cargo) => ({
        id: cargo.id,
        saldoCentavos: aCentavos(cargo.saldo),
        vencimiento: cargo.vencimiento,
      })),
    )
    const siguiente: Record<string, string> = {}
    for (const cargo of lista?.cargos ?? []) {
      const centavos = reparto.get(cargo.id) ?? 0
      if (centavos > 0) siguiente[cargo.id] = textoMonto(desdeCentavos(centavos))
    }
    setTextos(siguiente)
    setErrorAccion(null)
  }

  async function guardarAplicacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId || !id || !pago || ocupadoRef.current) return
    const reparto = leerReparto(lista?.cargos ?? [], textos, aCentavos(pago.sinAplicar))
    if (reparto.error) {
      setErrorAccion(reparto.error)
      return
    }
    if (reparto.items.length === 0) {
      setErrorAccion('Cada importe a aplicar debe ser mayor a cero.')
      return
    }
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await imputarPago(id, reparto.items)
      await recargar(clubId, id)
      setAplicar(false)
      setTextos({})
      setAviso('Saldo aplicado.')
    } catch (causa) {
      setErrorAccion(mensajeDe(causa))
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  async function guardarAnulacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubId || !id || ocupadoRef.current) return
    if (!motivo.trim()) {
      setErrorAccion('El motivo de la anulación es obligatorio.')
      return
    }
    ocupadoRef.current = true
    setOcupado(true)
    setErrorAccion(null)
    try {
      await anularPago(id, motivo)
      await recargar(clubId, id)
      setAnular(false)
      setMotivo('')
      setAviso('Pago anulado.')
    } catch (causa) {
      setErrorAccion(mensajeDe(causa))
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  function enviarWhatsapp() {
    if (!pago || pago.estado === 'anulado') return
    const texto = encodeURIComponent(mensajeRecibo(pago, clubNombre))
    const telefono = telefonoWhatsapp(pago.telefono)
    const url = telefono ? `https://wa.me/${telefono}?text=${texto}` : `https://wa.me/?text=${texto}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function enviarMail() {
    if (!pago || pago.estado === 'anulado') return
    const cuerpo = mensajeRecibo(pago, clubNombre)
    const asunto = `Recibo N.º ${textoRecibo(pago.numeroRecibo)} - ${clubNombre}`
    const destino = pago.email?.trim() ?? ''
    window.location.href = `mailto:${destino}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
  }

  const anulado = pago?.estado === 'anulado'
  const puedeAplicar = Boolean(
    pago && !anulado && aCentavos(pago.sinAplicar) > 0 && (lista?.cargos.length ?? 0) > 0,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="no-imprimir">
        <PageHeader
          title={pago ? `Recibo N.º ${textoRecibo(pago.numeroRecibo)}` : 'Pago'}
          description="Detalle del pago."
          action={
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => navigate('/cobranza/pagos')}>
              Volver
            </Button>
          }
        />
      </div>

      {aviso ? (
        <div className="no-imprimir">
          <Alert tone="ok">{aviso}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="no-imprimir">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      {cargando ? (
        <p className="font-body text-muted" role="status">
          Cargando pago…
        </p>
      ) : !pago ? (
        <Card>
          <p className="font-body text-muted">No se encontró el pago.</p>
        </Card>
      ) : (
        <>
          <article className="recibo flex flex-col gap-4">
            <div>
              <h2 className="text-lg">{clubNombre}</h2>
              <p className="mt-2 font-heading text-ink">Recibo N.º {textoRecibo(pago.numeroRecibo)}</p>
              {anulado ? <p className="mt-3 font-heading text-2xl text-danger-text">ANULADO</p> : null}
            </div>
            <div className="flex flex-col gap-3">
              <DatoFicha etiqueta="Fecha" valor={textoFecha(pago.fecha)} />
              <DatoFicha etiqueta="Recibí de" valor={pago.personaNombre} />
              <DatoFicha etiqueta="Importe" valor={pesos(pago.monto)} />
              <DatoFicha etiqueta="Medio de pago" valor={etiquetaMedio(pago.medio)} />
              {pago.referencia ? <DatoFicha etiqueta="Referencia" valor={pago.referencia} /> : null}
              {pago.observaciones ? <DatoFicha etiqueta="Observaciones" valor={pago.observaciones} /> : null}
              <DatoFicha etiqueta="Estado" valor={etiquetaEstadoPago(pago.estado)} />
              {anulado ? (
                <>
                  <DatoFicha etiqueta="Motivo" valor={pago.motivoAnulacion ?? 'Sin motivo'} />
                  <DatoFicha etiqueta="Anulado el" valor={textoInstante(pago.anuladoAt)} />
                </>
              ) : null}
              <DatoFicha etiqueta="Sin aplicar" valor={pesos(pago.sinAplicar)} />
            </div>
            {pago.imputaciones.length === 0 ? (
              <p className="font-body text-ink">Este recibo no cancela cargos.</p>
            ) : (
              <Table
                columns={['Período', 'Descripción', 'Importe']}
                rows={[...pago.imputaciones]
                  .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.descripcion.localeCompare(b.descripcion, 'es'))
                  .map((item) => ({
                    id: item.cargoId,
                    cells: [textoPeriodo(item.periodo), item.descripcion, pesos(item.monto)],
                  }))}
              />
            )}
          </article>

          <div className="no-imprimir flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="w-full sm:w-auto" onClick={() => window.print()}>
              Imprimir o guardar como PDF
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" disabled={anulado} onClick={enviarWhatsapp}>
              Enviar por WhatsApp
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" disabled={anulado} onClick={enviarMail}>
              Enviar por mail
            </Button>
            {puedeAplicar ? (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => {
                  setAplicar((abierto) => !abierto)
                  setErrorAccion(null)
                }}
              >
                Aplicar saldo a cargos
              </Button>
            ) : null}
            {!anulado ? (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() => {
                  setAnular((abierto) => !abierto)
                  setErrorAccion(null)
                }}
              >
                Anular pago
              </Button>
            ) : null}
          </div>

          {pago && !anulado && aCentavos(pago.sinAplicar) > 0 && (lista?.cargos.length ?? 0) === 0 ? (
            <p className="no-imprimir font-body text-muted">No hay cargos abiertos para aplicar el saldo.</p>
          ) : null}

          {aplicar && puedeAplicar ? (
            <form className="no-imprimir flex flex-col gap-4" onSubmit={(event) => void guardarAplicacion(event)}>
              <h2 className="text-lg">Aplicar saldo a cargos</h2>
              <RepartoCargos
                cargos={lista?.cargos ?? []}
                montoCentavos={aCentavos(pago.sinAplicar)}
                textos={textos}
                onTexto={(cargoId, valor) => {
                  setTextos((actual) => ({ ...actual, [cargoId]: valor }))
                  setErrorAccion(null)
                }}
                onAutomatico={aplicarAutomatico}
                deshabilitado={ocupado}
                idPrefijo="aplicar-saldo"
              />
              <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
                Guardar aplicación
              </Button>
            </form>
          ) : null}

          {anular && !anulado ? (
            <div className="no-imprimir">
            <Card>
              <form className="flex flex-col gap-4" onSubmit={(event) => void guardarAnulacion(event)}>
                <h2 className="text-lg">Anular pago</h2>
                <TextArea
                  id="motivo-anulacion"
                  label="Motivo"
                  value={motivo}
                  onChange={setMotivo}
                  disabled={ocupado}
                />
                <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
                  Confirmar anulación
                </Button>
              </form>
            </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
