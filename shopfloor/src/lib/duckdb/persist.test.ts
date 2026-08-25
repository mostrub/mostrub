import { describe, expect, it } from "vitest"

import { PERSIST_SCHEMA_VERSION, persistSchemaStale } from "./persist"

describe("persist schema version", () => {
  it("treats a missing or older version as stale", () => {
    expect(persistSchemaStale(undefined)).toBe(true)
    expect(persistSchemaStale(1)).toBe(true)
    expect(persistSchemaStale(PERSIST_SCHEMA_VERSION)).toBe(false)
  })
})
