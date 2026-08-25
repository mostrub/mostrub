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
  exportFloorlineDbBytes,
  ingestBatches,
  ingestTabularFile,
  initEngine,
  loadFloorlineDbBytes,
  queryRows,
  resetEngine,
  exportCopy,
  tableCount,
  type QueryRow,
} from "@/lib/duckdb/engine"
import {
  canPickShareDirectory,
  isAbortError,
  listShareDbNames,
  pickShareDirectory,
  readShareDbFile,
  readShareFolderSnapshot,
  requestDirectoryPermission,
  saveLastShareDbName,
  writeShareDbFile,
  type ShareDirectoryHandle,
} from "@/lib/duckdb/share-folder"
import { sanitizeDbFileName, suggestedDbFileName } from "@/lib/duckdb/share-db"
import { classifyIngestName, pickIngestFiles } from "@/lib/ingest-kind"
import {
  loadPresets,
  removePreset,
  savePresets,
  upsertPreset,
  type FilterPreset,
} from "@/lib/presets"
import { assertReadOnlySelect } from "@/lib/sql-guard"
import {
  EMPTY_FILTERS,
  activeFilterCount,
  decodeFilters,
  sqlFrom,
  viewHash,
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
  restoreFailed: TableName[]
  dismissRestoreFailed: () => void
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
  canUseShareFolder: boolean
  shareFolderName: string | null
  shareFolderPermitted: boolean
  shareDbNames: string[]
  activeShareDbName: string | null
  suggestedShareDbName: string
  pickShareFolder: () => Promise<void>
  grantShareFolder: () => Promise<void>
  refreshShareDbs: () => Promise<void>
  saveShareDb: (name: string) => Promise<void>
  loadShareDb: (fileName: string) => Promise<void>
  downloadShareDb: (name: string) => Promise<void>
  loadShareDbFile: (file: File) => Promise<void>
  exportTable: (args: { table: TableName; format: "csv" | "parquet" }) => Promise<void>
  shareUrl: () => string
  presets: FilterPreset[]
  saveCurrentPreset: (name: string) => void
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
  runSql: (sql: string) => Promise<QueryRow[]>
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

let applyingHash = false

function writeHash(view: AppView, filters: ProductionFilters): void {
  const next = viewHash(view, filters)
  if (window.location.hash === next || applyingHash) {
    return
  }
  const current = parseHash()
  applyingHash = true
  if (current.view !== view) {
    window.history.pushState(null, "", next)
  } else {
    window.history.replaceState(null, "", next)
  }
  queueMicrotask(() => {
    applyingHash = false
  })
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
  const [presets, setPresets] = useState<FilterPreset[]>(() =>
    typeof window === "undefined" ? [] : loadPresets()
  )
  const [restoreFailed, setRestoreFailed] = useState<TableName[]>([])
  const [shareFolderHandle, setShareFolderHandle] =
    useState<ShareDirectoryHandle | null>(null)
  const [shareFolderName, setShareFolderName] = useState<string | null>(null)
  const [shareFolderPermitted, setShareFolderPermitted] = useState(false)
  const [shareDbNames, setShareDbNames] = useState<string[]>([])
  const [activeShareDbName, setActiveShareDbName] = useState<string | null>(null)

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
      .then(async (result) => {
        if (cancelled) {
          return
        }
        setReady(true)
        if (result.restoreFailed.length > 0) {
          setRestoreFailed(result.restoreFailed)
        }
        await refreshMeta()
        const cycles = await tableCount("cycles")
        const raw = window.location.hash.replace(/^#/, "")
        const [path, query = ""] = raw.split("?")
        if (
          cycles > 0 &&
          (path === "" || path === "ingest") &&
          !query.includes("f=")
        ) {
          setViewState("dashboard")
        }
        try {
          const snapshot = await readShareFolderSnapshot()
          if (cancelled) {
            return
          }
          setShareFolderHandle(snapshot.handle)
          setShareFolderName(snapshot.folderName)
          setShareFolderPermitted(snapshot.permitted)
          setShareDbNames(snapshot.names)
          setActiveShareDbName(snapshot.lastName)
        } catch {
          // A remembered folder is optional.
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "DuckDB konnte nicht starten")
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
    const apply = () => {
      if (applyingHash) {
        return
      }
      applyingHash = true
      const parsed = parseHash()
      setViewState(parsed.view)
      setFiltersState(parsed.filters)
      queueMicrotask(() => {
        applyingHash = false
      })
    }
    window.addEventListener("hashchange", apply)
    window.addEventListener("popstate", apply)
    return () => {
      window.removeEventListener("hashchange", apply)
      window.removeEventListener("popstate", apply)
    }
  }, [])

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
      .catch((err: unknown) => {
        if (!cancelled) {
          setReports([])
          toast.error(
            err instanceof Error ? err.message : "Berichte konnten nicht gebaut werden"
          )
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

  const dismissRestoreFailed = useCallback(() => {
    setRestoreFailed([])
  }, [])

  const forgetActiveStand = useCallback(async () => {
    setActiveShareDbName(null)
    try {
      await saveLastShareDbName(null)
    } catch {
      // Local cache is optional.
    }
  }, [])

  const rememberActiveStand = useCallback(async (name: string) => {
    setActiveShareDbName(name)
    try {
      await saveLastShareDbName(name)
    } catch {
      // Local cache is optional.
    }
  }, [])

  const applyShareSnapshot = useCallback(
    (snapshot: {
      handle: ShareDirectoryHandle | null
      folderName: string | null
      permitted: boolean
      names: string[]
    }) => {
      setShareFolderHandle(snapshot.handle)
      setShareFolderName(snapshot.folderName)
      setShareFolderPermitted(snapshot.permitted)
      setShareDbNames(snapshot.names)
    },
    []
  )

  const applyFloorlineDbBytes = useCallback(
    async (bytes: Uint8Array, label: string) => {
      await loadFloorlineDbBytes(bytes)
      await rememberActiveStand(label)
      await refreshMeta()
      setRestoreFailed([])
      toast.success(`Stand geladen: ${label}`)
      setViewState("dashboard")
    },
    [refreshMeta, rememberActiveStand]
  )

  const ingestFiles = useCallback(
    async (fileList: File[]) => {
      setLoading(true)
      setError(null)
      try {
        const accepted = pickIngestFiles(fileList)
        if (accepted.length === 0) {
          throw new Error(
            "Keine .xml-, .csv-, .parquet- oder .floorline-Dateien in diesem Wurf"
          )
        }
        const packs = accepted.filter(
          (file) => classifyIngestName(file.name) === "floorline-db"
        )
        if (packs[0]) {
          const bytes = new Uint8Array(await packs[0].arrayBuffer())
          await applyFloorlineDbBytes(bytes, packs[0].name)
          if (accepted.length > 1) {
            toast.info(
              "Nur die Stand-Datei wurde geladen. Andere Dateien in diesem Wurf wurden ignoriert."
            )
          }
          return
        }
        const xmlFiles = accepted.filter(
          (file) => classifyIngestName(file.name) === "xml"
        )
        const tabular = accepted.filter((file) => {
          const kind = classifyIngestName(file.name)
          return kind === "csv" || kind === "parquet"
        })
        if (xmlFiles.length > 0) {
          const batches = await Promise.all(
            xmlFiles.map(async (file) => {
              const xml = await file.text()
              return parseProductionXml({
                fileName: file.name,
                xml,
                byteSize: file.size,
              })
            })
          )
          await ingestBatches(batches)
        }
        const tables: string[] = []
        for (const file of tabular) {
          tables.push(await ingestTabularFile(file))
        }
        await forgetActiveStand()
        await refreshMeta()
        const parts = [
          xmlFiles.length > 0 ? `${xmlFiles.length} XML` : null,
          tables.length > 0 ? `${tables.length} ${tables.join(", ")}` : null,
        ].filter((part) => part !== null)
        setRestoreFailed([])
        toast.success(`Geladen: ${parts.join(" + ")}`)
        setViewState("dashboard")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import fehlgeschlagen"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [applyFloorlineDbBytes, forgetActiveStand, refreshMeta]
  )

  const ingestDemo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await resetEngine()
      await ingestBatches(parseShareSamples())
      await forgetActiveStand()
      await refreshMeta()
      setRestoreFailed([])
      toast.success("Demo-Produktionsfreigabe geladen (3 XML-Dateien)")
      setViewState("dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Demo-Laden fehlgeschlagen"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [forgetActiveStand, refreshMeta])

  const clearData = useCallback(async () => {
    setLoading(true)
    try {
      await resetEngine()
      setFiles([])
      setFacets(EMPTY_FACETS)
      setReports([])
      setRowCounts(EMPTY_COUNTS)
      setRestoreFailed([])
      await forgetActiveStand()
      toast.success("Geladene Daten gelöscht")
    } finally {
      setLoading(false)
    }
  }, [forgetActiveStand])

  const refreshShareDbs = useCallback(async () => {
    if (!shareFolderHandle || !shareFolderPermitted) {
      return
    }
    setShareDbNames(await listShareDbNames(shareFolderHandle))
  }, [shareFolderHandle, shareFolderPermitted])

  const pickShareFolder = useCallback(async () => {
    try {
      const handle = await pickShareDirectory()
      applyShareSnapshot({
        handle,
        folderName: handle.name,
        permitted: true,
        names: await listShareDbNames(handle),
      })
      toast.success(`Freigabeordner: ${handle.name}`)
    } catch (err) {
      if (isAbortError(err)) {
        return
      }
      const message =
        err instanceof Error ? err.message : "Freigabeordner konnte nicht öffnen"
      toast.error(message)
    }
  }, [applyShareSnapshot])

  const grantShareFolder = useCallback(async () => {
    if (!shareFolderHandle) {
      await pickShareFolder()
      return
    }
    try {
      const state = await requestDirectoryPermission(shareFolderHandle, "readwrite")
      if (state !== "granted") {
        throw new Error("Kein Zugriff auf den Freigabeordner.")
      }
      applyShareSnapshot({
        handle: shareFolderHandle,
        folderName: shareFolderHandle.name,
        permitted: true,
        names: await listShareDbNames(shareFolderHandle),
      })
    } catch (err) {
      if (isAbortError(err)) {
        return
      }
      const message =
        err instanceof Error ? err.message : "Zugriff auf den Freigabeordner fehlgeschlagen"
      toast.error(message)
    }
  }, [applyShareSnapshot, pickShareFolder, shareFolderHandle])

  const saveShareDb = useCallback(
    async (name: string) => {
      if (!shareFolderHandle || !shareFolderPermitted) {
        throw new Error("Zuerst einen Freigabeordner wählen.")
      }
      setLoading(true)
      setError(null)
      try {
        const fileName = sanitizeDbFileName(name)
        const bytes = await exportFloorlineDbBytes(fileName)
        const saved = await writeShareDbFile(shareFolderHandle, fileName, bytes)
        await rememberActiveStand(saved)
        setShareDbNames(await listShareDbNames(shareFolderHandle))
        toast.success(`Stand gespeichert: ${saved}`)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stand konnte nicht speichern"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [rememberActiveStand, shareFolderHandle, shareFolderPermitted]
  )

  const loadShareDb = useCallback(
    async (fileName: string) => {
      if (!shareFolderHandle || !shareFolderPermitted) {
        throw new Error("Zuerst einen Freigabeordner wählen.")
      }
      setLoading(true)
      setError(null)
      try {
        const bytes = await readShareDbFile(shareFolderHandle, fileName)
        await applyFloorlineDbBytes(bytes, fileName)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stand konnte nicht laden"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [applyFloorlineDbBytes, shareFolderHandle, shareFolderPermitted]
  )

  const downloadShareDb = useCallback(
    async (name: string) => {
      setLoading(true)
      setError(null)
      try {
        const fileName = sanitizeDbFileName(name)
        const bytes = await exportFloorlineDbBytes(fileName)
        downloadBytes({
          bytes,
          fileName,
          mime: "application/octet-stream",
        })
        await rememberActiveStand(fileName)
        toast.success(`Stand-Datei: ${fileName}`)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stand konnte nicht erzeugen"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [rememberActiveStand]
  )

  const loadShareDbFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        await applyFloorlineDbBytes(bytes, file.name)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stand konnte nicht laden"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [applyFloorlineDbBytes]
  )

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
      toast.success(`Exportiert ${args.table}.${args.format}`)
    },
    [filters]
  )

  const shareUrl = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}${viewHash(view, filters)}`
    return url
  }, [filters, view])

  const saveCurrentPreset = useCallback(
    (name: string) => {
      const next = upsertPreset(presets, name, filters)
      setPresets(next)
      savePresets(next)
      toast.success(`Vorlage gespeichert: ${name.trim()}`)
    },
    [filters, presets]
  )

  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find((item) => item.id === id)
      if (!preset) {
        return
      }
      setFiltersState(preset.filters)
      toast.success(`Angewendet: ${preset.name}`)
    },
    [presets]
  )

  const deletePreset = useCallback(
    (id: string) => {
      const next = removePreset(presets, id)
      setPresets(next)
      savePresets(next)
    },
    [presets]
  )

  const runSql = useCallback(async (sql: string) => {
    return queryRows(assertReadOnlySelect(sql))
  }, [])

  const suggestedShareDbName = useMemo(
    () =>
      suggestedDbFileName({
        plants: [...new Set(files.map((file) => file.plant).filter((plant) => plant !== ""))],
        shiftDate: files.find((file) => file.shift_date)?.shift_date ?? null,
      }),
    [files]
  )

  const value = useMemo<FloorlineState>(
    () => ({
      ready,
      loading,
      error,
      restoreFailed,
      dismissRestoreFailed,
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
      canUseShareFolder: canPickShareDirectory(),
      shareFolderName,
      shareFolderPermitted,
      shareDbNames,
      activeShareDbName,
      suggestedShareDbName,
      pickShareFolder,
      grantShareFolder,
      refreshShareDbs,
      saveShareDb,
      loadShareDb,
      downloadShareDb,
      loadShareDbFile,
      exportTable,
      shareUrl,
      presets,
      saveCurrentPreset,
      applyPreset,
      deletePreset,
      runSql,
    }),
    [
      ready,
      loading,
      error,
      restoreFailed,
      dismissRestoreFailed,
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
      shareFolderName,
      shareFolderPermitted,
      shareDbNames,
      activeShareDbName,
      suggestedShareDbName,
      pickShareFolder,
      grantShareFolder,
      refreshShareDbs,
      saveShareDb,
      loadShareDb,
      downloadShareDb,
      loadShareDbFile,
      exportTable,
      shareUrl,
      presets,
      saveCurrentPreset,
      applyPreset,
      deletePreset,
      runSql,
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
