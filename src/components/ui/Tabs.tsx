import { NavLink } from 'react-router'

type TabItem = {
  to: string
  label: string
}

type TabsProps = {
  items: TabItem[]
  label?: string
}

export function Tabs({ items, label = 'Secciones' }: TabsProps) {
  return (
    <nav aria-label={label} className="border-b border-line">
      <ul className="flex">
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  'block border-b-2 px-3 py-2 text-center font-body',
                  isActive ? 'border-gold text-ink' : 'border-transparent text-muted',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
