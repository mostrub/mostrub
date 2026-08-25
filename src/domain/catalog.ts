import type {
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

function hasDuplicateTag<T extends { id: string; assetTag: string }>(
  items: T[],
  record: T,
): boolean {
  const tag = record.assetTag.trim().toLowerCase()
  return items.some(
    (item) => item.id !== record.id && item.assetTag.trim().toLowerCase() === tag,
  )
}

function replaceById<T extends { id: string }>(items: T[], record: T): T[] {
  const index = items.findIndex((item) => item.id === record.id)
  if (index === -1) {
    return [...items, record]
  }
  return items.map((item) => (item.id === record.id ? record : item))
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

export function removeLaptop(state: InventoryState, id: string): InventoryState {
  return {
    ...state,
    laptops: state.laptops.filter((item) => item.id !== id),
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

export function removePrinter(state: InventoryState, id: string): InventoryState {
  return {
    ...state,
    printers: state.printers.filter((item) => item.id !== id),
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
  if (license.seatsAssigned > license.seatsPurchased) {
    return {
      ok: false,
      error: "Assigned seats cannot exceed purchased seats",
    }
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

  let laptops = state.laptops
  let printers = state.printers

  if (record.assetKind === "laptop" && record.assetId) {
    laptops = laptops.map((item) =>
      item.id === record.assetId ? { ...item, status: "destroyed" } : item,
    )
  }

  if (record.assetKind === "printer" && record.assetId) {
    printers = printers.map((item) =>
      item.id === record.assetId ? { ...item, status: "destroyed" } : item,
    )
  }

  return {
    ok: true,
    state: {
      ...state,
      laptops,
      printers,
      destructions: replaceById(state.destructions, record),
    },
  }
}

export function removeDestruction(
  state: InventoryState,
  id: string,
): InventoryState {
  return {
    ...state,
    destructions: state.destructions.filter((item) => item.id !== id),
  }
}

export function newId(): string {
  return crypto.randomUUID()
}
