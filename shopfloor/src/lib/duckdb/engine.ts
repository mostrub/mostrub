import * as duckdb from "@duckdb/duckdb-wasm"
import duckdbEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"
import duckdbMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"

import { INSERT_SQL, SCHEMA_SQL } from "@/lib/duckdb/schema"
import type { ProductionBatch, TableName } from "@/lib/types"

export type QueryRow = Record<string, string | number | boolean | null>

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null

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

export async function initEngine(): Promise<void> {
  if (conn) {
    return
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
  const files = batches.map((batch) => batch.file)
  const cycles = batches.flatMap((batch) => batch.cycles)
  const downtime = batches.flatMap((batch) => batch.downtime)
  const alarms = batches.flatMap((batch) => batch.alarms)
  const serverSamples = batches.flatMap((batch) => batch.server_samples)
  const controllers = batches.flatMap((batch) => batch.controllers)

  await registerJson("ingest_files", files)
  await registerJson("cycles", cycles)
  await registerJson("downtime", downtime)
  await registerJson("alarms", alarms)
  await registerJson("server_samples", serverSamples)
  await registerJson("controllers", controllers)

  if (files.length > 0) await connection.query(INSERT_SQL.ingest_files)
  if (cycles.length > 0) await connection.query(INSERT_SQL.cycles)
  if (downtime.length > 0) await connection.query(INSERT_SQL.downtime)
  if (alarms.length > 0) await connection.query(INSERT_SQL.alarms)
  if (serverSamples.length > 0) await connection.query(INSERT_SQL.server_samples)
  if (controllers.length > 0) await connection.query(INSERT_SQL.controllers)
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
}

export async function exportCopy(args: {
  sql: string
  format: "csv" | "parquet"
}): Promise<Uint8Array> {
  const { db: instance, conn: connection } = requireConn()
  const path = args.format === "parquet" ? "export.parquet" : "export.csv"
  const copy =
    args.format === "parquet"
      ? `COPY (${args.sql}) TO '${path}' (FORMAT PARQUET)`
      : `COPY (${args.sql}) TO '${path}' (HEADER, DELIMITER ',')`
  await connection.query(copy)
  return instance.copyFileToBuffer(path)
}

export async function tableCount(table: TableName): Promise<number> {
  return queryValue(`SELECT COUNT(*) AS n FROM ${table}`)
}

export function isEngineReady(): boolean {
  return conn !== null
}
