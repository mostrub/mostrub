import { TABLE_NAMES, isTableName, type TableName } from "@/lib/types"

export const FLOORLINE_DB_EXT = ".floorline"
export const FLOORLINE_DB_VERSION = 1
export const FLOORLINE_DB_MAGIC = "FLDB"
export const FLOORLINE_DB_MANIFEST = "floorline-db"

export type FloorlineDbTables = Partial<Record<TableName, Uint8Array>>

export type FloorlineDbManifest = {
  magic: typeof FLOORLINE_DB_MANIFEST
  version: number
  savedAt: string
  name: string
  tables: Array<{ name: TableName; bytes: number }>
}

export type FloorlineDbPack = {
  manifest: FloorlineDbManifest
  tables: FloorlineDbTables
}

const HEADER_BYTES = 12

export function isFloorlineDbName(name: string): boolean {
  return /\.(floorline|ddb)$/i.test(name)
}

export function sanitizeDbFileName(raw: string): string {
  const trimmed = raw.trim() || "floorline-stand"
  const withoutExt = trimmed.replace(/\.(floorline|ddb)$/i, "")
  const cleaned = withoutExt
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${cleaned || "floorline-stand"}${FLOORLINE_DB_EXT}`
}

export function suggestedDbFileName(input: {
  plants?: readonly string[]
  shiftDate?: string | null
}): string {
  const plant =
    (input.plants ?? []).map((value) => value.trim()).find((value) => value !== "") ??
    ""
  const date = (input.shiftDate ?? "").trim()
  if (plant && date) {
    return sanitizeDbFileName(`floorline-${plant}-${date}`)
  }
  if (plant) {
    return sanitizeDbFileName(`floorline-${plant}`)
  }
  if (date) {
    return sanitizeDbFileName(`floorline-${date}`)
  }
  return sanitizeDbFileName("floorline-stand")
}

export function listFloorlineDbNames(names: string[]): string[] {
  return names.filter(isFloorlineDbName).sort((a, b) => a.localeCompare(b))
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function writeUint32Le(target: Uint8Array, offset: number, value: number): void {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength)
  view.setUint32(offset, value, true)
}

function readUint32Le(source: Uint8Array, offset: number): number {
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  return view.getUint32(offset, true)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function packFloorlineDb(input: {
  name: string
  tables: FloorlineDbTables
  savedAt?: string
}): Uint8Array {
  const savedAt = input.savedAt ?? new Date().toISOString()
  const tables: Array<{ name: TableName; bytes: Uint8Array }> = []
  for (const name of TABLE_NAMES) {
    const bytes = input.tables[name]
    if (!bytes || bytes.byteLength === 0) {
      continue
    }
    tables.push({ name, bytes })
  }
  const manifest: FloorlineDbManifest = {
    magic: FLOORLINE_DB_MANIFEST,
    version: FLOORLINE_DB_VERSION,
    savedAt,
    name: input.name,
    tables: tables.map((table) => ({ name: table.name, bytes: table.bytes.byteLength })),
  }
  const json = encodeUtf8(JSON.stringify(manifest))
  const payload = tables.reduce((sum, table) => sum + table.bytes.byteLength, 0)
  const out = new Uint8Array(HEADER_BYTES + json.byteLength + payload)
  out.set(encodeUtf8(FLOORLINE_DB_MAGIC), 0)
  writeUint32Le(out, 4, FLOORLINE_DB_VERSION)
  writeUint32Le(out, 8, json.byteLength)
  out.set(json, HEADER_BYTES)
  let offset = HEADER_BYTES + json.byteLength
  for (const table of tables) {
    out.set(table.bytes, offset)
    offset += table.bytes.byteLength
  }
  return out
}

export function unpackFloorlineDb(bytes: Uint8Array): FloorlineDbPack {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error("Floorline-Stand ist beschädigt (zu kurz).")
  }
  const magic = decodeUtf8(bytes.subarray(0, 4))
  if (magic !== FLOORLINE_DB_MAGIC) {
    throw new Error("Keine gültige Floorline-Stand-Datei.")
  }
  const version = readUint32Le(bytes, 4)
  if (version !== FLOORLINE_DB_VERSION) {
    throw new Error(`Floorline-Stand-Version ${version} wird nicht unterstützt.`)
  }
  const jsonLen = readUint32Le(bytes, 8)
  if (jsonLen < 2 || HEADER_BYTES + jsonLen > bytes.byteLength) {
    throw new Error("Floorline-Stand ist beschädigt (Manifest).")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(decodeUtf8(bytes.subarray(HEADER_BYTES, HEADER_BYTES + jsonLen)))
  } catch {
    throw new Error("Floorline-Stand ist beschädigt (Manifest).")
  }
  const manifest = readManifest(parsed)
  let offset = HEADER_BYTES + jsonLen
  const tables: FloorlineDbTables = {}
  for (const entry of manifest.tables) {
    const end = offset + entry.bytes
    if (end > bytes.byteLength) {
      throw new Error("Floorline-Stand ist beschädigt (Tabelle).")
    }
    tables[entry.name] = bytes.subarray(offset, end)
    offset = end
  }
  return { manifest, tables }
}

function readManifest(value: unknown): FloorlineDbManifest {
  if (!isRecord(value) || value.magic !== FLOORLINE_DB_MANIFEST) {
    throw new Error("Keine gültige Floorline-Stand-Datei.")
  }
  if (
    typeof value.version !== "number" ||
    typeof value.savedAt !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.tables)
  ) {
    throw new Error("Keine gültige Floorline-Stand-Datei.")
  }
  const tables: FloorlineDbManifest["tables"] = []
  for (const entry of value.tables) {
    if (!isRecord(entry) || typeof entry.name !== "string" || typeof entry.bytes !== "number") {
      throw new Error("Keine gültige Floorline-Stand-Datei.")
    }
    if (!isTableName(entry.name)) {
      throw new Error(`Unbekannte Tabelle im Floorline-Stand: ${entry.name}`)
    }
    tables.push({ name: entry.name, bytes: entry.bytes })
  }
  return {
    magic: FLOORLINE_DB_MANIFEST,
    version: value.version,
    savedAt: value.savedAt,
    name: value.name,
    tables,
  }
}
