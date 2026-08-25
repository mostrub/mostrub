import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import { removePreset, upsertPreset } from "./presets"

describe("filter presets", () => {
  it("adds and replaces by name", () => {
    const first = upsertPreset([], "ASM-2 night", {
      ...EMPTY_FILTERS,
      lines: ["ASM-2"],
    })
    expect(first).toHaveLength(1)
    const second = upsertPreset(first, "ASM-2 night", {
      ...EMPTY_FILTERS,
      lines: ["ASM-2"],
      shifts: ["B"],
    })
    expect(second).toHaveLength(1)
    expect(second[0]?.filters.shifts).toEqual(["B"])
  })

  it("removes by id", () => {
    const presets = upsertPreset([], "keep", EMPTY_FILTERS)
    const id = presets[0]?.id ?? ""
    expect(removePreset(presets, id)).toEqual([])
  })
})
