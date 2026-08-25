import { describe, expect, it } from "vitest"

import {
  FLOORLINE_DB_EXT,
  isFloorlineDbName,
  listFloorlineDbNames,
  packFloorlineDb,
  sanitizeDbFileName,
  suggestedDbFileName,
  unpackFloorlineDb,
} from "./share-db"

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe("isFloorlineDbName", () => {
  it("accepts floorline and ddb packs", () => {
    expect(isFloorlineDbName("austin.floorline")).toBe(true)
    expect(isFloorlineDbName("NACHT.DDB")).toBe(true)
    expect(isFloorlineDbName("cycles.parquet")).toBe(false)
    expect(isFloorlineDbName("shift.xml")).toBe(false)
  })
})

describe("sanitizeDbFileName", () => {
  it("keeps a safe name and adds the extension", () => {
    expect(sanitizeDbFileName("AUSTIN Schicht B")).toBe(
      `AUSTIN-Schicht-B${FLOORLINE_DB_EXT}`
    )
    expect(sanitizeDbFileName("foo/bar:.floorline")).toBe(`foo-bar${FLOORLINE_DB_EXT}`)
  })
})

describe("suggestedDbFileName", () => {
  it("uses plant and shift date when present", () => {
    expect(
      suggestedDbFileName({
        plants: ["AUSTIN"],
        shiftDate: "2026-08-25",
      })
    ).toBe(`floorline-AUSTIN-2026-08-25${FLOORLINE_DB_EXT}`)
  })
})

describe("listFloorlineDbNames", () => {
  it("returns only pack files, sorted", () => {
    expect(
      listFloorlineDbNames([
        "readme.txt",
        "nacht.floorline",
        "tag.ddb",
        "cycles.parquet",
      ])
    ).toEqual(["nacht.floorline", "tag.ddb"])
  })
})

describe("packFloorlineDb", () => {
  it("round-trips tables and rejects a bad magic", () => {
    const packed = packFloorlineDb({
      name: "demo",
      savedAt: "2026-08-25T10:00:00.000Z",
      tables: {
        cycles: bytes("PARQUET-CYCLES"),
        downtime: bytes("PARQUET-DT"),
      },
    })
    const loaded = unpackFloorlineDb(packed)
    expect(loaded.manifest.name).toBe("demo")
    expect(loaded.manifest.version).toBe(1)
    expect(new TextDecoder().decode(loaded.tables.cycles)).toBe("PARQUET-CYCLES")
    expect(new TextDecoder().decode(loaded.tables.downtime)).toBe("PARQUET-DT")
    expect(loaded.tables.alarms).toBeUndefined()

    const broken = new Uint8Array(packed)
    broken[0] = 88
    expect(() => unpackFloorlineDb(broken)).toThrow(/Floorline-Stand/)
  })
})
