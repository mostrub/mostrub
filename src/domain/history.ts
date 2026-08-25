import type {
  HistoryAction,
  HistoryChange,
  HistoryEvent,
  InventoryState,
} from "./types"

export function appendHistory(
  state: InventoryState,
  event: Omit<HistoryEvent, "id" | "at"> & { id?: string; at?: string },
): InventoryState {
  const next: HistoryEvent = {
    id: event.id ?? crypto.randomUUID(),
    at: event.at ?? new Date().toISOString(),
    action: event.action,
    register: event.register,
    recordId: event.recordId,
    inventoryNumber: event.inventoryNumber,
    assetTag: event.assetTag,
    serialNumber: event.serialNumber,
    summary: event.summary,
    changes: event.changes,
  }
  return {
    ...state,
    history: [...state.history, next],
  }
}

export function diffFields(
  before: Record<string, string | number>,
  after: Record<string, string | number>,
): HistoryChange[] {
  return Object.keys(after).flatMap((field) => {
    const from = String(before[field] ?? "")
    const to = String(after[field] ?? "")
    if (from === to) {
      return []
    }
    return [{ field, from, to }]
  })
}

export function historyActionLabel(action: HistoryAction): string {
  switch (action) {
    case "created":
      return "Angelegt"
    case "updated":
      return "Geändert"
    case "destroyed":
      return "Vernichtet"
    case "destruction-removed":
      return "Vernichtung aufgehoben"
    case "removed":
      return "Aus dem Register entfernt"
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

export function queryDeviceHistory(
  state: InventoryState,
  query: string,
): HistoryEvent[] {
  const needle = query.trim().toLowerCase()
  const rows = [...state.history].sort((left, right) =>
    right.at.localeCompare(left.at),
  )
  if (!needle) {
    return rows
  }
  return rows.filter((event) =>
    [event.inventoryNumber, event.assetTag, event.serialNumber].some(
      (value) => value.trim().toLowerCase() === needle,
    ),
  )
}
