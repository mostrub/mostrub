import { describe, expect, it } from "vitest"

import { computeOee } from "./oee"

describe("computeOee", () => {
  it("returns the product of availability, performance, and quality", () => {
    const parts = computeOee({
      windowMs: 10 * 60_000,
      unplannedDowntimeMs: 1 * 60_000,
      units: 50,
      goodUnits: 45,
      targetCycleMs: 10_000,
    })
    expect(parts.availability).toBeCloseTo(90)
    expect(parts.performance).toBeCloseTo(92.59, 1)
    expect(parts.quality).toBeCloseTo(90)
    expect(parts.oee).toBeCloseTo(75, 0)
  })

  it("is zero when the window is empty", () => {
    const parts = computeOee({
      windowMs: 0,
      unplannedDowntimeMs: 0,
      units: 0,
      goodUnits: 0,
      targetCycleMs: 0,
    })
    expect(parts.oee).toBe(0)
    expect(parts.availability).toBe(0)
  })

  it("caps performance at 100 when the line is faster than target", () => {
    const parts = computeOee({
      windowMs: 60_000,
      unplannedDowntimeMs: 0,
      units: 20,
      goodUnits: 20,
      targetCycleMs: 10_000,
    })
    expect(parts.performance).toBe(100)
  })
})
