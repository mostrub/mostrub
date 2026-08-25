import { describe, expect, it } from "vitest"

import {
  INSERT_SQL,
  deleteByFileIdsSql,
  insertParquetByName,
} from "./schema"

describe("INSERT_SQL", () => {
  it("binds JSON columns by name so extra or missing fields do not shift", () => {
    for (const sql of Object.values(INSERT_SQL)) {
      expect(sql).toContain("BY NAME")
    }
  })
})

describe("insertParquetByName", () => {
  it("restores a table by column name", () => {
    expect(insertParquetByName("cycles", "restore-cycles.parquet")).toBe(
      "INSERT INTO cycles BY NAME SELECT * FROM read_parquet('restore-cycles.parquet')"
    )
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
