import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { mensajeErrorSupabase } from '../lib/errores.ts'
import { obtenerMembresias, type Membresia } from '../lib/membresias.ts'
import { supabase } from '../lib/supabase.ts'
import { AuthContext, type AuthContextValue } from './auth-state.ts'

const CLAVE_CLUB = 'clubhipico.club-actual'

type ClubGuardado = {
  usuarioId: string
  clubId: string
}

function leerClubGuardado(usuarioId: string): string | null {
  try {
    const raw = localStorage.getItem(CLAVE_CLUB)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ClubGuardado>
    if (parsed.usuarioId === usuarioId && typeof parsed.clubId === 'string') {
      return parsed.clubId
    }
  } catch {
    return null
  }
  return null
}

function guardarClub(usuarioId: string, clubId: string) {
  const valor: ClubGuardado = { usuarioId, clubId }
  localStorage.setItem(CLAVE_CLUB, JSON.stringify(valor))
}

function olvidarClub() {
  localStorage.removeItem(CLAVE_CLUB)
}

function resolverClub(
  lista: Membresia[],
  usuarioId: string,
  preferido?: string,
): Membresia | null {
  if (lista.length === 0) return null
  const preferida = preferido
    ? lista.find((item) => item.club_id === preferido)
    : undefined
  const guardada = lista.find((item) => item.club_id === leerClubGuardado(usuarioId))
  const elegido = preferida ?? guardada ?? lista[0]
  guardarClub(usuarioId, elegido.club_id)
  return elegido
}

type Sincronizar = (session: Session | null, clubId?: string) => Promise<void>

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [membresias, setMembresias] = useState<Membresia[]>([])
  const [clubActual, setClubActual] = useState<Membresia | null>(null)
  const sincronizarRef = useRef<Sincronizar>(async () => {})
  const membresiasRef = useRef<Membresia[]>([])
  const sesionRef = useRef<Session | null>(null)

  useEffect(() => {
    membresiasRef.current = membresias
    sesionRef.current = sesion
  }, [membresias, sesion])

  useEffect(() => {
    let activo = true
    let ticket = 0

    const sincronizar: Sincronizar = async (session, clubId) => {
      const actual = ++ticket

      if (!session) {
        if (!activo || actual !== ticket) return
        setMembresias([])
        setClubActual(null)
        setErrorCarga(null)
        setCargando(false)
        olvidarClub()
        return
      }

      try {
        const lista = await obtenerMembresias(session.user.id)
        if (!activo || actual !== ticket) return
        setMembresias(lista)
        setClubActual(resolverClub(lista, session.user.id, clubId))
        setErrorCarga(null)
      } catch (error) {
        if (!activo || actual !== ticket) return
        setMembresias([])
        setClubActual(null)
        setErrorCarga(
          error instanceof Error ? error.message : 'No se pudieron cargar tus clubes.',
        )
      } finally {
        if (activo && actual === ticket) setCargando(false)
      }
    }

    sincronizarRef.current = sincronizar

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!activo) return
      setSesion(session)
      if (event === 'TOKEN_REFRESHED') return
      setCargando(true)
      window.setTimeout(() => {
        if (!activo) return
        void sincronizar(session)
      }, 0)
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  const elegirClub = useCallback((clubId: string) => {
    const usuarioId = sesionRef.current?.user.id
    const elegida = membresiasRef.current.find((item) => item.club_id === clubId)
    if (!usuarioId || !elegida) return
    setClubActual(elegida)
    guardarClub(usuarioId, clubId)
  }, [])

  const recargarMembresias = useCallback(async (clubId?: string) => {
    setCargando(true)
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      setErrorCarga(mensajeErrorSupabase(error))
      setCargando(false)
      return
    }
    await sincronizarRef.current(data.session, clubId)
  }, [])

  const cerrarSesion = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) setErrorCarga(mensajeErrorSupabase(error))
  }, [])

  const valor = useMemo<AuthContextValue>(
    () => ({
      sesion,
      cargando,
      errorCarga,
      membresias,
      clubActual,
      elegirClub,
      recargarMembresias,
      cerrarSesion,
    }),
    [
      sesion,
      cargando,
      errorCarga,
      membresias,
      clubActual,
      elegirClub,
      recargarMembresias,
      cerrarSesion,
    ],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
