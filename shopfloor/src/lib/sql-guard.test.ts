import { describe, expect, it } from "vitest"

import { assertReadOnlySelect } from "./sql-guard"

describe("assertReadOnlySelect", () => {
  it("allows a plain select", () => {
    expect(assertReadOnlySelect("SELECT * FROM cycles LIMIT 5")).toBe(
      "SELECT * FROM cycles LIMIT 5"
    )
  })

  it("allows a CTE", () => {
    expect(
      assertReadOnlySelect("WITH x AS (SELECT 1) SELECT * FROM x")
    ).toContain("WITH")
  })

  it("rejects writes even if they start with a comment-like prefix", () => {
    expect(() => assertReadOnlySelect("DELETE FROM cycles")).toThrow(
      /SELECT/
    )
    expect(() =>
      assertReadOnlySelect("SELECT * FROM cycles; DROP TABLE cycles")
    ).toThrow(/eine Anweisung/)
    expect(() =>
      assertReadOnlySelect("SELECT * FROM cycles WHERE result = 'PASS' ; COPY x")
    ).toThrow()
  })
})
