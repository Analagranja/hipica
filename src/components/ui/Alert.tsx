import type { ReactNode } from 'react'

type AlertTone = 'ok' | 'danger'

const toneClass: Record<AlertTone, string> = {
  ok: 'bg-ok-bg text-ok-text',
  danger: 'bg-danger-bg text-danger-text',
}

type AlertProps = {
  tone: AlertTone
  children: ReactNode
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <p
      role={tone === 'ok' ? 'status' : 'alert'}
      className={`rounded-control px-3 py-2 font-body ${toneClass[tone]}`}
    >
      {children}
    </p>
  )
}
