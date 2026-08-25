import type {
  DestructionRecord,
  HistoryEvent,
  InventoryState,
  Laptop,
  Printer,
  SoftwareLicense,
} from "./types"

type MaybeNumbered<T> = Omit<T, "inventoryNumber"> & { inventoryNumber?: string }

function normalizeKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function listInventoryNumbers(state: {
  laptops: Array<{ inventoryNumber?: string }>
  printers: Array<{ inventoryNumber?: string }>
  software: Array<{ inventoryNumber?: string }>
  destructions: Array<{ inventoryNumber?: string }>
}): string[] {
  return [
    ...state.laptops.map((item) => item.inventoryNumber ?? ""),
    ...state.printers.map((item) => item.inventoryNumber ?? ""),
    ...state.software.map((item) => item.inventoryNumber ?? ""),
    ...state.destructions.map((item) => item.inventoryNumber ?? ""),
  ]
}

export function nextInventoryNumber(
  state: {
    laptops: Array<{ inventoryNumber?: string }>
    printers: Array<{ inventoryNumber?: string }>
    software: Array<{ inventoryNumber?: string }>
    destructions: Array<{ inventoryNumber?: string }>
  },
  extra: string[] = [],
): string {
  const used = new Set(
    [...listInventoryNumbers(state), ...extra]
      .map(normalizeKey)
      .filter((value) => value.length > 0),
  )

  let highest = 0
  for (const value of used) {
    const match = /^inv-(\d+)$/.exec(value)
    if (match) {
      highest = Math.max(highest, Number(match[1]))
    }
  }

  let next = highest + 1
  let candidate = formatInventoryNumber(next)
  while (used.has(normalizeKey(candidate))) {
    next += 1
    candidate = formatInventoryNumber(next)
  }
  return candidate
}

function formatInventoryNumber(value: number): string {
  return `INV-${String(value).padStart(4, "0")}`
}

export function inventoryNumberTaken(
  state: InventoryState,
  inventoryNumber: string,
  exceptId?: string,
): boolean {
  const needle = normalizeKey(inventoryNumber)
  if (!needle) {
    return false
  }

  const live = [...state.laptops, ...state.printers, ...state.software]
  if (
    live.some(
      (item) => item.id !== exceptId && normalizeKey(item.inventoryNumber) === needle,
    )
  ) {
    return true
  }
  return state.destructions.some(
    (item) =>
      item.id !== exceptId &&
      item.assetId !== exceptId &&
      normalizeKey(item.inventoryNumber) === needle,
  )
}

function fillNumber(
  current: string,
  assigned: string[],
  state: {
    laptops: Array<{ inventoryNumber?: string }>
    printers: Array<{ inventoryNumber?: string }>
    software: Array<{ inventoryNumber?: string }>
    destructions: Array<{ inventoryNumber?: string }>
  },
): string {
  const trimmed = current.trim()
  if (trimmed) {
    assigned.push(trimmed)
    return trimmed
  }
  const next = nextInventoryNumber(state, assigned)
  assigned.push(next)
  return next
}

export function inventoryIntegrityError(state: InventoryState): string | null {
  const records = [
    ...state.laptops,
    ...state.printers,
    ...state.software,
    ...state.destructions,
  ]
  const ids = records.map((item) => item.id)
  if (new Set(ids).size !== ids.length) {
    return "Backup enthält doppelte Datensatz-IDs"
  }
  const numbers = records
    .map((item) => item.inventoryNumber.trim().toLowerCase())
    .filter((value) => value.length > 0)
  if (new Set(numbers).size !== numbers.length) {
    return "Backup enthält doppelte Inventarnummern"
  }
  return null
}

export function normalizeInventoryState(state: {
  laptops: MaybeNumbered<Laptop>[]
  printers: MaybeNumbered<Printer>[]
  software: MaybeNumbered<SoftwareLicense>[]
  destructions: MaybeNumbered<DestructionRecord>[]
  history?: HistoryEvent[]
}): InventoryState {
  const assigned: string[] = []
  const laptops = state.laptops.map((item) => ({
    ...item,
    inventoryNumber: fillNumber(item.inventoryNumber ?? "", assigned, state),
  }))
  const printers = state.printers.map((item) => ({
    ...item,
    inventoryNumber: fillNumber(item.inventoryNumber ?? "", assigned, state),
  }))
  const software = state.software.map((item) => ({
    ...item,
    inventoryNumber: fillNumber(item.inventoryNumber ?? "", assigned, state),
  }))

  const byId = new Map<string, string>([
    ...laptops.map((item) => [item.id, item.inventoryNumber] as const),
    ...printers.map((item) => [item.id, item.inventoryNumber] as const),
  ])

  const destructions = state.destructions.map((item) => {
    const linked = item.assetId ? byId.get(item.assetId) : undefined
    return {
      ...item,
      inventoryNumber: fillNumber(
        item.inventoryNumber || linked || "",
        assigned,
        {
          ...state,
          laptops,
          printers,
          software,
        },
      ),
    }
  })

  const linked = new Set(
    destructions.map((record) => record.assetId).filter((id) => id.length > 0),
  )

  return {
    laptops: laptops.map((item) =>
      linked.has(item.id)
        ? { ...item, status: "destroyed" as const }
        : item.status === "destroyed"
          ? { ...item, status: "in-service" as const }
          : item,
    ),
    printers: printers.map((item) =>
      linked.has(item.id)
        ? { ...item, status: "destroyed" as const }
        : item.status === "destroyed"
          ? { ...item, status: "in-service" as const }
          : item,
    ),
    software,
    destructions,
    history: Array.isArray(state.history) ? state.history : [],
  }
}
