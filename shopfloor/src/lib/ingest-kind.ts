import { isFloorlineDbName } from "@/lib/duckdb/share-db"
import { TABLE_NAMES, type TableName } from "@/lib/types"

export const INGEST_KINDS = ["xml", "csv", "parquet", "floorline-db"] as const
export type IngestKind = (typeof INGEST_KINDS)[number]

export const TABLE_PRIMARY_KEY: Record<TableName, string> = {
  ingest_files: "file_id",
  cycles: "cycle_id",
  downtime: "event_id",
  alarms: "alarm_id",
  server_samples: "sample_id",
  controllers: "controller_id",
}

const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  ingest_files: [
    "file_id",
    "file_name",
    "source_share",
    "plant",
    "shift",
    "cycle_count",
  ],
  cycles: [
    "cycle_id",
    "plant",
    "line",
    "station",
    "result",
    "cycle_ms",
    "good_qty",
  ],
  downtime: ["event_id", "duration_ms", "reason_code", "category"],
  alarms: ["alarm_id", "severity", "code", "raised_at"],
  server_samples: ["sample_id", "server_id", "cpu_pct", "plc_scan_ms"],
  controllers: ["controller_id", "vendor", "firmware", "run_mode"],
}

export function classifyIngestName(fileName: string): IngestKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".xml")) {
    return "xml"
  }
  if (lower.endsWith(".csv")) {
    return "csv"
  }
  if (lower.endsWith(".parquet") || lower.endsWith(".pq")) {
    return "parquet"
  }
  if (isFloorlineDbName(fileName)) {
    return "floorline-db"
  }
  return null
}

export function guessTable(columnNames: string[]): TableName | null {
  const set = new Set(columnNames.map((name) => name.toLowerCase()))
  let best: { table: TableName; score: number } | null = null
  for (const table of TABLE_NAMES) {
    if (!set.has(TABLE_PRIMARY_KEY[table])) {
      continue
    }
    let score = 0
    for (const col of TABLE_COLUMNS[table]) {
      if (set.has(col)) {
        score += 1
      }
    }
    if (!best || score > best.score) {
      best = { table, score }
    }
  }
  if (!best || best.score < 3) {
    return null
  }
  return best.table
}

export function pickIngestFiles(files: File[]): File[] {
  return files.filter((file) => classifyIngestName(file.name) !== null)
}
