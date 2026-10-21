import type { ReactNode } from 'react'

export type StatusTone = 'ok' | 'warn' | 'danger'

const toneClass: Record<StatusTone, string> = {
  ok: 'bg-ok-bg text-ok-text',
  warn: 'bg-warn-bg text-warn-text',
  danger: 'bg-danger-bg text-danger-text',
}

type StatusBadgeProps = {
  tone: StatusTone
  children: ReactNode
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-control px-2 py-1 font-body ${toneClass[tone]}`}
    >
      {children}
    </span>
  )
}
