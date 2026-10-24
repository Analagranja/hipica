type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoComplete?: string
  type?: 'text' | 'date'
}

export function TextField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  autoComplete = 'off',
  type = 'text',
}: TextFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 font-body text-ink">
      {label}
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-control border border-line bg-surface px-3 py-2 font-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold disabled:opacity-60"
      />
    </label>
  )
}
