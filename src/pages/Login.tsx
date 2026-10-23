import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { Aviso, Campo, EnlaceAcceso, MarcoAcceso } from '../components/acceso/MarcoAcceso.tsx'
import { Button } from '../components/ui/Button.tsx'
import { mensajeErrorSupabase } from '../lib/errores.ts'
import { supabase } from '../lib/supabase.ts'

function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
}

export default function Login() {
  const location = useLocation()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = correo.trim().toLowerCase()

    if (!correoValido(email)) {
      setError('El correo no tiene un formato válido.')
      return
    }
    if (!contrasena) {
      setError('Ingresá tu contraseña.')
      return
    }

    setError(null)
    setEnviando(true)
    try {
      const { error: errorIngreso } = await supabase.auth.signInWithPassword({
        email,
        password: contrasena,
      })
      if (errorIngreso) setError(mensajeErrorSupabase(errorIngreso))
    } catch (causa) {
      setError(
        mensajeErrorSupabase(causa instanceof Error ? causa : { message: 'Failed to fetch' }),
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <MarcoAcceso title="Ingresar" description="Entrá con tu correo y contraseña.">
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
          autoComplete="current-password"
          value={contrasena}
          onChange={setContrasena}
          disabled={enviando}
        />
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <p className="font-body text-muted">
          ¿No tenés cuenta? <EnlaceAcceso to="/registro" state={location.state}>Crear una</EnlaceAcceso>
        </p>
      </form>
    </MarcoAcceso>
  )
}
