import { describe, expect, it } from "vitest"

import {
  andonFill,
  andonTone,
  buildHeatGrid,
  heatFill,
  paretoWithCumulative,
} from "./shopfloor-charts"

describe("andonTone", () => {
  it("marks a healthy line ok and a slow or scrap-heavy line bad", () => {
    expect(
      andonTone({ fpyPct: 97, avgCycleMs: 11000, targetCycleMs: 11000 })
    ).toBe("ok")
    expect(
      andonTone({ fpyPct: 92, avgCycleMs: 11000, targetCycleMs: 11000 })
    ).toBe("warn")
    expect(
      andonTone({ fpyPct: 88, avgCycleMs: 11000, targetCycleMs: 11000 })
    ).toBe("bad")
    expect(
      andonTone({ fpyPct: 98, avgCycleMs: 14000, targetCycleMs: 11000 })
    ).toBe("bad")
  })
})

describe("paretoWithCumulative", () => {
  it("sorts minutes and accumulates to 100", () => {
    const rows = paretoWithCumulative([
      { reason_code: "STARVE", minutes: 20 },
      { reason_code: "FAULT", minutes: 60 },
      { reason_code: "CHANGE", minutes: 20 },
    ])
    expect(rows.map((row) => row.reason_code)).toEqual([
      "FAULT",
      "STARVE",
      "CHANGE",
    ])
    expect(rows[0]?.cumulative_pct).toBe(60)
    expect(rows[2]?.cumulative_pct).toBe(100)
  })
})

describe("buildHeatGrid", () => {
  it("indexes line and hour cells", () => {
    const grid = buildHeatGrid([
      { line: "MOD-1", hour: "07", cycles: 10, fpy_pct: 91 },
      { line: "CELL-1", hour: "06", cycles: 20, fpy_pct: 96 },
      { line: "CELL-1", hour: "07", cycles: 18, fpy_pct: 88 },
    ])
    expect(grid.lines).toEqual(["CELL-1", "MOD-1"])
    expect(grid.hours).toEqual(["06", "07"])
    expect(grid.cell("CELL-1", "06")?.cycles).toBe(20)
    expect(grid.cell("MOD-1", "06")).toBeNull()
    expect(heatFill(96)).toBe("var(--chart-2)")
    expect(andonFill("warn")).toBe("var(--chart-3)")
  })
})
