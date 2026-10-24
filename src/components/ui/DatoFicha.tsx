type DatoFichaProps = {
  etiqueta: string
  valor: string
}

export function DatoFicha({ etiqueta, valor }: DatoFichaProps) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-highlight/60 px-3 py-3">
      <p className="font-body text-sm text-muted">{etiqueta}</p>
      <p className="font-body whitespace-pre-wrap text-ink">{valor}</p>
    </div>
  )
}
