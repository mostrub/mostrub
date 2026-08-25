import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { downloadBytes, downloadText } from "@/lib/download"
import {
  ingestBatches,
  initEngine,
  queryRows,
  resetEngine,
  exportCopy,
  tableCount,
} from "@/lib/duckdb/engine"
import {
  EMPTY_FILTERS,
  activeFilterCount,
  decodeFilters,
  encodeFilters,
  sqlFrom,
} from "@/lib/filters"
import { FACET_SQL } from "@/lib/queries"
import { buildAutoReports } from "@/lib/reports"
import {
  APP_VIEWS,
  isAppView,
  type AppView,
  type AutoReport,
  type FilterFacet,
  type IngestFileRow,
  type ProductionFilters,
  type TableName,
} from "@/lib/types"
import { parseProductionXml } from "@/lib/xml/parse-production"
import { parseShareSamples } from "@/lib/xml/sample-production"

type FloorlineState = {
  ready: boolean
  loading: boolean
  error: string | null
  view: AppView
  filters: ProductionFilters
  facets: FilterFacet
  files: IngestFileRow[]
  reports: AutoReport[]
  rowCounts: Record<TableName, number>
  filterCount: number
  setView: (view: AppView) => void
  setFilters: (filters: ProductionFilters) => void
  patchFilters: (patch: Partial<ProductionFilters>) => void
  clearFilters: () => void
  ingestFiles: (fileList: File[]) => Promise<void>
  ingestDemo: () => Promise<void>
  clearData: () => Promise<void>
  exportTable: (args: { table: TableName; format: "csv" | "parquet" }) => Promise<void>
  shareUrl: () => string
}

const EMPTY_FACETS: FilterFacet = {
  plants: [],
  lines: [],
  stations: [],
  machines: [],
  controllers: [],
  servers: [],
  shifts: [],
  skus: [],
  workOrders: [],
}

const EMPTY_COUNTS: Record<TableName, number> = {
  ingest_files: 0,
  cycles: 0,
  downtime: 0,
  alarms: 0,
  server_samples: 0,
  controllers: 0,
}

const FloorlineContext = createContext<FloorlineState | null>(null)

function parseHash(): { view: AppView; filters: ProductionFilters } {
  const raw = window.location.hash.replace(/^#/, "")
  const [path, query = ""] = raw.split("?")
  const view = isAppView(path) ? path : "ingest"
  const params = new URLSearchParams(query)
  const encoded = params.get("f")
  const filters = encoded ? decodeFilters(encoded) : null
  return { view, filters: filters ?? EMPTY_FILTERS }
}

function writeHash(view: AppView, filters: ProductionFilters): void {
  const count = activeFilterCount(filters)
  const suffix = count > 0 ? `?f=${encodeFilters(filters)}` : ""
  const next = `#${view}${suffix}`
  if (window.location.hash !== next) {
    window.history.replaceState(null, "", next)
  }
}

export function FloorlineProvider({ children }: { children: ReactNode }) {
  const initial = typeof window === "undefined" ? null : parseHash()
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setViewState] = useState<AppView>(initial?.view ?? "ingest")
  const [filters, setFiltersState] = useState<ProductionFilters>(
    initial?.filters ?? EMPTY_FILTERS
  )
  const [facets, setFacets] = useState<FilterFacet>(EMPTY_FACETS)
  const [files, setFiles] = useState<IngestFileRow[]>([])
  const [reports, setReports] = useState<AutoReport[]>([])
  const [rowCounts, setRowCounts] = useState(EMPTY_COUNTS)

  const refreshMeta = useCallback(async () => {
    const fileRows = await queryRows(
      "SELECT * FROM ingest_files ORDER BY ingested_at DESC"
    )
    setFiles(
      fileRows.map((row) => ({
        file_id: String(row.file_id ?? ""),
        file_name: String(row.file_name ?? ""),
        source_share: String(row.source_share ?? ""),
        plant: String(row.plant ?? ""),
        shift: String(row.shift ?? ""),
        shift_date: String(row.shift_date ?? ""),
        ingested_at: String(row.ingested_at ?? ""),
        byte_size: Number(row.byte_size ?? 0),
        cycle_count: Number(row.cycle_count ?? 0),
        downtime_count: Number(row.downtime_count ?? 0),
        alarm_count: Number(row.alarm_count ?? 0),
        server_sample_count: Number(row.server_sample_count ?? 0),
        controller_count: Number(row.controller_count ?? 0),
        status: row.status === "error" ? "error" : "ok",
        error_message: String(row.error_message ?? ""),
      }))
    )

    const [plants, lines, stations, machines, controllers, servers, shifts, skus, workOrders] =
      await Promise.all([
        queryRows(FACET_SQL.plants),
        queryRows(FACET_SQL.lines),
        queryRows(FACET_SQL.stations),
        queryRows(FACET_SQL.machines),
        queryRows(FACET_SQL.controllers),
        queryRows(FACET_SQL.servers),
        queryRows(FACET_SQL.shifts),
        queryRows(FACET_SQL.skus),
        queryRows(FACET_SQL.workOrders),
      ])

    setFacets({
      plants: plants.map((row) => String(row.value ?? "")),
      lines: lines.map((row) => String(row.value ?? "")),
      stations: stations.map((row) => String(row.value ?? "")),
      machines: machines.map((row) => String(row.value ?? "")),
      controllers: controllers.map((row) => String(row.value ?? "")),
      servers: servers.map((row) => String(row.value ?? "")),
      shifts: shifts.map((row) => String(row.value ?? "")),
      skus: skus.map((row) => String(row.value ?? "")),
      workOrders: workOrders.map((row) => String(row.value ?? "")),
    })

    const counts = { ...EMPTY_COUNTS }
    for (const table of Object.keys(EMPTY_COUNTS) as TableName[]) {
      counts[table] = await tableCount(table)
    }
    setRowCounts(counts)
  }, [])

  useEffect(() => {
    let cancelled = false
    initEngine()
      .then(() => {
        if (!cancelled) {
          setReady(true)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "DuckDB failed to start")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    writeHash(view, filters)
  }, [view, filters])

  useEffect(() => {
    if (!ready || files.length === 0) {
      return
    }
    let cancelled = false
    buildAutoReports(filters)
      .then((next) => {
        if (!cancelled) {
          setReports(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReports([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [ready, files.length, filters])

  const setView = useCallback((next: AppView) => {
    if (!APP_VIEWS.includes(next)) {
      return
    }
    setViewState(next)
  }, [])

  const setFilters = useCallback((next: ProductionFilters) => {
    setFiltersState(next)
  }, [])

  const patchFilters = useCallback((patch: Partial<ProductionFilters>) => {
    setFiltersState((current) => ({ ...current, ...patch }))
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY_FILTERS)
  }, [])

  const ingestFiles = useCallback(
    async (fileList: File[]) => {
      setLoading(true)
      setError(null)
      try {
        const batches = await Promise.all(
          fileList.map(async (file) => {
            const xml = await file.text()
            return parseProductionXml({
              fileName: file.name,
              xml,
              byteSize: file.size,
            })
          })
        )
        await ingestBatches(batches)
        await refreshMeta()
        const ok = batches.filter((batch) => batch.file.status === "ok").length
        toast.success(`Ingested ${ok} XML file${ok === 1 ? "" : "s"} into DuckDB`)
        setViewState("dashboard")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ingest failed"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [refreshMeta]
  )

  const ingestDemo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ingestBatches(parseShareSamples())
      await refreshMeta()
      toast.success("Loaded demo production share (3 XML files)")
      setViewState("dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Demo load failed"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [refreshMeta])

  const clearData = useCallback(async () => {
    setLoading(true)
    try {
      await resetEngine()
      setFiles([])
      setFacets(EMPTY_FACETS)
      setReports([])
      setRowCounts(EMPTY_COUNTS)
      toast.success("Cleared DuckDB tables")
    } finally {
      setLoading(false)
    }
  }, [])

  const exportTable = useCallback(
    async (args: { table: TableName; format: "csv" | "parquet" }) => {
      const sql = `SELECT * FROM ${sqlFrom(args.table, filters)}`
      const bytes = await exportCopy({ sql, format: args.format })
      downloadBytes({
        bytes,
        fileName: `${args.table}.${args.format}`,
        mime:
          args.format === "parquet"
            ? "application/vnd.apache.parquet"
            : "text/csv",
      })
      toast.success(`Exported ${args.table}.${args.format}`)
    },
    [filters]
  )

  const shareUrl = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#${view}?f=${encodeFilters(filters)}`
    return url
  }, [filters, view])

  const value = useMemo<FloorlineState>(
    () => ({
      ready,
      loading,
      error,
      view,
      filters,
      facets,
      files,
      reports,
      rowCounts,
      filterCount: activeFilterCount(filters),
      setView,
      setFilters,
      patchFilters,
      clearFilters,
      ingestFiles,
      ingestDemo,
      clearData,
      exportTable,
      shareUrl,
    }),
    [
      ready,
      loading,
      error,
      view,
      filters,
      facets,
      files,
      reports,
      rowCounts,
      setView,
      setFilters,
      patchFilters,
      clearFilters,
      ingestFiles,
      ingestDemo,
      clearData,
      exportTable,
      shareUrl,
    ]
  )

  return (
    <FloorlineContext.Provider value={value}>
      {children}
    </FloorlineContext.Provider>
  )
}

export function useFloorline(): FloorlineState {
  const ctx = useContext(FloorlineContext)
  if (!ctx) {
    throw new Error("useFloorline must be used inside FloorlineProvider")
  }
  return ctx
}

export function downloadShareCard(args: {
  url: string
  filters: ProductionFilters
}): void {
  downloadText({
    text: JSON.stringify(
      {
        app: "floorline",
        url: args.url,
        filters: args.filters,
        savedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    fileName: "floorline-share.json",
    mime: "application/json",
  })
}
