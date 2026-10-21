import type { ReactNode } from 'react'
import { SidebarNav } from './SidebarNav.tsx'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-svh bg-canvas font-body text-ink">
      <header className="border-b border-gold bg-primary px-4 py-3 md:hidden">
        <p className="font-heading text-canvas">Club Hípico</p>
      </header>

      <div className="md:flex md:items-stretch">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-gold bg-primary px-4 py-6 md:flex">
          <div className="border-b border-gold pb-4">
            <p className="font-heading text-canvas">Club Hípico</p>
            <p className="mt-1 font-body text-highlight">Gestión multiclub</p>
          </div>
          <SidebarNav />
        </aside>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-gold bg-primary md:hidden">
        <SidebarNav orientation="horizontal" />
      </nav>
    </div>
  )
}
