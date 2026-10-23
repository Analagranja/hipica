type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: SelectProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 font-body text-ink">
      {label}
      <select
        id={id}
        name={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-control border border-line bg-surface px-3 py-2 font-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
