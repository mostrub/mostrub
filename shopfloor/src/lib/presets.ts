import { EMPTY_FILTERS } from "@/lib/filters"
import type { ProductionFilters } from "@/lib/types"

export type FilterPreset = {
  id: string
  name: string
  filters: ProductionFilters
  savedAt: string
}

const STORAGE_KEY = "floorline-presets"

export function loadPresets(): FilterPreset[] {
  if (typeof localStorage === "undefined") {
    return []
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return []
      }
      const rec = item as Record<string, unknown>
      if (typeof rec.id !== "string" || typeof rec.name !== "string") {
        return []
      }
      const filters =
        rec.filters && typeof rec.filters === "object"
          ? { ...EMPTY_FILTERS, ...rec.filters }
          : EMPTY_FILTERS
      return [
        {
          id: rec.id,
          name: rec.name,
          filters,
          savedAt: typeof rec.savedAt === "string" ? rec.savedAt : "",
        },
      ]
    })
  } catch {
    return []
  }
}

export function savePresets(presets: FilterPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function upsertPreset(
  presets: FilterPreset[],
  name: string,
  filters: ProductionFilters
): FilterPreset[] {
  const trimmed = name.trim()
  if (trimmed === "") {
    return presets
  }
  const existing = presets.find(
    (preset) => preset.name.toLowerCase() === trimmed.toLowerCase()
  )
  const next: FilterPreset = {
    id: existing?.id ?? `preset-${Date.now()}`,
    name: trimmed,
    filters,
    savedAt: new Date().toISOString(),
  }
  if (existing) {
    return presets.map((preset) => (preset.id === existing.id ? next : preset))
  }
  return [...presets, next]
}

export function removePreset(
  presets: FilterPreset[],
  id: string
): FilterPreset[] {
  return presets.filter((preset) => preset.id !== id)
}
