import { Fence, House, Palette, Users, Wallet, Warehouse, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { useAuth } from '../../context/auth-state.ts'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

type SidebarNavProps = {
  orientation?: 'vertical' | 'horizontal'
}

export function SidebarNav({ orientation = 'vertical' }: SidebarNavProps) {
  const { tieneRol } = useAuth()
  const horizontal = orientation === 'horizontal'
  const veCaballos =
    tieneRol('administrador') ||
    tieneRol('profesor') ||
    tieneRol('caballerizo') ||
    tieneRol('propietario')
  const items: NavItem[] = [
    { to: '/', label: 'Inicio', icon: House },
    { to: '/cuadras', label: 'Cuadras', icon: Warehouse },
    ...(veCaballos ? [{ to: '/caballos', label: 'Caballos', icon: Fence }] : []),
    ...(tieneRol('administrador')
      ? [
          { to: '/personas', label: 'Personas', icon: Users },
          { to: '/cobranza', label: 'Cobranza', icon: Wallet },
        ]
      : []),
    { to: '/design', label: 'Diseño', icon: Palette },
  ]

  return (
    <nav aria-label="Principal">
      <ul className={horizontal ? 'flex' : 'flex flex-col gap-1'}>
        {items.map((item) => {
          const Icon = item.icon

          return (
            <li key={item.to} className={horizontal ? 'min-w-0 flex-1' : undefined}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-control px-3 py-2 font-body',
                    horizontal ? 'w-full min-w-0 flex-col justify-center' : '',
                    isActive ? 'bg-gold/20 text-canvas' : 'text-on-primary',
                  ].join(' ')
                }
              >
                <Icon className="shrink-0 text-gold" aria-hidden="true" />
                <span className={horizontal ? 'max-w-full truncate' : undefined}>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
