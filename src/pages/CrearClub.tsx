import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Aviso, Campo, EnlaceAcceso, MarcoAcceso } from '../components/acceso/MarcoAcceso.tsx'
import { Button } from '../components/ui/Button.tsx'
import { useAuth } from '../context/auth-state.ts'
import { mensajeErrorSupabase } from '../lib/errores.ts'
import { supabase } from '../lib/supabase.ts'

export default function CrearClub() {
  const navigate = useNavigate()
  const { membresias, recargarMembresias, cerrarSesion } = useAuth()
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const yaTieneClub = membresias.length > 0

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const limpio = nombre.trim()

    if (!limpio) {
      setError('Ingresá el nombre del club.')
      return
    }
    if (limpio.length > 80) {
      setError('El nombre puede tener hasta 80 caracteres.')
      return
    }

    setError(null)
    setEnviando(true)
    try {
      const { data, error: errorClub } = await supabase.rpc('crear_club', {
        p_nombre: limpio,
      })
      if (errorClub) {
        setError(mensajeErrorSupabase(errorClub))
        return
      }

      const clubId = typeof data === 'string' ? data : undefined
      await recargarMembresias(clubId)
      navigate('/', { replace: true })
    } catch (causa) {
      setError(
        mensajeErrorSupabase(causa instanceof Error ? causa : { message: 'Failed to fetch' }),
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <MarcoAcceso
      title="Crear club"
      description={
        yaTieneClub
          ? 'Vas a quedar como administrador de este club.'
          : 'Todavía no pertenecés a un club. Creá uno para empezar.'
      }
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void enviar(event)}>
        {error ? <Aviso tono="danger">{error}</Aviso> : null}
        <Campo
          id="nombre-club"
          label="Nombre del club"
          type="text"
          autoComplete="organization"
          value={nombre}
          onChange={setNombre}
          disabled={enviando}
          maxLength={80}
        />
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Creando club…' : 'Crear club'}
        </Button>
        {yaTieneClub ? <EnlaceAcceso to="/">Volver al inicio</EnlaceAcceso> : null}
        <Button
          variant="ghost"
          className="w-full"
          disabled={enviando}
          onClick={() => void cerrarSesion()}
        >
          Cerrar sesión
        </Button>
      </form>
    </MarcoAcceso>
  )
}
