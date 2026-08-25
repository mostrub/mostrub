import { describe, expect, it } from "vitest"

import { collectAuditFindings } from "./findings"
import type { InventoryState, Laptop, SoftwareLicense } from "./types"

function inventory(overrides: Partial<InventoryState> = {}): InventoryState {
  return {
    laptops: [],
    printers: [],
    software: [],
    destructions: [],
    history: [],
    ...overrides,
  }
}

describe("collectAuditFindings", () => {
  it("flags an in-service laptop with no assignee", () => {
    const laptop: Laptop = {
      id: "lap-1",
      inventoryNumber: "INV-0001",
      assetTag: "LT-1",
      serialNumber: "SN-1",
      hostname: "eng-01",
      make: "Lenovo",
      model: "T14",
      laptopType: "engineering",
      operatingSystem: "windows-11",
      department: "engineering",
      assignedTo: "",
      location: "Bldg A",
      status: "in-service",
      purchaseDate: "2024-01-01",
      warrantyEnd: "2028-01-01",
      notes: "",
    }

    const findings = collectAuditFindings(inventory({ laptops: [laptop] }), {
      today: "2026-08-25",
    })

    expect(findings.some((finding) => finding.code === "unassigned-in-service")).toBe(
      true,
    )
  })

  it("flags a missing serial number", () => {
    const laptop: Laptop = {
      id: "lap-2",
      inventoryNumber: "INV-0002",
      assetTag: "LT-2",
      serialNumber: "",
      hostname: "maint-02",
      make: "Dell",
      model: "5420",
      laptopType: "field-rugged",
      operatingSystem: "windows-10",
      department: "maintenance",
      assignedTo: "K. Ng",
      location: "Shop",
      status: "in-service",
      purchaseDate: "2023-06-01",
      warrantyEnd: "2026-06-01",
      notes: "",
    }

    const findings = collectAuditFindings(inventory({ laptops: [laptop] }), {
      today: "2026-08-25",
    })

    expect(findings.some((finding) => finding.code === "missing-serial")).toBe(true)
  })

  it("flags an expired warranty", () => {
    const laptop: Laptop = {
      id: "lap-3",
      inventoryNumber: "INV-0003",
      assetTag: "LT-3",
      serialNumber: "SN-3",
      hostname: "fin-03",
      make: "HP",
      model: "EliteBook",
      laptopType: "standard",
      operatingSystem: "windows-11",
      department: "finance",
      assignedTo: "R. Cole",
      location: "Admin",
      status: "in-service",
      purchaseDate: "2021-01-01",
      warrantyEnd: "2024-01-01",
      notes: "",
    }

    const findings = collectAuditFindings(inventory({ laptops: [laptop] }), {
      today: "2026-08-25",
    })

    expect(findings.some((finding) => finding.code === "expired-warranty")).toBe(
      true,
    )
  })

  it("flags an expired license as license-expired", () => {
    const license: SoftwareLicense = {
      id: "sw-expired",
      inventoryNumber: "INV-0099",
      name: "Historian",
      vendor: "AVEVA",
      entitlementId: "AV-OLD",
      licenseType: "subscription",
      seatsPurchased: 2,
      seatsAssigned: 1,
      department: "ot-controls",
      renewalDate: "2020-01-01",
      annualCost: 18000,
      notes: "",
    }

    const findings = collectAuditFindings(inventory({ software: [license] }), {
      today: "2026-08-25",
    })

    expect(findings.some((finding) => finding.code === "license-expired")).toBe(
      true,
    )
  })

  it("flags a license renewing within 30 days", () => {
    const license: SoftwareLicense = {
      id: "sw-1",
      inventoryNumber: "INV-0100",
      name: "Historian",
      vendor: "AVEVA",
      entitlementId: "AV-1",
      licenseType: "subscription",
      seatsPurchased: 2,
      seatsAssigned: 2,
      department: "ot-controls",
      renewalDate: "2026-09-10",
      annualCost: 18000,
      notes: "",
    }

    const findings = collectAuditFindings(inventory({ software: [license] }), {
      today: "2026-08-25",
    })

    expect(findings.some((finding) => finding.code === "license-expiring")).toBe(
      true,
    )
  })

  it("flags destruction recorded without a witness", () => {
    const findings = collectAuditFindings(
      inventory({
        destructions: [
          {
            id: "dst-1",
            assetKind: "printer",
            assetId: "",
            inventoryNumber: "INV-0090",
            assetTag: "PR-9",
            serialNumber: "CN9",
            department: "warehouse",
            method: "physical-shred",
            destroyedOn: "2026-07-01",
            witnessedBy: "",
            certificateId: "",
            reason: "Broken",
            notes: "",
          },
        ],
      }),
      { today: "2026-08-25" },
    )

    expect(findings.some((finding) => finding.code === "destroy-without-witness")).toBe(
      true,
    )
  })
})
