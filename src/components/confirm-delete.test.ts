import { describe, expect, it } from "vitest"

import { deleteConfirmMatches } from "@/lib/delete-confirm"

describe("deleteConfirmMatches", () => {
  it("rejects an empty confirmation even when the field is empty", () => {
    expect(deleteConfirmMatches("", "")).toBe(false)
  })

  it("rejects a click-through without typing the inventory number", () => {
    expect(deleteConfirmMatches("", "INV-0001")).toBe(false)
  })

  it("rejects a partial inventory number", () => {
    expect(deleteConfirmMatches("INV-000", "INV-0001")).toBe(false)
    expect(deleteConfirmMatches("INV-0001", "INV-00010")).toBe(false)
  })

  it("accepts the exact inventory number, ignoring case and surrounding space", () => {
    expect(deleteConfirmMatches("  inv-0001  ", "INV-0001")).toBe(true)
  })
})
