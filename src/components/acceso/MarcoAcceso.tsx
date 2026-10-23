import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Card } from '../ui/Card.tsx'
import { PageHeader } from '../ui/PageHeader.tsx'

const claseCampo =
  'w-full rounded-control border border-line bg-surface px-3 py-2 font-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold'

type MarcoAccesoProps = {
  title: string
  description?: string
  children: ReactNode
}

export function MarcoAcceso({ title, description, children }: MarcoAccesoProps) {
  return (
    <div className="flex min-h-svh flex-col items-center bg-canvas px-4 py-8 font-body text-ink md:justify-center">
      <div className="flex w-full max-w-md flex-col gap-6">
        <PageHeader title={title} description={description} />
        <Card>
          <div className="flex flex-col gap-4">{children}</div>
        </Card>
      </div>
    </div>
  )
}

type CampoProps = {
  id: string
  label: string
  type?: 'email' | 'password' | 'text'
  autoComplete?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  maxLength?: number
}

export function Campo({
  id,
  label,
  type = 'text',
  autoComplete,
  value,
  onChange,
  disabled = false,
  maxLength,
}: CampoProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 font-body text-ink">
      {label}
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize={type === 'email' ? 'none' : undefined}
        spellCheck={type === 'email' ? false : undefined}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={claseCampo}
      />
    </label>
  )
}

type AvisoProps = {
  tono: 'ok' | 'danger'
  children: ReactNode
}

export function Aviso({ tono, children }: AvisoProps) {
  const clase = tono === 'ok' ? 'bg-ok-bg text-ok-text' : 'bg-danger-bg text-danger-text'

  return (
    <p
      role={tono === 'ok' ? 'status' : 'alert'}
      className={`rounded-control px-3 py-2 font-body ${clase}`}
    >
      {children}
    </p>
  )
}

type EnlaceAccesoProps = {
  to: string
  state?: unknown
  children: ReactNode
}

export function EnlaceAcceso({ to, state, children }: EnlaceAccesoProps) {
  return (
    <Link
      to={to}
      state={state}
      className="font-body text-primary underline decoration-gold underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold"
    >
      {children}
    </Link>
  )
}
