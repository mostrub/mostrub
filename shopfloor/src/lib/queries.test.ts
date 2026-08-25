import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import { oeeSql } from "./queries"

describe("oeeSql", () => {
  it("weights ideal time by units on each cycle instead of averaging targets", () => {
    const sql = oeeSql(EMPTY_FILTERS)
    expect(sql).toContain(
      "CAST(target_cycle_ms AS BIGINT) * (good_qty + scrap_qty + rework_qty)"
    )
    expect(sql).toContain("AS ideal_ms")
  })
})
