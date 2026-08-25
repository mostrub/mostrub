import { describe, expect, it } from "vitest"

import { csvEscape, rowsToCsv } from "./csv"

describe("csvEscape", () => {
  it("prefixes a leading equals sign so spreadsheets do not execute formulas", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1")
  })

  it("prefixes plus, minus, at, tab, and carriage return", () => {
    expect(csvEscape("+cmd")).toBe("'+cmd")
    expect(csvEscape("-1")).toBe("'-1")
    expect(csvEscape("@sum")).toBe("'@sum")
    expect(csvEscape("\tcmd")).toBe("'\tcmd")
    expect(csvEscape("\rcmd")).toBe("\"'\rcmd\"")
  })
})

describe("rowsToCsv", () => {
  it("quotes commas and doubles embedded quotes", () => {
    const csv = rowsToCsv({
      headers: ["Asset tag", "Notes"],
      rows: [["LT-1", 'Needs "dock", then wipe']],
    })

    expect(csv).toBe('Asset tag;Notes\r\nLT-1;"Needs ""dock"", then wipe"')
  })

  it("quotes cells that contain the semicolon delimiter", () => {
    const csv = rowsToCsv({
      headers: ["Kennzeichen", "Notizen"],
      rows: [["LT-1", "NIST 800-88; Recycler"]],
    })

    expect(csv).toBe('Kennzeichen;Notizen\r\nLT-1;"NIST 800-88; Recycler"')
  })

  it("preserves empty cells", () => {
    const csv = rowsToCsv({
      headers: ["A", "B", "C"],
      rows: [["1", "", "3"]],
    })

    expect(csv).toBe("A;B;C\r\n1;;3")
  })
})
