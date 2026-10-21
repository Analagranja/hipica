import { Card } from './Card.tsx'

type MetricCardProps = {
  label: string
  value: string
  detail?: string
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card>
      <p className="font-body text-muted">{label}</p>
      <p className="mt-2 font-heading text-ink">{value}</p>
      {detail ? <p className="mt-2 font-body text-muted">{detail}</p> : null}
    </Card>
  )
}
