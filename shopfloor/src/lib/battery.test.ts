import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import {
  LINE_EDGES,
  dependentLineDicePatch,
  dependentLineSql,
  stationDicePatch,
  starvedDownstream,
} from "./battery"
import { resolveAppView } from "./types"

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

describe("stationDicePatch", () => {
  it("pins plant, line, and station", () => {
    expect(
      stationDicePatch({
        plant: "AUSTIN",
        line: "CELL-1",
        station: "ST-04",
      })
    ).toEqual({
      plants: ["AUSTIN"],
      lines: ["CELL-1"],
      stations: ["ST-04"],
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

describe("resolveAppView", () => {
  it("sends the old Preise hash to Verluste", () => {
    expect(resolveAppView("pricing")).toBe("losses")
    expect(resolveAppView("losses")).toBe("losses")
    expect(resolveAppView("dashboard")).toBe("dashboard")
    expect(resolveAppView("unknown")).toBeNull()
  })
})
