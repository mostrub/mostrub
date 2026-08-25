import type { TableName } from "@/lib/types"
import { TABLE_NAMES } from "@/lib/types"

const DB_NAME = "floorline"
const STORE = "parquet"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"))
  })
}

export async function persistParquet(
  table: TableName,
  bytes: Uint8Array
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("persist failed"))
    tx.objectStore(STORE).put(bytes, table)
  })
  db.close()
}

export async function loadParquet(
  table: TableName
): Promise<Uint8Array | null> {
  const db = await openDb()
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(table)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("load failed"))
  })
  db.close()
  if (value instanceof Uint8Array) {
    return value
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  return null
}

export async function clearPersisted(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("clear failed"))
    tx.objectStore(STORE).clear()
  })
  db.close()
}

export async function loadAllParquet(): Promise<
  Partial<Record<TableName, Uint8Array>>
> {
  const out: Partial<Record<TableName, Uint8Array>> = {}
  for (const table of TABLE_NAMES) {
    const bytes = await loadParquet(table)
    if (bytes && bytes.byteLength > 0) {
      out[table] = bytes
    }
  }
  return out
}
