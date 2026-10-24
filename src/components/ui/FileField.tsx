type FileFieldProps = {
  id: string
  label: string
  accept?: string
  disabled?: boolean
  onChange: (file: File | null) => void
}

export function FileField({ id, label, accept, disabled = false, onChange }: FileFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 font-body text-ink">
      {label}
      <input
        id={id}
        name={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="w-full rounded-control border border-line bg-surface px-3 py-2 font-body text-ink file:mr-3 file:rounded-control file:border-0 file:bg-highlight file:px-3 file:py-2 file:font-body file:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-gold disabled:opacity-60"
      />
    </label>
  )
}
