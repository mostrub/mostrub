import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import {
  LINE_EDGES,
  dependentLineDicePatch,
  dependentLineSql,
  pricingDicePatch,
  pricingSql,
  shiftLaborRate,
  starvedDownstream,
  unitCost,
  unitMargin,
  weightedMarginPct,
} from "./battery"

describe("unitCost", () => {
  it("adds material, cycle labor, scrap spread, and allocated downtime", () => {
    const cost = unitCost({
      materialCost: 2.1,
      cycleMs: 11_000,
      laborRatePerHour: 42,
      scrapQty: 1,
      goodQty: 9,
      downtimeMin: 60,
    })
    const labor = (11_000 / 3_600_000) * 42
    const scrap = (1 * 2.1) / 9
    const downtime = (60 / 60) * 42 / 9
    expect(cost).toBeCloseTo(2.1 + labor + scrap + downtime, 6)
  })
})

describe("unitMargin", () => {
  it("is list price minus unit cost", () => {
    const priced = unitMargin({ listPrice: 4.85, unitCost: 2.85 })
    expect(priced.margin).toBeCloseTo(2, 10)
    expect(priced.marginPct).toBeCloseTo((100 * 2) / 4.85, 10)
  })
})

describe("shiftLaborRate", () => {
  it("charges a night premium on shift B", () => {
    expect(shiftLaborRate("B")).toBeGreaterThan(shiftLaborRate("A"))
    expect(shiftLaborRate("A")).toBe(42)
  })
})

describe("starvedDownstream", () => {
  it("marks the next line when the feeder has unplanned downtime", () => {
    const rows = starvedDownstream({
      edges: LINE_EDGES,
      unplannedMinByLine: {
        "AUSTIN|CELL-1": 40,
        "AUSTIN|MOD-1": 0,
        "DALLAS|PACK-1": 0,
      },
    })
    expect(rows).toEqual([
      {
        upstreamPlant: "AUSTIN",
        upstreamLine: "CELL-1",
        downstreamPlant: "AUSTIN",
        downstreamLine: "MOD-1",
        upstreamDowntimeMin: 40,
      },
    ])
  })
})

describe("pricingSql", () => {
  it("joins the battery catalog and shift labor rates onto filtered cycles", () => {
    const sql = pricingSql({
      ...EMPTY_FILTERS,
      shifts: ["B"],
    })
    expect(sql).toContain("CELL-2170")
    expect(sql).toContain("CAST(4.85 AS DOUBLE)")
    expect(sql).toContain("list_price")
    expect(sql).toContain("unit_cost")
    expect(sql).toContain("margin_pct")
    expect(sql).toContain("rate_per_hour")
    expect(sql).toContain("WHERE shift IN ('B')")
  })
})

describe("weightedMarginPct", () => {
  it("weights margin by good units and list price", () => {
    expect(
      weightedMarginPct([
        { list_price: 10, unit_cost: 6, good_units: 2 },
        { list_price: 4, unit_cost: 3, good_units: 4 },
      ])
    ).toBeCloseTo((100 * (20 - 12 + 16 - 12)) / (20 + 16), 10)
  })
})

describe("pricingDicePatch", () => {
  it("dices sku, shift, plant, and line", () => {
    expect(
      pricingDicePatch({
        sku: "CELL-2170",
        shift: "B",
        plant: "AUSTIN",
        line: "CELL-1",
        margin: 1.2,
      })
    ).toEqual({
      skus: ["CELL-2170"],
      shifts: ["B"],
      plants: ["AUSTIN"],
      lines: ["CELL-1"],
    })
  })
})

describe("dependentLineDicePatch", () => {
  it("keeps both ends of the feeder edge", () => {
    expect(
      dependentLineDicePatch({
        up_plant: "AUSTIN",
        up_line: "MOD-1",
        down_plant: "DALLAS",
        down_line: "PACK-1",
        upstream_downtime_min: 12,
      })
    ).toEqual({
      plants: ["AUSTIN", "DALLAS"],
      lines: ["MOD-1", "PACK-1"],
    })
  })
})

describe("dependentLineSql", () => {
  it("follows CELL to MODULE to PACK", () => {
    const sql = dependentLineSql(EMPTY_FILTERS)
    expect(sql).toContain("CELL-1")
    expect(sql).toContain("MOD-1")
    expect(sql).toContain("PACK-1")
    expect(sql).toContain("STARVE")
    expect(sql).toContain("edges.up_plant")
    expect(sql).not.toMatch(/AS edges\([^)]+\)\s+e\b/)
  })
})
