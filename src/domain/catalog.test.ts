import { describe, expect, it } from "vitest"

import {
  emptyInventory,
  recordDestruction,
  removeLaptop,
  upsertLaptop,
  upsertPrinter,
  upsertSoftware,
} from "./catalog"
import type { DestructionRecord, Laptop, Printer, SoftwareLicense } from "./types"

function laptop(overrides: Partial<Laptop> = {}): Laptop {
  return {
    id: "lap-1",
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
      expect(result.error).toMatch(/asset tag/i)
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
      expect(result.error).toMatch(/already exists/i)
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
    expect(next.laptops).toHaveLength(0)
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

  it("rejects software with more assigned seats than purchased", () => {
    const result = upsertSoftware(
      emptyInventory(),
      software({ seatsAssigned: 12, seatsPurchased: 8 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/assigned seats/i)
    }
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
})
