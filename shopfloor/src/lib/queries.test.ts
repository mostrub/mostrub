import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import { oeeSql, triageTreeSql } from "./queries"

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
