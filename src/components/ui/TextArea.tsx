type TextAreaProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TextArea({ id, label, value, onChange, disabled = false }: TextAreaProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 font-body text-ink">
      {label}
      <textarea
        id={id}
        name={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-control border border-line bg-surface px-3 py-2 font-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold disabled:opacity-60"
      />
    </label>
  )
}
