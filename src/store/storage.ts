import { emptyInventory } from "@/domain/catalog"
import { inventoryIntegrityError, normalizeInventoryState } from "@/domain/normalize"
import { createSeedInventory } from "@/domain/seed"
import type { InventoryState } from "@/domain/types"
import { isInventoryState } from "@/domain/validate"

export { isInventoryState } from "@/domain/validate"

export const STORAGE_KEY = "plant-it-inventory.v1"

type StoredPayload = {
  version: 1
  state: InventoryState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export type ParseInventoryResult =
  | { ok: true; state: InventoryState }
  | { ok: false; reason: string }

export type InventoryLoad =
  | { status: "ok"; state: InventoryState }
  | { status: "corrupt"; reason: string }

function coerceRecord(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    inventoryNumber:
      typeof value.inventoryNumber === "string" ? value.inventoryNumber : "",
  }
}

function coerceList(items: unknown): unknown {
  if (!Array.isArray(items)) {
    return items
  }
  return items.map((item) => (isRecord(item) ? coerceRecord(item) : item))
}

function coerceInventory(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }
  return {
    ...value,
    laptops: coerceList(value.laptops),
    printers: coerceList(value.printers),
    software: coerceList(value.software),
    destructions: coerceList(value.destructions),
    history: "history" in value ? value.history : [],
  }
}

function toInventoryState(state: InventoryState): ParseInventoryResult {
  const next = normalizeInventoryState({
    laptops: state.laptops,
    printers: state.printers,
    software: state.software,
    destructions: state.destructions,
    history: state.history ?? [],
  })
  const integrity = inventoryIntegrityError(next)
  if (integrity) {
    return { ok: false, reason: integrity }
  }
  return { ok: true, state: next }
}

export function parseInventoryValue(value: unknown): ParseInventoryResult {
  const direct = coerceInventory(value)
  if (isInventoryState(direct)) {
    return toInventoryState(direct)
  }
  if (isRecord(value)) {
    const wrapped = coerceInventory(value.state)
    if (isInventoryState(wrapped)) {
      return toInventoryState(wrapped)
    }
  }
  return {
    ok: false,
    reason: "Diese Datei ist kein vollständiges Inventar-Backup",
  }
}

export function parseInventoryJson(raw: string): ParseInventoryResult {
  try {
    return parseInventoryValue(JSON.parse(raw) as unknown)
  } catch {
    return { ok: false, reason: "Diese Datei ist kein gültiges JSON" }
  }
}

export function loadInventory(): InventoryLoad {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { status: "ok", state: createSeedInventory() }
  }
  if (!raw) {
    const seed = createSeedInventory()
    try {
      saveInventory(seed)
    } catch {
      return { status: "ok", state: seed }
    }
    return { status: "ok", state: seed }
  }

  const parsed = parseInventoryJson(raw)
  if (!parsed.ok) {
    return { status: "corrupt", reason: parsed.reason }
  }
  return { status: "ok", state: parsed.state }
}

export function saveInventory(state: InventoryState): void {
  const payload: StoredPayload = { version: 1, state }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    throw new Error("Inventar konnte nicht gespeichert werden")
  }
}

export function resetInventory(): InventoryState {
  const next = createSeedInventory()
  saveInventory(next)
  return next
}

export function clearToEmpty(): InventoryState {
  const next = emptyInventory()
  saveInventory(next)
  return next
}
