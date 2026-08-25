import { describe, expect, it } from "vitest"

import {
  emptyInventory,
  recordDestruction,
  removeDestruction,
  removeLaptop,
  removePrinter,
  removeSoftware,
  upsertLaptop,
  upsertPrinter,
  upsertSoftware,
} from "./catalog"
import type { DestructionRecord, Laptop, Printer, SoftwareLicense } from "./types"

function laptop(overrides: Partial<Laptop> = {}): Laptop {
  return {
    id: "lap-1",
    inventoryNumber: "",
    assetTag: "LT-1001",
    serialNumber: "SN-AA11",
    hostname: "ops-lt-01",
    make: "Dell",
    model: "Latitude 5550",
    laptopType: "standard",
    operatingSystem: "windows-11",
    department: "operations",
    assignedTo: "A. Rivera",
    location: "Plant 1 / Ops office",
    status: "in-service",
    purchaseDate: "2024-03-12",
    warrantyEnd: "2027-03-12",
    notes: "",
    ...overrides,
  }
}

function printer(overrides: Partial<Printer> = {}): Printer {
  return {
    id: "prt-1",
    inventoryNumber: "",
    assetTag: "PR-2001",
    serialNumber: "CN12345",
    make: "HP",
    model: "LaserJet M428",
    printerType: "mfp",
    department: "quality",
    location: "QA lab",
    ipAddress: "10.20.8.41",
    status: "in-service",
    notes: "",
    ...overrides,
  }
}

function software(overrides: Partial<SoftwareLicense> = {}): SoftwareLicense {
  return {
    id: "sw-1",
    inventoryNumber: "",
    name: "AutoCAD",
    vendor: "Autodesk",
    entitlementId: "ADS-9981",
    licenseType: "per-seat",
    seatsPurchased: 8,
    seatsAssigned: 6,
    department: "engineering",
    renewalDate: "2026-11-01",
    annualCost: 12600,
    notes: "",
    ...overrides,
  }
}

function destruction(
  overrides: Partial<DestructionRecord> = {},
): DestructionRecord {
  return {
    id: "dst-1",
    assetKind: "laptop",
    assetId: "lap-1",
    inventoryNumber: "",
    assetTag: "LT-1001",
    serialNumber: "SN-AA11",
    department: "operations",
    method: "secure-wipe-recycle",
    destroyedOn: "2026-08-01",
    witnessedBy: "M. Chen",
    certificateId: "COC-2026-014",
    reason: "End of life",
    notes: "",
    ...overrides,
  }
}

describe("catalog", () => {
  it("rejects a laptop without an asset tag", () => {
    const result = upsertLaptop(emptyInventory(), laptop({ assetTag: "  " }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Anlagenkennzeichen/i)
    }
  })

  it("rejects a duplicate laptop asset tag on a different record", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }

    const result = upsertLaptop(
      first.state,
      laptop({ id: "lap-2", serialNumber: "SN-BB22" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/existiert schon/i)
    }
  })

  it("allows updating the same laptop without treating the tag as a duplicate", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }

    const result = upsertLaptop(
      first.state,
      laptop({ hostname: "ops-lt-01b", assignedTo: "J. Patel" }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.laptops).toHaveLength(1)
      expect(result.state.laptops[0]?.hostname).toBe("ops-lt-01b")
    }
  })

  it("removes a laptop by id", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }

    const next = removeLaptop(first.state, "lap-1")
    expect(next.ok).toBe(true)
    if (next.ok) {
      expect(next.state.laptops).toHaveLength(0)
    }
  })

  it("marks a linked laptop destroyed when a destruction is recorded", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }

    const result = recordDestruction(withLaptop.state, destruction())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.destructions).toHaveLength(1)
      expect(result.state.laptops[0]?.status).toBe("destroyed")
    }
  })

  it("allows software with more assigned seats than purchased so audits can record it", () => {
    const result = upsertSoftware(
      emptyInventory(),
      software({ seatsAssigned: 12, seatsPurchased: 8 }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.software[0]?.seatsAssigned).toBe(12)
    }
  })

  it("links a destruction to a laptop when the tag has spaces or different case", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }

    const result = recordDestruction(
      withLaptop.state,
      destruction({
        assetId: "",
        assetTag: "lt-1001 ",
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.destructions[0]?.assetId).toBe("lap-1")
      expect(result.state.laptops[0]?.status).toBe("destroyed")
    }
  })

  it("restores the previous status when the last destruction for an asset is removed", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }

    const withLog = recordDestruction(withLaptop.state, destruction({ assetId: "" }))
    if (!withLog.ok) {
      throw new Error(withLog.error)
    }

    const after = removeDestruction(withLog.state, withLog.state.destructions[0]!.id)
    expect(after.ok).toBe(true)
    if (after.ok) {
      expect(after.state.laptops.find((item) => item.id === "lap-1")?.status).toBe(
        "in-service",
      )
    }
  })

  it("restores the previous asset when a destruction is retargeted", () => {
    const firstLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!firstLaptop.ok) {
      throw new Error(firstLaptop.error)
    }
    const both = upsertLaptop(
      firstLaptop.state,
      laptop({
        id: "lap-2",
        assetTag: "LT-1002",
        serialNumber: "SN-BB22",
      }),
    )
    if (!both.ok) {
      throw new Error(both.error)
    }

    const logged = recordDestruction(both.state, destruction({ assetId: "" }))
    if (!logged.ok) {
      throw new Error(logged.error)
    }

    const retargeted = recordDestruction(logged.state, {
      ...logged.state.destructions[0]!,
      assetTag: "LT-1002",
      inventoryNumber: both.state.laptops.find((item) => item.id === "lap-2")!
        .inventoryNumber,
    })
    expect(retargeted.ok).toBe(true)
    if (retargeted.ok) {
      expect(retargeted.state.laptops.find((item) => item.id === "lap-1")?.status).toBe(
        "in-service",
      )
      expect(retargeted.state.laptops.find((item) => item.id === "lap-2")?.status).toBe(
        "destroyed",
      )
    }
  })

  it("refuses to delete a destroyed laptop while a log still points at it", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }
    const withLog = recordDestruction(withLaptop.state, destruction({ assetId: "" }))
    if (!withLog.ok) {
      throw new Error(withLog.error)
    }

    const result = removeLaptop(withLog.state, "lap-1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Vernichtungseintrag/i)
    }
  })

  it("rejects a duplicate serial on a different laptop", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }

    const result = upsertLaptop(
      first.state,
      laptop({ id: "lap-2", assetTag: "LT-1002" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Seriennummer/i)
    }
  })

  it("rejects non-finite software seat counts", () => {
    const result = upsertSoftware(
      emptyInventory(),
      software({ seatsAssigned: Number.POSITIVE_INFINITY }),
    )
    expect(result.ok).toBe(false)
  })

  it("stores printers and software in separate registers", () => {
    const withPrinter = upsertPrinter(emptyInventory(), printer())
    if (!withPrinter.ok) {
      throw new Error(withPrinter.error)
    }
    const withSoftware = upsertSoftware(withPrinter.state, software())
    if (!withSoftware.ok) {
      throw new Error(withSoftware.error)
    }

    expect(withSoftware.state.printers).toHaveLength(1)
    expect(withSoftware.state.software).toHaveLength(1)
    expect(withSoftware.state.laptops).toHaveLength(0)
  })

  it("assigns a plant-wide inventory number when one is not provided", () => {
    const result = upsertLaptop(emptyInventory(), laptop())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.laptops[0]?.inventoryNumber).toBe("INV-0001")
      expect(result.state.history[0]?.action).toBe("created")
    }
  })

  it("rejects an inventory number already used by a printer", () => {
    const withPrinter = upsertPrinter(
      emptyInventory(),
      printer({ inventoryNumber: "INV-0042" }),
    )
    if (!withPrinter.ok) {
      throw new Error(withPrinter.error)
    }

    const result = upsertLaptop(
      withPrinter.state,
      laptop({ inventoryNumber: "INV-0042" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Inventarnummer/i)
    }
  })

  it("records assignment changes in device history", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }
    const inventoryNumber = first.state.laptops[0]!.inventoryNumber
    const second = upsertLaptop(
      first.state,
      laptop({ inventoryNumber, assignedTo: "B. Jones" }),
    )
    expect(second.ok).toBe(true)
    if (second.ok) {
      const update = second.state.history.find((event) => event.action === "updated")
      expect(update?.changes.some((change) => change.field === "assignedTo")).toBe(
        true,
      )
    }
  })

  it("links a destruction by inventory number", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }
    const inventoryNumber = withLaptop.state.laptops[0]!.inventoryNumber
    const result = recordDestruction(
      withLaptop.state,
      destruction({
        assetId: "",
        assetTag: "",
        inventoryNumber,
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.laptops[0]?.status).toBe("destroyed")
      expect(result.state.destructions[0]?.inventoryNumber).toBe(inventoryNumber)
    }
  })

  it("rejects a destruction whose tag and inventory number point at different assets", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }
    const second = upsertLaptop(
      first.state,
      laptop({
        id: "lap-2",
        assetTag: "LT-1002",
        serialNumber: "SN-BB22",
        hostname: "eng-ws-04",
      }),
    )
    if (!second.ok) {
      throw new Error(second.error)
    }
    const inv2 = second.state.laptops.find((item) => item.id === "lap-2")!.inventoryNumber

    const result = recordDestruction(
      second.state,
      destruction({
        assetId: "",
        assetTag: "LT-1001",
        inventoryNumber: inv2,
      }),
    )
    expect(result.ok).toBe(false)
  })

  it("blocks delete while a destruction log still points at the laptop", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }
    const withLog = recordDestruction(withLaptop.state, destruction({ assetId: "" }))
    if (!withLog.ok) {
      throw new Error(withLog.error)
    }
    const restored = upsertLaptop(withLog.state, {
      ...withLog.state.laptops[0]!,
      status: "in-service",
    })
    expect(restored.ok).toBe(false)
    if (!restored.ok) {
      expect(restored.error).toMatch(/Vernichtung/i)
    }

    const deleted = removeLaptop(withLog.state, "lap-1")
    expect(deleted.ok).toBe(false)
  })

  it("rejects reusing a destruction inventory number on a new laptop", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }
    const withLog = recordDestruction(
      withLaptop.state,
      destruction({
        id: "dst-orphan",
        assetId: "",
        assetKind: "other",
        assetTag: "LT-GONE",
        inventoryNumber: "INV-0090",
        serialNumber: "GONE",
      }),
    )
    if (!withLog.ok) {
      throw new Error(withLog.error)
    }

    const result = upsertLaptop(
      withLog.state,
      laptop({
        id: "lap-new",
        assetTag: "LT-2001",
        serialNumber: "SN-NEW",
        inventoryNumber: "INV-0090",
      }),
    )
    expect(result.ok).toBe(false)
  })

  it("records destruction-removed when a log is retargeted", () => {
    const first = upsertLaptop(emptyInventory(), laptop())
    if (!first.ok) {
      throw new Error(first.error)
    }
    const second = upsertLaptop(
      first.state,
      laptop({
        id: "lap-2",
        assetTag: "LT-1002",
        serialNumber: "SN-BB22",
      }),
    )
    if (!second.ok) {
      throw new Error(second.error)
    }
    const logged = recordDestruction(
      second.state,
      destruction({ assetId: "", assetTag: "LT-1001", inventoryNumber: "" }),
    )
    if (!logged.ok) {
      throw new Error(logged.error)
    }
    const retargeted = recordDestruction(logged.state, {
      ...logged.state.destructions[0]!,
      assetTag: "LT-1002",
      inventoryNumber: "",
    })
    expect(retargeted.ok).toBe(true)
    if (retargeted.ok) {
      expect(
        retargeted.state.history.some(
          (event) =>
            event.action === "destruction-removed" && event.assetTag === "LT-1001",
        ),
      ).toBe(true)
      expect(retargeted.state.laptops.find((item) => item.id === "lap-1")?.status).not.toBe(
        "destroyed",
      )
      expect(retargeted.state.laptops.find((item) => item.id === "lap-2")?.status).toBe(
        "destroyed",
      )
    }
  })

  it("rejects a second destruction for the same live laptop", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }
    const first = recordDestruction(withLaptop.state, destruction({ assetId: "" }))
    if (!first.ok) {
      throw new Error(first.error)
    }

    const second = recordDestruction(
      first.state,
      destruction({ id: "dst-2", assetId: "", inventoryNumber: "" }),
    )
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.error).toMatch(/schon vernichtet/i)
    }
  })

  it("rejects a laptop tag logged as a printer", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }

    const result = recordDestruction(
      withLaptop.state,
      destruction({
        assetId: "",
        assetKind: "printer",
        inventoryNumber: "",
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Laptop/i)
    }
  })

  it("updates a linked destruction inventory number when the laptop is renumbered", () => {
    const withLaptop = upsertLaptop(emptyInventory(), laptop())
    if (!withLaptop.ok) {
      throw new Error(withLaptop.error)
    }
    const withLog = recordDestruction(withLaptop.state, destruction({ assetId: "" }))
    if (!withLog.ok) {
      throw new Error(withLog.error)
    }

    const result = upsertLaptop(withLog.state, {
      ...withLog.state.laptops[0]!,
      inventoryNumber: "INV-7777",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.destructions[0]?.inventoryNumber).toBe("INV-7777")
      expect(result.state.destructions[0]?.assetTag).toBe("LT-1001")
    }
  })

  it("records printer field names in history the same way as laptops", () => {
    const first = upsertPrinter(emptyInventory(), printer())
    if (!first.ok) {
      throw new Error(first.error)
    }
    const second = upsertPrinter(first.state, {
      ...first.state.printers[0]!,
      location: "Warehouse dock",
    })
    expect(second.ok).toBe(true)
    if (second.ok) {
      const update = second.state.history.find((event) => event.action === "updated")
      expect(update?.summary).toMatch(/location/)
      expect(update?.changes.some((change) => change.field === "location")).toBe(true)
    }
  })

  it("removes a printer and a software title", () => {
    const withPrinter = upsertPrinter(emptyInventory(), printer())
    if (!withPrinter.ok) {
      throw new Error(withPrinter.error)
    }
    const withSoftware = upsertSoftware(withPrinter.state, software())
    if (!withSoftware.ok) {
      throw new Error(withSoftware.error)
    }

    const withoutPrinter = removePrinter(withSoftware.state, "prt-1")
    expect(withoutPrinter.ok).toBe(true)
    if (withoutPrinter.ok) {
      expect(withoutPrinter.state.printers).toHaveLength(0)
    }

    const withoutSoftware = removeSoftware(withSoftware.state, "sw-1")
    expect(withoutSoftware.ok).toBe(true)
    if (withoutSoftware.ok) {
      expect(withoutSoftware.state.software).toHaveLength(0)
    }
  })
})
