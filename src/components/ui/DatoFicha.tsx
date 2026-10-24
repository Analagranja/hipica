type DatoFichaProps = {
  etiqueta: string
  valor: string
}

export function DatoFicha({ etiqueta, valor }: DatoFichaProps) {
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <p className="bg-primary px-3 py-1.5 font-body text-[12px] text-on-primary">{etiqueta}</p>
      <p className="bg-highlight px-3 py-2 font-body text-[15px] whitespace-pre-wrap text-ink">{valor}</p>
    </div>
  )
}
