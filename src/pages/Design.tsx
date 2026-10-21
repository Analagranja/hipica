import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { MetricCard } from '../components/ui/MetricCard.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { StatusBadge } from '../components/ui/StatusBadge.tsx'
import { Table } from '../components/ui/Table.tsx'

const swatches = [
  { name: 'Lienzo', className: 'bg-canvas' },
  { name: 'Superficie', className: 'bg-surface' },
  { name: 'Línea', className: 'bg-line' },
  { name: 'Tinta', className: 'bg-ink' },
  { name: 'Apagado', className: 'bg-muted' },
  { name: 'Primario', className: 'bg-primary' },
  { name: 'Sobre primario', className: 'bg-on-primary' },
  { name: 'Dorado', className: 'bg-gold' },
  { name: 'Cuero', className: 'bg-leather' },
  { name: 'Resalte', className: 'bg-highlight' },
]

export default function Design() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sistema de diseño"
        description="Tokens, componentes y layout base para revisar la interfaz."
        action={<Button>Acción principal</Button>}
      />

      <section className="flex flex-col gap-4">
        <h2>Colores</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {swatches.map((swatch) => (
            <div
              key={swatch.name}
              className="overflow-hidden rounded-card border border-line bg-surface"
            >
              <div className={`h-12 ${swatch.className}`} />
              <p className="px-3 py-2 font-body text-ink">{swatch.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Tipografía</h2>
        <Card>
          <h3>Título con serif</h3>
          <p className="mt-2 font-body text-muted">
            El texto de lectura usa la fuente del cuerpo, sobre lienzo crema.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Botones</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Fantasma</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Estados</h2>
        <div className="flex flex-wrap gap-3">
          <StatusBadge tone="ok">Correcto</StatusBadge>
          <StatusBadge tone="warn">Aviso</StatusBadge>
          <StatusBadge tone="danger">Error</StatusBadge>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Métricas</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Muestra A" value="24" detail="Dato de ejemplo" />
          <MetricCard label="Muestra B" value="8" detail="Dato de ejemplo" />
          <MetricCard label="Muestra C" value="3" detail="Dato de ejemplo" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Tarjeta</h2>
        <Card>
          <h3>Superficie</h3>
          <p className="mt-2 font-body text-muted">
            Fondo claro, borde de línea y detalle dorado.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Tabla</h2>
        <Table
          columns={['Elemento', 'Uso', 'Estado']}
          rows={[
            {
              id: 'boton',
              cells: [
                'Botón primario',
                'Acción principal',
                <StatusBadge tone="ok">Correcto</StatusBadge>,
              ],
            },
            {
              id: 'aviso',
              cells: [
                'Aviso',
                'Estado intermedio',
                <StatusBadge tone="warn">Aviso</StatusBadge>,
              ],
            },
            {
              id: 'error',
              cells: [
                'Error',
                'Estado crítico',
                <StatusBadge tone="danger">Error</StatusBadge>,
              ],
            },
          ]}
        />
      </section>
    </div>
  )
}
