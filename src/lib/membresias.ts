import { mensajeErrorSupabase } from './errores.ts'
import { supabase } from './supabase.ts'

export type ColorAcento = 'dorado' | 'bronce' | 'borravino'

export type ClubResumen = {
  nombre: string
  logo_url: string | null
  color_acento: ColorAcento
}

export type Membresia = {
  club_id: string
  persona_id: string
  club: ClubResumen
}

type ClubCrudo = {
  nombre: string | null
  logo_url: string | null
  color_acento: string | null
}

type FilaMembresia = {
  club_id: string
  persona_id: string
  clubes: ClubCrudo | ClubCrudo[] | null
}

function esColor(valor: string | null | undefined): valor is ColorAcento {
  return valor === 'dorado' || valor === 'bronce' || valor === 'borravino'
}

function primerClub(valor: ClubCrudo | ClubCrudo[] | null): ClubCrudo | null {
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor
}

function normalizar(filas: FilaMembresia[] | null): Membresia[] {
  const lista = (filas ?? []).flatMap((fila) => {
    if (!fila.club_id || !fila.persona_id) return []
    const crudo = primerClub(fila.clubes)
    const membresia: Membresia = {
      club_id: fila.club_id,
      persona_id: fila.persona_id,
      club: {
        nombre: crudo?.nombre?.trim() || 'Club',
        logo_url: crudo?.logo_url ?? null,
        color_acento: esColor(crudo?.color_acento) ? crudo.color_acento : 'dorado',
      },
    }
    return [membresia]
  })

  lista.sort((a, b) => a.club.nombre.localeCompare(b.club.nombre, 'es'))
  return lista
}

export async function obtenerMembresias(usuarioId: string): Promise<Membresia[]> {
  const { data, error } = await supabase
    .from('membresias')
    .select('club_id, persona_id, clubes(nombre, logo_url, color_acento)')
    .eq('usuario_id', usuarioId)
    .eq('activa', true)

  if (error) throw new Error(mensajeErrorSupabase(error))

  return normalizar(data as FilaMembresia[] | null)
}
