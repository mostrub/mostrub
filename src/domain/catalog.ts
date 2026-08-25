import type {
  AssetKind,
  DestructionRecord,
  InventoryState,
  Laptop,
  Printer,
  SaveResult,
  SoftwareLicense,
} from "./types"

export function emptyInventory(): InventoryState {
  return {
    laptops: [],
    printers: [],
    software: [],
    destructions: [],
  }
}

function required(value: string, label: string): string | null {
  if (value.trim().length === 0) {
    return `${label} is required`
  }
  return null
}

export function normalizeAssetTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function hasDuplicateTag<T extends { id: string; assetTag: string }>(
  items: T[],
  record: T,
): boolean {
  const tag = normalizeAssetTag(record.assetTag)
  return items.some(
    (item) => item.id !== record.id && normalizeAssetTag(item.assetTag) === tag,
  )
}

function hasDuplicateSerial<T extends { id: string; serialNumber: string }>(
  items: T[],
  record: T,
): boolean {
  const serial = record.serialNumber.trim().toLowerCase()
  if (!serial) {
    return false
  }
  return items.some(
    (item) =>
      item.id !== record.id && item.serialNumber.trim().toLowerCase() === serial,
  )
}

function replaceById<T extends { id: string }>(items: T[], record: T): T[] {
  const index = items.findIndex((item) => item.id === record.id)
  if (index === -1) {
    return [...items, record]
  }
  return items.map((item) => (item.id === record.id ? record : item))
}

export function findHardwareByTag(
  state: InventoryState,
  tag: string,
): { kind: Exclude<AssetKind, "other">; id: string } | null {
  const needle = normalizeAssetTag(tag)
  if (!needle) {
    return null
  }

  const laptop = state.laptops.find(
    (item) => normalizeAssetTag(item.assetTag) === needle,
  )
  if (laptop) {
    return { kind: "laptop", id: laptop.id }
  }

  const printer = state.printers.find(
    (item) => normalizeAssetTag(item.assetTag) === needle,
  )
  if (printer) {
    return { kind: "printer", id: printer.id }
  }

  return null
}

function syncDestroyedHardware(
  state: InventoryState,
  destructions: DestructionRecord[],
): Pick<InventoryState, "laptops" | "printers"> {
  const linked = new Set(
    destructions.map((record) => record.assetId).filter((id) => id.length > 0),
  )

  return {
    laptops: state.laptops.map((item) => {
      if (linked.has(item.id)) {
        return { ...item, status: "destroyed" }
      }
      if (item.status === "destroyed") {
        return { ...item, status: "in-service" }
      }
      return item
    }),
    printers: state.printers.map((item) => {
      if (linked.has(item.id)) {
        return { ...item, status: "destroyed" }
      }
      if (item.status === "destroyed") {
        return { ...item, status: "in-service" }
      }
      return item
    }),
  }
}

function blockDestroyedDelete(status: string): SaveResult<InventoryState> | null {
  if (status === "destroyed") {
    return {
      ok: false,
      error: "Remove the destruction log first",
    }
  }
  return null
}

export function upsertLaptop(
  state: InventoryState,
  laptop: Laptop,
): SaveResult<InventoryState> {
  const missing = required(laptop.assetTag, "Asset tag")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (hasDuplicateTag(state.laptops, laptop)) {
    return { ok: false, error: "A laptop with this asset tag already exists" }
  }
  if (hasDuplicateSerial(state.laptops, laptop)) {
    return { ok: false, error: "A laptop with this serial already exists" }
  }

  return {
    ok: true,
    state: {
      ...state,
      laptops: replaceById(state.laptops, {
        ...laptop,
        assetTag: laptop.assetTag.trim(),
      }),
    },
  }
}

export function removeLaptop(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> {
  const item = state.laptops.find((laptop) => laptop.id === id)
  if (!item) {
    return { ok: true, state }
  }
  const blocked = blockDestroyedDelete(item.status)
  if (blocked) {
    return blocked
  }
  return {
    ok: true,
    state: {
      ...state,
      laptops: state.laptops.filter((laptop) => laptop.id !== id),
    },
  }
}

export function upsertPrinter(
  state: InventoryState,
  printer: Printer,
): SaveResult<InventoryState> {
  const missing = required(printer.assetTag, "Asset tag")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (hasDuplicateTag(state.printers, printer)) {
    return { ok: false, error: "A printer with this asset tag already exists" }
  }
  if (hasDuplicateSerial(state.printers, printer)) {
    return { ok: false, error: "A printer with this serial already exists" }
  }

  return {
    ok: true,
    state: {
      ...state,
      printers: replaceById(state.printers, {
        ...printer,
        assetTag: printer.assetTag.trim(),
      }),
    },
  }
}

export function removePrinter(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> {
  const item = state.printers.find((printer) => printer.id === id)
  if (!item) {
    return { ok: true, state }
  }
  const blocked = blockDestroyedDelete(item.status)
  if (blocked) {
    return blocked
  }
  return {
    ok: true,
    state: {
      ...state,
      printers: state.printers.filter((printer) => printer.id !== id),
    },
  }
}

export function upsertSoftware(
  state: InventoryState,
  license: SoftwareLicense,
): SaveResult<InventoryState> {
  const missing = required(license.name, "Software name")
  if (missing) {
    return { ok: false, error: missing }
  }

  return {
    ok: true,
    state: {
      ...state,
      software: replaceById(state.software, license),
    },
  }
}

export function removeSoftware(state: InventoryState, id: string): InventoryState {
  return {
    ...state,
    software: state.software.filter((item) => item.id !== id),
  }
}

export function recordDestruction(
  state: InventoryState,
  record: DestructionRecord,
): SaveResult<InventoryState> {
  const missing = required(record.assetTag, "Asset tag")
  if (missing) {
    return { ok: false, error: missing }
  }

  const match = findHardwareByTag(state, record.assetTag)
  const nextRecord: DestructionRecord = {
    ...record,
    assetTag: record.assetTag.trim(),
    assetId: match?.id ?? "",
    assetKind: match?.kind ?? record.assetKind,
  }
  const destructions = replaceById(state.destructions, nextRecord)
  const hardware = syncDestroyedHardware(state, destructions)

  return {
    ok: true,
    state: {
      ...state,
      ...hardware,
      destructions,
    },
  }
}

export function removeDestruction(
  state: InventoryState,
  id: string,
): InventoryState {
  const destructions = state.destructions.filter((item) => item.id !== id)
  const hardware = syncDestroyedHardware(state, destructions)
  return {
    ...state,
    ...hardware,
    destructions,
  }
}

export function newId(): string {
  return crypto.randomUUID()
}
