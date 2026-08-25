import { useEffect, useState } from "react"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows, queryValue } from "@/lib/duckdb/engine"
import { explorerCountSql, explorerSql } from "@/lib/queries"
import { FieldDescription } from "@/components/ui/field"
import { TABLE_NAMES, type TableName } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DataTable } from "@/components/data-table"
import { EmptyProduction } from "@/components/empty-production"
import { useFloorline } from "@/state/floorline-store"

const PAGE_SIZE = 50

const DEFAULT_SORT: Record<TableName, string> = {
  ingest_files: "ingested_at",
  cycles: "started_at",
  downtime: "started_at",
  alarms: "raised_at",
  server_samples: "sampled_at",
  controllers: "last_seen",
}

export function ExplorerPage() {
  const { filters, rowCounts, ready, patchFilters, runSql } = useFloorline()
  const [table, setTable] = useState<TableName>("cycles")
  const [sortColumn, setSortColumn] = useState(DEFAULT_SORT.cycles)
  const [sqlText, setSqlText] = useState(
    "SELECT plant, line, result, COUNT(*) AS n FROM cycles GROUP BY 1,2,3 ORDER BY n DESC"
  )
  const [sqlRows, setSqlRows] = useState<QueryRow[]>([])
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC")
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<QueryRow[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [table, filters, sortColumn, sortDir])

  useEffect(() => {
    if (!ready || rowCounts[table] === 0) {
      setRows([])
      setTotal(0)
      return
    }
    let cancelled = false
    const sql = explorerSql({
      table,
      filters,
      sortColumn,
      sortDir,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
    setTableError(null)
    Promise.all([
      queryRows(sql),
      queryValue(explorerCountSql({ table, filters })),
    ])
      .then(([nextRows, count]) => {
        if (cancelled) {
          return
        }
        setRows(nextRows)
        setTotal(count)
        const first = nextRows[0]
        if (first && !(sortColumn in first)) {
          const fallback = Object.keys(first)[0]
          if (fallback) {
            setSortColumn(fallback)
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTableError(err instanceof Error ? err.message : "Tabellenabfrage fehlgeschlagen")
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, page, ready, rowCounts, sortColumn, sortDir, table])

  const columns = rows[0] ? Object.keys(rows[0]) : []
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const hasData = Object.values(rowCounts).some((count) => count > 0)
  if (ready && !hasData) {
    return (
      <EmptyProduction
        title="Keine Tabellen geladen"
        description="Produktionsdateien laden, um Takte, Stillstand, Alarme und Server zu sehen."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Tabellen</h2>
        <p className="text-sm text-muted-foreground">
          Gefilterter Tabellenscan mit Sortierung und Seiten. Die Suche trifft
          Textspalten über ILIKE.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tabelle</CardTitle>
          <CardDescription>
            {total} Zeilen nach Filter · Seite {page + 1} / {pages}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-52">
              <FieldLabel>Quelle</FieldLabel>
              <Select
                value={table}
                onValueChange={(value) => {
                  if (typeof value === "string" && isTable(value)) {
                    setTable(value)
                    setSortColumn(DEFAULT_SORT[value])
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TABLE_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name} ({rowCounts[name]})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-52">
              <FieldLabel>Sortierung</FieldLabel>
              <Select
                value={sortColumn}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setSortColumn(value)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {columns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <ToggleGroup
              value={[sortDir]}
              onValueChange={(values) => {
                const next = values[0]
                if (next === "ASC" || next === "DESC") {
                  setSortDir(next)
                }
              }}
            >
              <ToggleGroupItem value="ASC">ASC</ToggleGroupItem>
              <ToggleGroupItem value="DESC">DESC</ToggleGroupItem>
            </ToggleGroup>
            <Field className="min-w-56 flex-1">
              <FieldLabel htmlFor="rail-search">Schnellsuche</FieldLabel>
              <Input
                id="rail-search"
                value={filters.search}
                placeholder="Dieselbe Suche wie in der Leiste"
                onChange={(event) => patchFilters({ search: event.target.value })}
              />
            </Field>
          </div>
          {tableError ? (
            <p className="text-sm text-destructive">{tableError}</p>
          ) : null}
          <DataTable
            rows={rows}
            emptyLabel="Keine Zeilen in dieser Tabelle für den aktuellen Filter."
            maxHeight="32rem"
            onRowClick={(row) => {
              const serial = row.serial
              const code = row.code ?? row.fail_code ?? row.reason_code
              if (typeof serial === "string" && serial !== "") {
                patchFilters({ search: serial })
                return
              }
              if (typeof code === "string" && code !== "") {
                patchFilters({ search: code })
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Weiter
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SQL-Konsole</CardTitle>
          <CardDescription>
            Nur SELECT / WITH auf denselben DuckDB-Tabellen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="sql">Abfrage</FieldLabel>
            <textarea
              id="sql"
              value={sqlText}
              onChange={(event) => setSqlText(event.target.value)}
              rows={5}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <FieldDescription>
              Schreiben, COPY und mehrere Anweisungen sind gesperrt.
            </FieldDescription>
          </Field>
          {sqlError ? (
            <p className="text-sm text-destructive">{sqlError}</p>
          ) : null}
          <Button
            onClick={() => {
              setSqlError(null)
              void runSql(sqlText)
                .then((rows) => setSqlRows(rows))
                .catch((err: unknown) => {
                  setSqlRows([])
                  setSqlError(err instanceof Error ? err.message : "Abfrage fehlgeschlagen")
                })
            }}
          >
            Ausführen
          </Button>
          <DataTable rows={sqlRows} maxHeight="20rem" />
        </CardContent>
      </Card>
    </div>
  )
}

function isTable(value: string): value is TableName {
  return (TABLE_NAMES as readonly string[]).includes(value)
}
