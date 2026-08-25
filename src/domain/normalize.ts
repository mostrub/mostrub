import type { InventoryState } from "./types"

function normalizeKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function listInventoryNumbers(state: InventoryState): string[] {
  return [
    ...state.laptops.map((item) => item.inventoryNumber ?? ""),
    ...state.printers.map((item) => item.inventoryNumber ?? ""),
    ...state.software.map((item) => item.inventoryNumber ?? ""),
    ...state.destructions.map((item) => item.inventoryNumber ?? ""),
  ]
}

export function nextInventoryNumber(state: InventoryState, extra: string[] = []): string {
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

  const hardware = [...state.laptops, ...state.printers, ...state.software]
  return hardware.some(
    (item) => item.id !== exceptId && normalizeKey(item.inventoryNumber) === needle,
  )
}

function fillNumber(
  current: string,
  assigned: string[],
  state: InventoryState,
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

export function normalizeInventoryState(state: InventoryState): InventoryState {
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

  return {
    laptops,
    printers,
    software,
    destructions,
    history: Array.isArray(state.history) ? state.history : [],
  }
}
