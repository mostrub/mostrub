import type { QueryRow } from "@/lib/duckdb/engine"
import { cellText } from "@/lib/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DataTableProps = {
  rows: QueryRow[]
  onRowClick?: (row: QueryRow) => void
  maxHeight?: string
}

export function DataTable({ rows, onRowClick, maxHeight }: DataTableProps) {
  const columns = rows[0] ? Object.keys(rows[0]) : []
  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No rows for this filter.</p>
    )
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: maxHeight ?? "28rem" }}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={index}
              className={onRowClick ? "cursor-pointer" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column} className="font-mono text-xs">
                  {cellText(row[column] ?? null)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
