import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import {
  olapCompatibleMeasures,
  olapCubeSql,
  olapDicePatch,
  sanitizeOlapDimensions,
  sanitizeOlapMeasures,
} from "./olap"

describe("sanitizeOlapDimensions", () => {
  it("keeps allowlisted dimensions in order and drops the rest", () => {
    expect(
      sanitizeOlapDimensions(["line", "drop table", "plant", "line"])
    ).toEqual(["line", "plant"])
  })

  it("treats a missing list as plant then line", () => {
    expect(sanitizeOlapDimensions(undefined)).toEqual(["plant", "line"])
  })
})

describe("sanitizeOlapMeasures", () => {
  it("keeps allowlisted measures and falls back when none remain", () => {
    expect(sanitizeOlapMeasures(["fpy_pct", "cycles';--"])).toEqual(["fpy_pct"])
    expect(sanitizeOlapMeasures(["nope"])).toEqual([
      "cycles",
      "units",
      "fpy_pct",
    ])
  })
})

describe("olapCompatibleMeasures", () => {
  it("drops downtime and alarms when the cube grain includes SKU", () => {
    expect(
      olapCompatibleMeasures(["plant", "sku"], [
        "cycles",
        "downtime_min",
        "open_alarms",
      ])
    ).toEqual(["cycles"])
  })

  it("keeps downtime when every dimension exists on downtime events", () => {
    expect(
      olapCompatibleMeasures(["plant", "shift"], ["cycles", "downtime_min"])
    ).toEqual(["cycles", "downtime_min"])
  })
})

describe("olapCubeSql", () => {
  it("builds a filtered cycle cube grouped by the selected dimensions", () => {
    const sql = olapCubeSql({
      filters: { ...EMPTY_FILTERS, plants: ["AUSTIN"] },
      dimensions: ["plant", "line"],
      measures: ["cycles", "units", "fpy_pct"],
    })
    expect(sql).toContain("FROM (SELECT * FROM cycles WHERE plant IN ('AUSTIN'))")
    expect(sql).toContain("cube_cycles")
    expect(sql).toContain("GROUP BY 1, 2")
    expect(sql).toContain("AS fpy_pct")
    expect(sql).not.toContain("cube_downtime")
  })

  it("left-joins downtime at the same grain", () => {
    const sql = olapCubeSql({
      filters: EMPTY_FILTERS,
      dimensions: ["plant"],
      measures: ["cycles", "downtime_min"],
    })
    expect(sql).toContain("cube_downtime")
    expect(sql).toContain("LEFT JOIN cube_downtime")
    expect(sql).toContain("USING (plant)")
    expect(sql).toContain("duration_ms")
  })

  it("rolls up to a single total row when no dimensions are set", () => {
    const sql = olapCubeSql({
      filters: EMPTY_FILTERS,
      dimensions: [],
      measures: ["cycles"],
    })
    expect(sql).toContain("AS cycles")
    expect(sql).not.toContain("GROUP BY")
  })

  it("does not interpolate unknown identifiers", () => {
    const sql = olapCubeSql({
      filters: EMPTY_FILTERS,
      dimensions: ["plant"],
      measures: ["cycles"],
    })
    expect(sql).not.toMatch(/;|DROP|INSERT/i)
  })
})

describe("olapDicePatch", () => {
  it("pins every dimension present on the cube row", () => {
    expect(
      olapDicePatch({
        plant: "AUSTIN",
        line: "ASM-1",
        cycles: 28,
      })
    ).toEqual({
      plants: ["AUSTIN"],
      lines: ["ASM-1"],
    })
  })

  it("turns an hour bucket into a one-hour time window", () => {
    expect(olapDicePatch({ hour: "2026-08-25 06:00", cycles: 10 })).toEqual({
      from: "2026-08-25T06:00:00",
      to: "2026-08-25T07:00:00",
    })
  })
})
