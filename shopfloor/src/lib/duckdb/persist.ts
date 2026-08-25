import type { TableName } from "@/lib/types"
import { TABLE_NAMES } from "@/lib/types"

const DB_NAME = "floorline"
const STORE = "parquet"
const VERSION_KEY = "__schema_version"
const IDB_VERSION = 2

export const PERSIST_SCHEMA_VERSION = 2

export function persistSchemaStale(storedVersion: unknown): boolean {
  return storedVersion !== PERSIST_SCHEMA_VERSION
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
      const tx = req.transaction
      tx?.objectStore(STORE).clear()
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      let result: T
      req.onsuccess = () => {
        result = req.result
      }
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"))
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"))
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"))
    })
  } finally {
    db.close()
  }
}

async function readStoredVersion(): Promise<unknown> {
  return withStore("readonly", (store) => store.get(VERSION_KEY))
}

export async function ensurePersistSchema(): Promise<void> {
  const stored = await readStoredVersion()
  if (!persistSchemaStale(stored)) {
    return
  }
  await clearPersisted()
}

export async function persistParquet(
  table: TableName,
  bytes: Uint8Array
): Promise<void> {
  await ensurePersistSchema()
  await withStore("readwrite", (store) => store.put(bytes, table))
}

export async function deleteParquet(table: TableName): Promise<void> {
  await ensurePersistSchema()
  await withStore("readwrite", (store) => store.delete(table))
}

export async function loadParquet(
  table: TableName
): Promise<Uint8Array | null> {
  await ensurePersistSchema()
  const value = await withStore("readonly", (store) => store.get(table))
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
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      const store = tx.objectStore(STORE)
      store.clear()
      store.put(PERSIST_SCHEMA_VERSION, VERSION_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("clear failed"))
    })
  } finally {
    db.close()
  }
}

export async function loadAllParquet(): Promise<
  Partial<Record<TableName, Uint8Array>>
> {
  await ensurePersistSchema()
  const out: Partial<Record<TableName, Uint8Array>> = {}
  for (const table of TABLE_NAMES) {
    const bytes = await loadParquet(table)
    if (bytes && bytes.byteLength > 0) {
      out[table] = bytes
    }
  }
  return out
}
