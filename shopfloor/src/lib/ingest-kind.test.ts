import { describe, expect, it } from "vitest"

import { classifyIngestName, guessTable, pickIngestFiles } from "./ingest-kind"

describe("classifyIngestName", () => {
  it("maps xml csv and parquet extensions", () => {
    expect(classifyIngestName("shift-a.xml")).toBe("xml")
    expect(classifyIngestName("cycles.CSV")).toBe("csv")
    expect(classifyIngestName("cycles.parquet")).toBe("parquet")
    expect(classifyIngestName("notes.txt")).toBeNull()
  })
})

describe("guessTable", () => {
  it("picks cycles when cycle columns dominate", () => {
    expect(
      guessTable(["cycle_id", "plant", "line", "station", "result", "cycle_ms"])
    ).toBe("cycles")
  })

  it("returns null when overlap is too thin", () => {
    expect(guessTable(["foo", "bar"])).toBeNull()
  })

  it("rejects cycle-like columns that omit cycle_id", () => {
    expect(
      guessTable(["plant", "line", "station", "result", "cycle_ms", "good_qty"])
    ).toBeNull()
  })
})

describe("pickIngestFiles", () => {
  it("keeps only shopfloor ingest kinds", () => {
    const files = [
      new File(["x"], "a.xml"),
      new File(["x"], "b.txt"),
      new File(["x"], "c.parquet"),
    ]
    expect(pickIngestFiles(files).map((file) => file.name)).toEqual([
      "a.xml",
      "c.parquet",
    ])
  })
})
