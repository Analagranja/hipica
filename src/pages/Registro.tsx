import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { Aviso, Campo, EnlaceAcceso, MarcoAcceso } from '../components/acceso/MarcoAcceso.tsx'
import { Button } from '../components/ui/Button.tsx'
import { leerDestino } from '../lib/destino.ts'
import { mensajeErrorSupabase } from '../lib/errores.ts'
import { supabase } from '../lib/supabase.ts'

function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
}

export default function Registro() {
  const location = useLocation()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState(false)

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = correo.trim().toLowerCase()

    if (!correoValido(email)) {
      setError('El correo no tiene un formato válido.')
      return
    }
    if (contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setError(null)
    setEnviando(true)
    try {
      const destino = leerDestino(location.state)
      const { data, error: errorRegistro } = await supabase.auth.signUp({
        email,
        password: contrasena,
        options: {
          emailRedirectTo: `${window.location.origin}${destino ?? '/'}`,
        },
      })

      if (errorRegistro) {
        setError(mensajeErrorSupabase(errorRegistro))
        return
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('Ya existe una cuenta con ese correo.')
        return
      }

      if (!data.session) setConfirmacion(true)
    } catch (causa) {
      setError(
        mensajeErrorSupabase(causa instanceof Error ? causa : { message: 'Failed to fetch' }),
      )
    } finally {
      setEnviando(false)
    }
  }

  if (confirmacion) {
    return (
      <MarcoAcceso title="Crear cuenta" description="Te enviamos un correo para confirmarla.">
        <Aviso tono="ok">Revisá tu correo para confirmar tu cuenta</Aviso>
        <EnlaceAcceso to="/login" state={location.state}>
          Ir a ingresar
        </EnlaceAcceso>
      </MarcoAcceso>
    )
  }

  return (
    <MarcoAcceso title="Crear cuenta" description="Usá un correo al que tengas acceso.">
      <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void enviar(event)}>
        {error ? <Aviso tono="danger">{error}</Aviso> : null}
        <Campo
          id="correo"
          label="Correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={setCorreo}
          disabled={enviando}
        />
        <Campo
          id="contrasena"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          value={contrasena}
          onChange={setContrasena}
          disabled={enviando}
        />
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
        <p className="font-body text-muted">
          ¿Ya tenés cuenta? <EnlaceAcceso to="/login" state={location.state}>Ingresar</EnlaceAcceso>
        </p>
      </form>
    </MarcoAcceso>
  )
}
