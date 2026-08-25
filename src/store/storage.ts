import { emptyInventory } from "@/domain/catalog"
import { normalizeInventoryState } from "@/domain/normalize"
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
    history: Array.isArray(value.history) ? value.history : [],
  }
}

function toInventoryState(state: InventoryState): InventoryState {
  return normalizeInventoryState({
    laptops: state.laptops,
    printers: state.printers,
    software: state.software,
    destructions: state.destructions,
    history: state.history ?? [],
  })
}

export function parseInventoryValue(value: unknown): ParseInventoryResult {
  const direct = coerceInventory(value)
  if (isInventoryState(direct)) {
    return { ok: true, state: toInventoryState(direct) }
  }
  if (isRecord(value)) {
    const wrapped = coerceInventory(value.state)
    if (isInventoryState(wrapped)) {
      return { ok: true, state: toInventoryState(wrapped) }
    }
  }
  return {
    ok: false,
    reason: "That file is not a complete inventory backup",
  }
}

export function parseInventoryJson(raw: string): ParseInventoryResult {
  try {
    return parseInventoryValue(JSON.parse(raw) as unknown)
  } catch {
    return { ok: false, reason: "That file is not valid JSON" }
  }
}

export function parseInventoryBackup(value: unknown): InventoryState | null {
  const parsed = parseInventoryValue(value)
  return parsed.ok ? parsed.state : null
}

export function loadInventory(): InventoryLoad {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seed = createSeedInventory()
    saveInventory(seed)
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
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
