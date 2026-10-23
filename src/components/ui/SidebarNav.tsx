import { House, Palette, Warehouse, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

const items: NavItem[] = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/cuadras', label: 'Cuadras', icon: Warehouse },
  { to: '/design', label: 'Diseño', icon: Palette },
]

type SidebarNavProps = {
  orientation?: 'vertical' | 'horizontal'
}

export function SidebarNav({ orientation = 'vertical' }: SidebarNavProps) {
  const horizontal = orientation === 'horizontal'

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
                    horizontal ? 'flex-col justify-center' : '',
                    isActive ? 'bg-gold/20 text-canvas' : 'text-on-primary',
                  ].join(' ')
                }
              >
                <Icon className="text-gold" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
