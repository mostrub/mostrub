import { describe, expect, it } from "vitest"

import { rowsToCsv } from "./csv"

describe("rowsToCsv", () => {
  it("quotes commas and doubles embedded quotes", () => {
    const csv = rowsToCsv({
      headers: ["Asset tag", "Notes"],
      rows: [["LT-1", 'Needs "dock", then wipe']],
    })

    expect(csv).toBe('Asset tag,Notes\nLT-1,"Needs ""dock"", then wipe"')
  })

  it("preserves empty cells", () => {
    const csv = rowsToCsv({
      headers: ["A", "B", "C"],
      rows: [["1", "", "3"]],
    })

    expect(csv).toBe("A,B,C\n1,,3")
  })
})
