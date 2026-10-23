import { useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { AppShell } from '../components/ui/AppShell.tsx'
import { useAuth } from '../context/auth-state.ts'

function leerDestino(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('from' in state)) return null
  const from = (state as { from?: unknown }).from
  if (typeof from !== 'string') return null
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return null
  if (from.startsWith('/login') || from.startsWith('/registro')) return null
  return from
}

export function PantallaCarga() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4 font-body text-muted">
      <p role="status">Cargando…</p>
    </div>
  )
}

export function PantallaError({ mensaje }: { mensaje: string }) {
  const { recargarMembresias, cerrarSesion } = useAuth()
  const [ocupado, setOcupado] = useState(false)

  async function reintentar() {
    setOcupado(true)
    try {
      await recargarMembresias()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center bg-canvas px-4 py-8 font-body text-ink md:justify-center">
      <div className="w-full max-w-md">
        <Card>
          <div className="flex flex-col gap-4">
            <p className="rounded-control bg-danger-bg px-3 py-2 text-danger-text" role="alert">
              {mensaje}
            </p>
            <Button className="w-full" onClick={() => void reintentar()} disabled={ocupado}>
              Reintentar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => void cerrarSesion()}>
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function RutaPublica({ children }: { children: ReactNode }) {
  const { sesion, cargando, membresias, errorCarga } = useAuth()
  const location = useLocation()

  if (cargando) return <PantallaCarga />
  if (sesion && errorCarga) return <PantallaError mensaje={errorCarga} />
  if (!sesion) return children

  const destino = leerDestino(location.state)
  if (destino?.startsWith('/invitacion/')) return <Navigate to={destino} replace />
  if (membresias.length === 0) return <Navigate to="/crear-club" replace />
  return <Navigate to={destino ?? '/'} replace />
}

export function RutaConSesion({ children }: { children: ReactNode }) {
  const { sesion, cargando, errorCarga } = useAuth()
  const location = useLocation()

  if (cargando) return <PantallaCarga />
  if (!sesion) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (errorCarga) return <PantallaError mensaje={errorCarga} />
  return children
}

export function RutaDeLaApp() {
  const { sesion, cargando, membresias, errorCarga } = useAuth()
  const location = useLocation()

  if (cargando) return <PantallaCarga />
  if (!sesion) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" replace state={{ from }} />
  }
  if (errorCarga) return <PantallaError mensaje={errorCarga} />
  if (membresias.length === 0) return <Navigate to="/crear-club" replace />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function RutaDesconocida() {
  const { sesion, cargando, membresias, errorCarga } = useAuth()

  if (cargando) return <PantallaCarga />
  if (!sesion) return <Navigate to="/login" replace />
  if (errorCarga) return <PantallaError mensaje={errorCarga} />
  if (membresias.length === 0) return <Navigate to="/crear-club" replace />
  return <Navigate to="/" replace />
}
