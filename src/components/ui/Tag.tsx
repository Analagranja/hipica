import type { ReactNode } from 'react'

type TagProps = {
  children: ReactNode
}

export function Tag({ children }: TagProps) {
  return (
    <span className="inline-flex items-center rounded-control bg-highlight px-2 py-1 font-body text-ink">
      {children}
    </span>
  )
}
