import { describe, expect, it } from "vitest"

import {
  EMPTY_FILTERS,
  escapeSqlLiteral,
  sqlWhere,
} from "./filters"

describe("sqlWhere", () => {
  it("returns empty string when no filters are set", () => {
    expect(sqlWhere(EMPTY_FILTERS, "cycles")).toBe("")
  })

  it("ANDs plant and line membership lists", () => {
    const sql = sqlWhere(
      {
        ...EMPTY_FILTERS,
        plants: ["AUSTIN"],
        lines: ["ASM-1", "ASM-2"],
      },
      "cycles"
    )
    expect(sql).toBe(
      "WHERE plant IN ('AUSTIN') AND line IN ('ASM-1', 'ASM-2')"
    )
  })

  it("escapes quotes in search text", () => {
    expect(escapeSqlLiteral("O'Hare")).toBe("O''Hare")
    const sql = sqlWhere(
      { ...EMPTY_FILTERS, search: "O'Hare" },
      "cycles"
    )
    expect(sql).toContain("O''Hare")
    expect(sql).toContain("ILIKE")
  })

  it("applies time range to the table clock column", () => {
    const sql = sqlWhere(
      {
        ...EMPTY_FILTERS,
        from: "2026-08-25T00:00:00Z",
        to: "2026-08-25T12:00:00Z",
      },
      "alarms"
    )
    expect(sql).toContain("raised_at >= '2026-08-25T00:00:00Z'")
    expect(sql).toContain("raised_at <= '2026-08-25T12:00:00Z'")
  })

  it("flags cycle anomalies as fail or 20 percent over target", () => {
    const sql = sqlWhere(
      { ...EMPTY_FILTERS, onlyAnomalies: true },
      "cycles"
    )
    expect(sql).toContain("result <> 'PASS'")
    expect(sql).toContain("cycle_ms > target_cycle_ms * 1.2")
  })
})
