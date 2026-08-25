import { describe, expect, it } from "vitest"

import {
  collectElements,
  parseRootAttributes,
  stripXmlBom,
} from "./attrs"

describe("stripXmlBom", () => {
  it("drops a leading BOM and leaves the rest", () => {
    expect(stripXmlBom("\uFEFF<ShopfloorExport/>")).toBe("<ShopfloorExport/>")
  })
})

describe("collectElements", () => {
  it("reads prefixed tags and local attribute names", () => {
    const xml = `<n0:Cycle n0:id="C1" n0:line="CELL-1"/>`
    expect(collectElements(xml, "Cycle")).toEqual([
      { id: "C1", line: "CELL-1" },
    ])
  })

  it("merges simple child text under the same keys", () => {
    const xml = `<Cycle id="C1"><line>MOD-1</line><result>PASS</result></Cycle>`
    expect(collectElements(xml, "Cycle")).toEqual([
      { id: "C1", line: "MOD-1", result: "PASS" },
    ])
  })

  it("lets attributes win over the same child name", () => {
    const xml = `<Cycle line="CELL-1"><line>IGNORED</line></Cycle>`
    expect(collectElements(xml, "Cycle")[0]?.line).toBe("CELL-1")
  })
})

describe("parseRootAttributes", () => {
  it("returns local names from a prefixed root", () => {
    const xml = `<n0:ShopfloorExport n0:plant="AUSTIN" xmlns:n0="urn:x"/>`
    expect(parseRootAttributes(xml).plant).toBe("AUSTIN")
    expect(parseRootAttributes(xml).xmlns).toBeUndefined()
  })
})
