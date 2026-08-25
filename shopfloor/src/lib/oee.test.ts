import { describe, expect, it } from "vitest"

import { computeOee, oeeLossMinutes } from "./oee"

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

  it("prefers weighted ideal time when mix-model targets differ", () => {
    const windowMs = 400_000
    const avgTargetMs = 15_000
    const units = 11
    const weightedIdealMs = 10_000 * 1 + 20_000 * 10
    const fromAverage = computeOee({
      windowMs,
      unplannedDowntimeMs: 0,
      units,
      goodUnits: units,
      targetCycleMs: avgTargetMs,
    })
    const fromIdeal = computeOee({
      windowMs,
      unplannedDowntimeMs: 0,
      units,
      goodUnits: units,
      targetCycleMs: avgTargetMs,
      idealMs: weightedIdealMs,
    })
    expect(fromAverage.performance).toBeCloseTo((100 * avgTargetMs * units) / windowMs)
    expect(fromIdeal.performance).toBeCloseTo((100 * weightedIdealMs) / windowMs)
    expect(fromIdeal.performance).not.toBeCloseTo(fromAverage.performance)
  })
})

describe("oeeLossMinutes", () => {
  it("splits window time into availability, speed, and scrap losses", () => {
    const losses = oeeLossMinutes({
      windowMs: 100 * 60_000,
      unplannedDowntimeMs: 20 * 60_000,
      idealMs: 50 * 60_000,
      quality: 80,
    })
    expect(losses.map((row) => row.key)).toEqual([
      "availability",
      "performance",
      "quality",
    ])
    expect(losses[0]?.minutes).toBeCloseTo(20)
    expect(losses[1]?.minutes).toBeCloseTo(30)
    expect(losses[2]?.minutes).toBeCloseTo(10)
  })
})
