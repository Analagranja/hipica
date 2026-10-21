import type { ReactNode } from 'react'

export type TableRow = {
  id: string
  cells: ReactNode[]
}

type TableProps = {
  columns: string[]
  rows: TableRow[]
}

export function Table({ columns, rows }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-left font-body">
        <thead className="bg-highlight">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border-b border-line px-4 py-3 font-body text-ink"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0">
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className="px-4 py-3 text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
