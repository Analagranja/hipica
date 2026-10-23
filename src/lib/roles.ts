import { mensajeErrorSupabase } from './errores.ts'
import { supabase } from './supabase.ts'

export type Rol =
  | 'administrador'
  | 'profesor'
  | 'caballerizo'
  | 'propietario'
  | 'alumno'

function esRol(valor: string | null): valor is Rol {
  return (
    valor === 'administrador' ||
    valor === 'profesor' ||
    valor === 'caballerizo' ||
    valor === 'propietario' ||
    valor === 'alumno'
  )
}

export async function obtenerRoles(personaId: string): Promise<Rol[]> {
  const { data, error } = await supabase
    .from('roles_persona')
    .select('rol')
    .eq('persona_id', personaId)

  if (error) throw new Error(mensajeErrorSupabase(error))

  const filas = (data ?? []) as { rol: string | null }[]
  return filas.flatMap((fila) => (esRol(fila.rol) ? [fila.rol] : []))
}
