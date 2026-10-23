import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { useAuth } from '../context/auth-state.ts'

const claseCampo =
  'w-full rounded-control border border-line bg-surface px-3 py-2 font-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold'

export default function Inicio() {
  const { clubActual, membresias, elegirClub, cerrarSesion } = useAuth()
  const nombre = clubActual?.club.nombre ?? 'Inicio'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={nombre}
        description="Inicio del club."
        action={
          <Button variant="ghost" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </Button>
        }
      />

      {membresias.length > 1 ? (
        <Card>
          <label htmlFor="club-actual" className="flex flex-col gap-2 font-body text-ink">
            Club actual
            <select
              id="club-actual"
              className={claseCampo}
              value={clubActual?.club_id ?? ''}
              onChange={(event) => elegirClub(event.target.value)}
            >
              {membresias.map((item) => (
                <option key={item.club_id} value={item.club_id}>
                  {item.club.nombre}
                </option>
              ))}
            </select>
          </label>
        </Card>
      ) : null}
    </div>
  )
}
