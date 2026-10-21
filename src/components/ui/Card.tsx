import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <section
      className={`overflow-hidden rounded-card border border-line bg-surface ${className}`}
    >
      <div className="h-1 bg-gold" aria-hidden="true" />
      <div className="p-4">{children}</div>
    </section>
  )
}
