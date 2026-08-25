import { newId } from "@/lib/id"
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
    id: event.id ?? newId(),
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

export function formatHistoryChanges(changes: HistoryChange[]): string {
  if (changes.length === 0) {
    return "—"
  }
  return changes
    .map((change) => `${change.field}: ${change.from || "—"} → ${change.to || "—"}`)
    .join("; ")
}

function identifiersMatch(
  item: { inventoryNumber: string; assetTag?: string; serialNumber?: string; entitlementId?: string },
  needle: string,
): boolean {
  return [
    item.inventoryNumber,
    item.assetTag ?? "",
    item.serialNumber ?? "",
    item.entitlementId ?? "",
  ].some((value) => value.trim().toLowerCase() === needle)
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

  const liveIds = new Set<string>()
  for (const item of [
    ...state.laptops,
    ...state.printers,
    ...state.software,
    ...state.destructions,
  ]) {
    if (item.id.toLowerCase() === needle || identifiersMatch(item, needle)) {
      liveIds.add(item.id)
    }
  }
  for (const record of state.destructions) {
    if (record.assetId && liveIds.has(record.assetId)) {
      liveIds.add(record.id)
    }
  }

  if (liveIds.size > 0) {
    return rows.filter((event) => liveIds.has(event.recordId))
  }

  return rows.filter((event) =>
    [event.inventoryNumber, event.assetTag, event.serialNumber].some(
      (value) => value.trim().toLowerCase() === needle,
    ),
  )
}
