import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'

type DisclosureProps = {
  title: string
  detail?: ReactNode
  actions?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function Disclosure({
  title,
  detail,
  actions,
  open,
  onToggle,
  children,
}: DisclosureProps) {
  const panelId = useId()

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="h-1 bg-gold" aria-hidden="true" />
      <div className="flex flex-col gap-3 p-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-w-0 items-start gap-2 rounded-control text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
        >
          <ChevronDown
            className={`mt-1 shrink-0 text-gold ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          <span className="min-w-0 font-heading break-words text-ink">{title}</span>
        </button>

        {detail || actions ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {detail ? <div className="flex flex-wrap items-center gap-2">{detail}</div> : <span />}
            {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div> : null}
          </div>
        ) : null}

        {open ? (
          <div id={panelId} className="border-t border-line pt-3">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}
