import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, EnlaceAcceso, MarcoAcceso } from '../components/acceso/MarcoAcceso.tsx'
import { Button } from '../components/ui/Button.tsx'
import { useAuth } from '../context/auth-state.ts'
import { mensajeErrorSupabase } from '../lib/errores.ts'
import { supabase } from '../lib/supabase.ts'
import { PantallaCarga } from '../routes/Rutas.tsx'

const TOKEN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ResultadoInvitacion = {
  clubId: string | null
  error: string | null
}

const aceptaciones = new Map<string, Promise<ResultadoInvitacion>>()

function aceptarInvitacion(token: string): Promise<ResultadoInvitacion> {
  const previa = aceptaciones.get(token)
  if (previa) return previa

  const caja: { actual: Promise<ResultadoInvitacion> | null } = { actual: null }
  const promesa = (async () => {
    const { data, error } = await supabase.rpc('aceptar_invitacion', { p_token: token })
    if (error) {
      if (caja.actual && aceptaciones.get(token) === caja.actual) aceptaciones.delete(token)
      return { clubId: null, error: mensajeErrorSupabase(error) }
    }
    return {
      clubId: typeof data === 'string' ? data : null,
      error: null,
    }
  })()

  caja.actual = promesa
  aceptaciones.set(token, promesa)
  return promesa
}

export default function Invitacion() {
  const { token } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { sesion, cargando, recargarMembresias, cerrarSesion } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const usuarioId = sesion?.user.id
  const tokenInvalido = !token || !TOKEN.test(token)

  useEffect(() => {
    if (cargando || !usuarioId || !token || tokenInvalido) return

    let activo = true
    void aceptarInvitacion(token).then(async (resultado) => {
      if (!resultado.error) {
        await recargarMembresias(resultado.clubId ?? undefined)
      }
      if (!activo) return
      if (resultado.error) {
        setError(resultado.error)
        return
      }
      navigate('/', { replace: true })
    })

    return () => {
      activo = false
    }
  }, [cargando, usuarioId, token, tokenInvalido, intento, recargarMembresias, navigate])

  function reintentar() {
    if (token) aceptaciones.delete(token)
    setError(null)
    setIntento((valor) => valor + 1)
  }

  if (cargando) return <PantallaCarga />
  if (!sesion) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const aceptando = !tokenInvalido && !error

  return (
    <MarcoAcceso title="Invitación" description="Aceptá el acceso al club.">
      {tokenInvalido ? <Aviso tono="danger">La invitación no es válida.</Aviso> : null}
      {!tokenInvalido && error ? <Aviso tono="danger">{error}</Aviso> : null}
      {aceptando ? (
        <p className="font-body text-muted" role="status">
          Aceptando la invitación…
        </p>
      ) : null}
      {error && !tokenInvalido ? (
        <Button className="w-full" onClick={reintentar}>
          Reintentar
        </Button>
      ) : null}
      {aceptando ? null : (
        <>
          <EnlaceAcceso to="/">Ir al inicio</EnlaceAcceso>
          <Button variant="ghost" className="w-full" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </Button>
        </>
      )}
    </MarcoAcceso>
  )
}
