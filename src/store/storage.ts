import { emptyInventory } from "@/domain/catalog"
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

function toInventoryState(state: InventoryState): InventoryState {
  return {
    laptops: state.laptops,
    printers: state.printers,
    software: state.software,
    destructions: state.destructions,
  }
}

export function parseInventoryValue(value: unknown): ParseInventoryResult {
  if (isInventoryState(value)) {
    return { ok: true, state: toInventoryState(value) }
  }
  if (isRecord(value) && isInventoryState(value.state)) {
    return { ok: true, state: toInventoryState(value.state) }
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
