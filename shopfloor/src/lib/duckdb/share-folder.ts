import {
  isFloorlineDbName,
  listFloorlineDbNames,
  sanitizeDbFileName,
} from "@/lib/duckdb/share-db"

const SHARE_DB_NAME = "floorline-share"
const SHARE_STORE = "kv"
const SHARE_DB_VERSION = 1
const KEY_DIRECTORY = "directory"
const KEY_LAST_NAME = "lastName"

export type ShareWritable = {
  write: (data: Uint8Array) => Promise<void>
  close: () => Promise<void>
}

export type ShareFileHandle = {
  getFile: () => Promise<File>
  createWritable: () => Promise<ShareWritable>
}

export type ShareDirectoryHandle = {
  name: string
  entries: () => AsyncIterableIterator<[string, { kind: string; name: string }]>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<ShareFileHandle>
  queryPermission?: (descriptor: {
    mode: "read" | "readwrite"
  }) => Promise<PermissionState>
  requestPermission?: (descriptor: {
    mode: "read" | "readwrite"
  }) => Promise<PermissionState>
}

type DirectoryPicker = (options?: {
  id?: string
  mode?: "read" | "readwrite"
}) => Promise<ShareDirectoryHandle>

function directoryPicker(): DirectoryPicker | undefined {
  if (typeof window === "undefined") {
    return undefined
  }
  const candidate = Reflect.get(window, "showDirectoryPicker")
  return typeof candidate === "function" ? (candidate as DirectoryPicker) : undefined
}

export function canPickShareDirectory(): boolean {
  return directoryPicker() !== undefined
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(req.error ?? new Error("Freigabeordner-Cache konnte nicht öffnen"))
  })
}

async function withShareStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openShareDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE, mode)
      const req = run(tx.objectStore(SHARE_STORE))
      let result: T
      req.onsuccess = () => {
        result = req.result
      }
      req.onerror = () =>
        reject(req.error ?? new Error("Freigabeordner-Cache fehlgeschlagen"))
      tx.oncomplete = () => resolve(result)
      tx.onerror = () =>
        reject(tx.error ?? new Error("Freigabeordner-Transaktion fehlgeschlagen"))
      tx.onabort = () =>
        reject(tx.error ?? new Error("Freigabeordner-Transaktion abgebrochen"))
    })
  } finally {
    db.close()
  }
}

function isShareDirectoryHandle(value: unknown): value is ShareDirectoryHandle {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const getFileHandle = Reflect.get(value, "getFileHandle")
  const entries = Reflect.get(value, "entries")
  return typeof getFileHandle === "function" && typeof entries === "function"
}

export async function saveShareDirectoryHandle(
  handle: ShareDirectoryHandle
): Promise<void> {
  await withShareStore("readwrite", (store) => store.put(handle, KEY_DIRECTORY))
}

export async function loadShareDirectoryHandle(): Promise<ShareDirectoryHandle | null> {
  const value = await withShareStore("readonly", (store) => store.get(KEY_DIRECTORY))
  return isShareDirectoryHandle(value) ? value : null
}

export async function saveLastShareDbName(name: string | null): Promise<void> {
  await withShareStore("readwrite", (store) => store.put(name, KEY_LAST_NAME))
}

export async function loadLastShareDbName(): Promise<string | null> {
  const value = await withShareStore("readonly", (store) => store.get(KEY_LAST_NAME))
  return typeof value === "string" && value !== "" ? value : null
}

export async function queryDirectoryPermission(
  handle: ShareDirectoryHandle,
  mode: "read" | "readwrite"
): Promise<PermissionState> {
  if (!handle.queryPermission) {
    return "granted"
  }
  return handle.queryPermission({ mode })
}

export async function requestDirectoryPermission(
  handle: ShareDirectoryHandle,
  mode: "read" | "readwrite"
): Promise<PermissionState> {
  if (!handle.requestPermission) {
    return "granted"
  }
  return handle.requestPermission({ mode })
}

export async function pickShareDirectory(): Promise<ShareDirectoryHandle> {
  const picker = directoryPicker()
  if (!picker) {
    throw new Error(
      "Dieser Browser kann keinen Freigabeordner merken. Edge oder Chrome unter Windows nutzen, oder die Stand-Datei herunterladen."
    )
  }
  const handle = await picker({ id: "floorline-db", mode: "readwrite" })
  const permitted = await requestDirectoryPermission(handle, "readwrite")
  if (permitted !== "granted") {
    throw new Error("Kein Zugriff auf den Freigabeordner.")
  }
  await saveShareDirectoryHandle(handle)
  return handle
}

export async function listShareDbNames(
  handle: ShareDirectoryHandle
): Promise<string[]> {
  const names: string[] = []
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === "file" && isFloorlineDbName(name)) {
      names.push(name)
    }
  }
  return listFloorlineDbNames(names)
}

export async function readShareDbFile(
  handle: ShareDirectoryHandle,
  fileName: string
): Promise<Uint8Array> {
  const fileHandle = await handle.getFileHandle(fileName)
  const file = await fileHandle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

export async function writeShareDbFile(
  handle: ShareDirectoryHandle,
  fileName: string,
  bytes: Uint8Array
): Promise<string> {
  const safe = sanitizeDbFileName(fileName)
  const fileHandle = await handle.getFileHandle(safe, { create: true })
  const writable = await fileHandle.createWritable()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  await writable.write(copy)
  await writable.close()
  return safe
}

export type ShareFolderSnapshot = {
  handle: ShareDirectoryHandle | null
  folderName: string | null
  permitted: boolean
  names: string[]
  lastName: string | null
}

export async function readShareFolderSnapshot(): Promise<ShareFolderSnapshot> {
  const [handle, lastName] = await Promise.all([
    loadShareDirectoryHandle(),
    loadLastShareDbName(),
  ])
  if (!handle) {
    return {
      handle: null,
      folderName: null,
      permitted: false,
      names: [],
      lastName,
    }
  }
  const state = await queryDirectoryPermission(handle, "read")
  if (state !== "granted") {
    return {
      handle,
      folderName: handle.name,
      permitted: false,
      names: [],
      lastName,
    }
  }
  return {
    handle,
    folderName: handle.name,
    permitted: true,
    names: await listShareDbNames(handle),
    lastName,
  }
}
