import { Navigate, Outlet, useLocation } from 'react-router'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Tabs } from '../components/ui/Tabs.tsx'
import { useAuth } from '../context/auth-state.ts'

const SECCIONES = [
  { to: '/cobranza/conceptos', label: 'Conceptos' },
  { to: '/cobranza/pensiones', label: 'Pensiones' },
]

export default function Cobranza() {
  const { tieneRol } = useAuth()
  const { pathname } = useLocation()
  const esDetalle = /^\/cobranza\/pensiones\/[^/]+$/.test(pathname)

  if (!tieneRol('administrador')) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-6">
      {esDetalle ? null : (
        <PageHeader title="Cobranza" description="Conceptos de cobro y pensiones." />
      )}
      <Tabs items={SECCIONES} />
      <Outlet />
    </div>
  )
}
