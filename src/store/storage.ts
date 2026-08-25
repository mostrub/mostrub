import { emptyInventory } from "@/domain/catalog"
import { createSeedInventory } from "@/domain/seed"
import type { InventoryState } from "@/domain/types"

export const STORAGE_KEY = "plant-it-inventory.v1"

type StoredPayload = {
  version: 1
  state: InventoryState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isInventoryState(value: unknown): value is InventoryState {
  if (!isRecord(value)) {
    return false
  }
  return (
    Array.isArray(value.laptops) &&
    Array.isArray(value.printers) &&
    Array.isArray(value.software) &&
    Array.isArray(value.destructions)
  )
}

export function loadInventory(): InventoryState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return createSeedInventory()
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed) && parsed.version === 1 && isInventoryState(parsed.state)) {
      return parsed.state
    }
  } catch {
    return createSeedInventory()
  }

  return createSeedInventory()
}

export function saveInventory(state: InventoryState): void {
  const payload: StoredPayload = { version: 1, state }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function parseInventoryBackup(value: unknown): InventoryState | null {
  if (isInventoryState(value)) {
    return value
  }
  if (isRecord(value) && isInventoryState(value.state)) {
    return value.state
  }
  return null
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
