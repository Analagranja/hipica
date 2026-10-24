import { useState } from 'react'

type AvatarProps = {
  nombre: string
  src?: string | null
  size?: 'md' | 'lg'
  alt?: string
}

const tamano = {
  md: 'size-16 text-lg',
  lg: 'size-40 text-3xl',
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const letras = partes.slice(0, 2).map((parte) => parte.charAt(0).toLocaleUpperCase('es'))
  return letras.join('') || 'C'
}

export function Avatar({ nombre, src = null, size = 'md', alt = '' }: AvatarProps) {
  return <Retrato key={src ?? 'sin-foto'} nombre={nombre} src={src} size={size} alt={alt} />
}

function Retrato({
  nombre,
  src,
  size,
  alt,
}: {
  nombre: string
  src: string | null
  size: 'md' | 'lg'
  alt: string
}) {
  const [falla, setFalla] = useState(false)
  const clase = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-highlight font-heading text-ink ${tamano[size]}`

  if (!src || falla) {
    return (
      <span
        className={clase}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        {iniciales(nombre)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${clase} object-cover`}
      onError={() => setFalla(true)}
    />
  )
}
