import { describe, expect, it } from "vitest"

import {
  EMPTY_FILTERS,
  decodeFilters,
  encodeFilters,
  escapeSqlLiteral,
  sanitizeFilters,
  sqlFrom,
  sqlWhere,
  viewHash,
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

  it("wraps filtered tables so callers can add another WHERE", () => {
    const from = sqlFrom("alarms", {
      ...EMPTY_FILTERS,
      lines: ["ASM-2"],
    })
    expect(from).toBe("(SELECT * FROM alarms WHERE line IN ('ASM-2'))")
    expect(`SELECT COUNT(*) FROM ${from} WHERE severity = 'CRITICAL'`).not.toContain(
      "WHERE line IN ('ASM-2') WHERE"
    )
  })
})

describe("sanitizeFilters", () => {
  it("drops non-array lists and unknown enum values from untrusted JSON", () => {
    const filters = sanitizeFilters({
      plants: "AUSTIN",
      lines: ["ASM-1", 12],
      results: ["PASS", "NOPE"],
      severities: ["CRITICAL", "LOUD"],
      downtimeCategories: ["UNPLANNED", "LUNCH"],
      from: 2026,
      search: 9,
      minCycleMs: "4000",
      onlyAnomalies: "yes",
    })
    expect(filters.plants).toEqual([])
    expect(filters.lines).toEqual(["ASM-1"])
    expect(filters.results).toEqual(["PASS"])
    expect(filters.severities).toEqual(["CRITICAL"])
    expect(filters.downtimeCategories).toEqual(["UNPLANNED"])
    expect(filters.from).toBeNull()
    expect(filters.search).toBe("")
    expect(filters.minCycleMs).toBeNull()
    expect(filters.onlyAnomalies).toBe(false)
  })

  it("keeps a well-formed filter set", () => {
    const source = {
      ...EMPTY_FILTERS,
      plants: ["AUSTIN"],
      from: "2026-08-25T00:00:00Z",
      minCycleMs: 4000,
      onlyAnomalies: true,
    }
    expect(sanitizeFilters(source)).toEqual(source)
  })
})

describe("decodeFilters", () => {
  it("does not let a share URL turn plants into a non-array", () => {
    const parsed = JSON.parse(
      decodeURIComponent(escape(atob(encodeFilters({ ...EMPTY_FILTERS, plants: ["AUSTIN"] }))))
    ) as Record<string, unknown>
    parsed.plants = "AUSTIN"
    const raw = btoa(unescape(encodeURIComponent(JSON.stringify(parsed))))
    expect(decodeFilters(raw)?.plants).toEqual([])
  })
})

describe("viewHash", () => {
  it("omits the filter query when nothing is selected", () => {
    expect(viewHash("dashboard", EMPTY_FILTERS)).toBe("#dashboard")
  })

  it("adds encoded filters only when at least one is active", () => {
    const filters = { ...EMPTY_FILTERS, plants: ["AUSTIN"] }
    expect(viewHash("triage", filters)).toBe(
      `#triage?f=${encodeFilters(filters)}`
    )
  })
})
