type CheckboxProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Checkbox({ id, label, checked, onChange, disabled = false }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 font-body text-ink">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary disabled:opacity-60"
      />
      {label}
    </label>
  )
}
