import type { KeyboardEvent } from "react"

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
  emptyLabel?: string
  selectedKey?: string
  rowKey?: (row: QueryRow) => string
}

export function DataTable({
  rows,
  onRowClick,
  maxHeight,
  emptyLabel,
  selectedKey,
  rowKey,
}: DataTableProps) {
  const columns = rows[0] ? Object.keys(rows[0]) : []
  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? "No rows for this filter."}
      </p>
    )
  }

  function activate(row: QueryRow): void {
    onRowClick?.(row)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: QueryRow): void {
    if (!onRowClick) {
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      activate(row)
    }
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
          {rows.map((row, index) => {
            const key = rowKey
              ? rowKey(row)
              : columns.map((column) => String(row[column] ?? "")).join("|")
            const selected = selectedKey !== undefined && key === selectedKey
            return (
              <TableRow
                key={index}
                className={
                  onRowClick
                    ? selected
                      ? "cursor-pointer bg-muted"
                      : "cursor-pointer"
                    : undefined
                }
                data-selected={selected ? "true" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={onRowClick ? selected : undefined}
                onClick={onRowClick ? () => activate(row) : undefined}
                onKeyDown={(event) => onKeyDown(event, row)}
              >
                {columns.map((column) => (
                  <TableCell key={column} className="font-mono text-xs">
                    {cellText(row[column] ?? null)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
