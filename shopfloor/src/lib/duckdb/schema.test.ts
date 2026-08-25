import { describe, expect, it } from "vitest"

import {
  INSERT_SQL,
  deleteByFileIdsSql,
  insertParquetByName,
  persistExportPath,
} from "./schema"

describe("INSERT_SQL", () => {
  it("binds JSON columns by name so extra or missing fields do not shift", () => {
    for (const sql of Object.values(INSERT_SQL)) {
      expect(sql).toContain("BY NAME")
    }
  })
})

describe("insertParquetByName", () => {
  it("restores only destination columns so extra parquet fields are ignored", () => {
    const sql = insertParquetByName("cycles", "restore-cycles.parquet")
    expect(sql).toContain("INSERT INTO cycles BY NAME SELECT")
    expect(sql).toContain("cycle_id")
    expect(sql).toContain("FROM read_parquet('restore-cycles.parquet')")
    expect(sql).not.toContain("SELECT * FROM")
    expect(sql).not.toContain("file_name")
  })
})

describe("persistExportPath", () => {
  it("uses a distinct parquet path per table", () => {
    expect(persistExportPath("ingest_files")).toBe("persist-ingest_files.parquet")
    expect(persistExportPath("cycles")).toBe("persist-cycles.parquet")
    expect(persistExportPath("cycles")).not.toBe(persistExportPath("ingest_files"))
  })
})

describe("deleteByFileIdsSql", () => {
  it("returns null when there are no file ids", () => {
    expect(deleteByFileIdsSql("cycles", [])).toBeNull()
  })

  it("deletes matching file_id rows and escapes quotes", () => {
    expect(deleteByFileIdsSql("cycles", ["a", "O'Hare"])).toBe(
      "DELETE FROM cycles WHERE file_id IN ('a', 'O''Hare')"
    )
  })
})
