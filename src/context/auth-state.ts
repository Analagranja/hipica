import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Membresia } from '../lib/membresias.ts'
import type { Rol } from '../lib/roles.ts'

export type AuthContextValue = {
  sesion: Session | null
  cargando: boolean
  errorCarga: string | null
  membresias: Membresia[]
  clubActual: Membresia | null
  roles: Rol[]
  tieneRol: (rol: Rol) => boolean
  elegirClub: (clubId: string) => void
  recargarMembresias: (clubId?: string) => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const valor = useContext(AuthContext)
  if (!valor) {
    throw new Error('useAuth tiene que usarse dentro de AuthProvider.')
  }
  return valor
}
