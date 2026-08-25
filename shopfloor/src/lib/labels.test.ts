import { describe, expect, it } from "vitest"

import { columnLabel, tableLabel, valueLabel } from "./labels"

describe("columnLabel", () => {
  it("uses German headers for shopfloor columns", () => {
    expect(columnLabel("sku")).toBe("Artikel")
    expect(columnLabel("started_at")).toBe("Start")
    expect(columnLabel("plc_scan_ms")).toBe("SPS-Scan ms")
    expect(columnLabel("fpy_pct")).toBe("Erstausbeute %")
  })
})

describe("tableLabel", () => {
  it("names tables in German", () => {
    expect(tableLabel("cycles")).toBe("Takte")
    expect(tableLabel("ingest_files")).toBe("Dateien")
    expect(tableLabel("server_samples")).toBe("Serverproben")
  })
})

describe("valueLabel", () => {
  it("translates coded results and states", () => {
    expect(valueLabel("PASS")).toBe("Gut")
    expect(valueLabel("FAIL")).toBe("Ausschuss")
    expect(valueLabel("UNPLANNED")).toBe("Ungeplant")
    expect(valueLabel("STARVE")).toBe("Hunger")
    expect(valueLabel("OPEN")).toBe("Offen")
  })

  it("leaves unknown codes alone", () => {
    expect(valueLabel("CELL-1")).toBe("CELL-1")
  })
})
