import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import { hourlyThroughputSql, lineHourHeatSql, oeeSql, triageTreeSql } from "./queries"

describe("triageTreeSql", () => {
  it("aggregates one hierarchy level at a time", () => {
    expect(triageTreeSql(EMPTY_FILTERS)).toContain("SELECT plant,")
    expect(triageTreeSql(EMPTY_FILTERS)).toContain("GROUP BY 1")
    expect(triageTreeSql(EMPTY_FILTERS)).not.toContain("controller_id")
    expect(
      triageTreeSql({ ...EMPTY_FILTERS, plants: ["AUSTIN"] })
    ).toContain("SELECT plant, line,")
  })
})

describe("hourlyThroughputSql", () => {
  it("splits good rework and scrap for a stacked mix", () => {
    const sql = hourlyThroughputSql(EMPTY_FILTERS)
    expect(sql).toContain("SUM(rework_qty) AS rework_units")
    expect(sql).toContain("SUM(scrap_qty) AS scrap_units")
  })
})

describe("lineHourHeatSql", () => {
  it("cubes first-pass yield by line and hour", () => {
    const sql = lineHourHeatSql(EMPTY_FILTERS)
    expect(sql).toContain("strftime(CAST(started_at AS TIMESTAMP), '%H') AS hour")
    expect(sql).toContain("AS fpy_pct")
    expect(sql).toContain("GROUP BY 1, 2")
  })
})

describe("oeeSql", () => {
  it("weights ideal time by units on each cycle instead of averaging targets", () => {
    const sql = oeeSql(EMPTY_FILTERS)
    expect(sql).toContain(
      "CAST(target_cycle_ms AS BIGINT) * (good_qty + scrap_qty + rework_qty)"
    )
    expect(sql).toContain("AS ideal_ms")
    expect(sql).toContain("GREATEST")
    expect(sql).toContain("span.start_ts")
  })
})
