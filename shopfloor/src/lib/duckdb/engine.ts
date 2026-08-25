import * as duckdb from "@duckdb/duckdb-wasm"
import duckdbEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"
import duckdbMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"

import {
  INSERT_SQL,
  SCHEMA_SQL,
  deleteByFileIdsSql,
  insertParquetByName,
  persistExportPath,
} from "@/lib/duckdb/schema"
import {
  clearPersisted,
  deleteParquet,
  loadAllParquet,
  persistParquet,
} from "@/lib/duckdb/persist"
import { TABLE_PRIMARY_KEY, guessTable } from "@/lib/ingest-kind"
import { TABLE_NAMES, type ProductionBatch, type TableName } from "@/lib/types"

export type EngineInitResult = {
  restoreFailed: TableName[]
}

export type QueryRow = Record<string, string | number | boolean | null>

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null
let initPromise: Promise<EngineInitResult> | null = null
let lastRestoreFailed: TableName[] = []

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbMvp,
    mainWorker: mvpWorker,
  },
  eh: {
    mainModule: duckdbEh,
    mainWorker: ehWorker,
  },
}

export async function initEngine(): Promise<EngineInitResult> {
  if (!initPromise) {
    initPromise = startEngine()
  }
  try {
    return await initPromise
  } catch (err) {
    initPromise = null
    throw err
  }
}

async function startEngine(): Promise<EngineInitResult> {
  if (conn) {
    return { restoreFailed: lastRestoreFailed }
  }
  const bundle = await duckdb.selectBundle(BUNDLES)
  const workerUrl = bundle.mainWorker
  if (!workerUrl) {
    throw new Error("DuckDB worker bundle is missing")
  }
  const worker = new Worker(workerUrl)
  const instance = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker)
  await instance.instantiate(bundle.mainModule, bundle.pthreadWorker)
  const connection = await instance.connect()
  await connection.query(SCHEMA_SQL)
  db = instance
  conn = connection
  try {
    lastRestoreFailed = await restorePersisted()
  } catch {
    lastRestoreFailed = [...TABLE_NAMES]
  }
  return { restoreFailed: lastRestoreFailed }
}

function requireConn(): {
  db: duckdb.AsyncDuckDB
  conn: duckdb.AsyncDuckDBConnection
} {
  if (!db || !conn) {
    throw new Error("DuckDB is not ready")
  }
  return { db, conn }
}

function cellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value)
}

export async function queryRows(sql: string): Promise<QueryRow[]> {
  const { conn: connection } = requireConn()
  const result = await connection.query(sql)
  const fields = result.schema.fields.map((field) => field.name)
  return result.toArray().map((row) => {
    const out: QueryRow = {}
    for (const field of fields) {
      out[field] = cellValue(row[field])
    }
    return out
  })
}

export async function queryValue(sql: string): Promise<number> {
  const rows = await queryRows(sql)
  const first = rows[0]
  if (!first) {
    return 0
  }
  const value = Object.values(first)[0]
  return typeof value === "number" ? value : Number(value ?? 0)
}

async function registerJson(
  name: string,
  rows: unknown[]
): Promise<void> {
  const { db: instance } = requireConn()
  await instance.registerFileText(`${name}.json`, JSON.stringify(rows))
}

export async function ingestBatches(batches: ProductionBatch[]): Promise<void> {
  const { conn: connection } = requireConn()
  const unique = new Map<string, ProductionBatch>()
  for (const batch of batches) {
    unique.set(batch.file.file_id, batch)
  }
  const deduped = [...unique.values()]
  const files = deduped.map((batch) => batch.file)
  const cycles = deduped.flatMap((batch) => batch.cycles)
  const downtime = deduped.flatMap((batch) => batch.downtime)
  const alarms = deduped.flatMap((batch) => batch.alarms)
  const serverSamples = deduped.flatMap((batch) => batch.server_samples)
  const controllers = deduped.flatMap((batch) => batch.controllers)

  await registerJson("ingest_files", files)
  await registerJson("cycles", cycles)
  await registerJson("downtime", downtime)
  await registerJson("alarms", alarms)
  await registerJson("server_samples", serverSamples)
  await registerJson("controllers", controllers)

  await connection.query("BEGIN TRANSACTION")
  try {
    const fileIds = files.map((file) => file.file_id).filter((id) => id !== "")
    for (const table of TABLE_NAMES) {
      const sql = deleteByFileIdsSql(table, fileIds)
      if (sql) {
        await connection.query(sql)
      }
    }
    if (files.length > 0) await connection.query(INSERT_SQL.ingest_files)
    if (cycles.length > 0) await connection.query(INSERT_SQL.cycles)
    if (downtime.length > 0) await connection.query(INSERT_SQL.downtime)
    if (alarms.length > 0) await connection.query(INSERT_SQL.alarms)
    if (serverSamples.length > 0) await connection.query(INSERT_SQL.server_samples)
    if (controllers.length > 0) await connection.query(INSERT_SQL.controllers)
    await connection.query("COMMIT")
  } catch (err) {
    await connection.query("ROLLBACK")
    throw err
  }
  await persistAllTables()
}

export async function ingestTabularFile(file: File): Promise<TableName> {
  const { db: instance, conn: connection } = requireConn()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const path = `upload-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`
  await instance.registerFileBuffer(path, bytes)
  const lower = file.name.toLowerCase()
  const reader = lower.endsWith(".parquet") || lower.endsWith(".pq")
    ? `read_parquet('${path}')`
    : `read_csv_auto('${path}', HEADER=true)`
  const described = await queryRows(`DESCRIBE SELECT * FROM ${reader}`)
  const columns = described.map((row) => String(row.column_name ?? ""))
  const table = guessTable(columns)
  if (!table) {
    throw new Error(
      `${file.name} does not match a Floorline table. Export CSV/Parquet from this app, or use ShopfloorExport XML.`
    )
  }
  const pk = TABLE_PRIMARY_KEY[table]
  const hasFileId = columns.includes("file_id")
  const hasPk = columns.includes(pk)
  await connection.query("BEGIN TRANSACTION")
  try {
    if (hasFileId) {
      await connection.query(
        `DELETE FROM ${table} WHERE file_id IN (SELECT DISTINCT file_id FROM ${reader})`
      )
    } else if (hasPk) {
      await connection.query(
        `DELETE FROM ${table} WHERE ${pk} IN (SELECT DISTINCT ${pk} FROM ${reader})`
      )
    }
    await connection.query(`INSERT INTO ${table} BY NAME SELECT * FROM ${reader}`)
    await connection.query("COMMIT")
  } catch (err) {
    await connection.query("ROLLBACK")
    throw err
  }
  await persistAllTables()
  return table
}

async function restorePersisted(): Promise<TableName[]> {
  const { db: instance, conn: connection } = requireConn()
  let stored: Partial<Record<TableName, Uint8Array>>
  try {
    stored = await loadAllParquet()
  } catch {
    return [...TABLE_NAMES]
  }
  const failed: TableName[] = []
  for (const table of TABLE_NAMES) {
    const bytes = stored[table]
    if (!bytes) {
      continue
    }
    const path = `restore-${table}.parquet`
    try {
      await instance.registerFileBuffer(path, bytes)
      await connection.query(insertParquetByName(table, path))
    } catch {
      failed.push(table)
      try {
        await deleteParquet(table)
      } catch {
        // Cache cleanup must not take down a fresh session.
      }
    }
    try {
      await instance.dropFile(path)
    } catch {
      // Restore files are ephemeral.
    }
  }
  const factFailed = failed.some((table) => table !== "ingest_files")
  if (factFailed) {
    await connection.query("DELETE FROM ingest_files")
    try {
      await deleteParquet("ingest_files")
    } catch {
      // Ignore cache cleanup.
    }
    if (!failed.includes("ingest_files")) {
      failed.push("ingest_files")
    }
  }
  return failed
}

export async function persistAllTables(): Promise<void> {
  for (const table of TABLE_NAMES) {
    const count = await tableCount(table)
    if (count === 0) {
      await deleteParquet(table)
      continue
    }
    const bytes = await exportCopy({
      sql: `SELECT * FROM ${table}`,
      format: "parquet",
      path: persistExportPath(table),
    })
    await persistParquet(table, bytes)
  }
}

export async function resetEngine(): Promise<void> {
  const { conn: connection } = requireConn()
  await connection.query(`
    DELETE FROM cycles;
    DELETE FROM downtime;
    DELETE FROM alarms;
    DELETE FROM server_samples;
    DELETE FROM controllers;
    DELETE FROM ingest_files;
  `)
  await clearPersisted()
}

export async function exportCopy(args: {
  sql: string
  format: "csv" | "parquet"
  path?: string
}): Promise<Uint8Array> {
  const { db: instance, conn: connection } = requireConn()
  const path =
    args.path ??
    (args.format === "parquet" ? "export.parquet" : "export.csv")
  const copy =
    args.format === "parquet"
      ? `COPY (${args.sql}) TO '${path}' (FORMAT PARQUET)`
      : `COPY (${args.sql}) TO '${path}' (HEADER, DELIMITER ',')`
  await connection.query(copy)
  const bytes = await instance.copyFileToBuffer(path)
  await instance.dropFile(path)
  return bytes
}

export async function tableCount(table: TableName): Promise<number> {
  return queryValue(`SELECT COUNT(*) AS n FROM ${table}`)
}

export function isEngineReady(): boolean {
  return conn !== null
}
