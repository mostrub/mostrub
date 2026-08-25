import { describe, expect, it } from "vitest"

import { collectAuditFindings } from "@/domain/findings"
import type { InventoryState } from "@/domain/types"
import { AUDIT_SHEET_NAMES, buildAuditWorkbookPlan } from "./workbook"

const sample: InventoryState = {
  laptops: [
    {
      id: "lap-1",
      inventoryNumber: "INV-0001",
      assetTag: "LT-1001",
      serialNumber: "SN-AA11",
      hostname: "ops-lt-01",
      make: "Dell",
      model: "Latitude 5550",
      laptopType: "standard",
      operatingSystem: "windows-11",
      department: "operations",
      assignedTo: "A. Rivera",
      location: "Plant 1",
      status: "in-service",
      purchaseDate: "2024-03-12",
      warrantyEnd: "2027-03-12",
      notes: "",
    },
    {
      id: "lap-2",
      inventoryNumber: "INV-0002",
      assetTag: "LT-1002",
      serialNumber: "",
      hostname: "eng-ws-04",
      make: "Lenovo",
      model: "P16",
      laptopType: "engineering",
      operatingSystem: "windows-11",
      department: "engineering",
      assignedTo: "",
      location: "CAD room",
      status: "in-service",
      purchaseDate: "2022-01-10",
      warrantyEnd: "2024-01-10",
      notes: "Loaner until PO lands",
    },
  ],
  printers: [
    {
      id: "prt-1",
      inventoryNumber: "INV-2001",
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
    },
  ],
  software: [
    {
      id: "sw-1",
      inventoryNumber: "INV-3001",
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
    },
  ],
  destructions: [
    {
      id: "dst-1",
      assetKind: "laptop",
      assetId: "old-1",
      inventoryNumber: "INV-0090",
      assetTag: "LT-0090",
      serialNumber: "SN-OLD",
      department: "it",
      method: "secure-wipe-recycle",
      destroyedOn: "2026-05-14",
      witnessedBy: "M. Chen",
      certificateId: "COC-2026-014",
      reason: "End of life",
      notes: "",
    },
  ],
  history: [],
}

describe("buildAuditWorkbookPlan", () => {
  it("includes every consulting audit tab", () => {
    const plan = buildAuditWorkbookPlan({
      state: sample,
      findings: collectAuditFindings(sample, { today: "2026-08-25" }),
      exportedAt: "2026-08-25T12:00:00.000Z",
      orgName: "Plant IT",
    })

    expect(plan.sheets.map((sheet) => sheet.name)).toEqual(AUDIT_SHEET_NAMES)
  })

  it("puts laptops on their own tab and groups them by department", () => {
    const plan = buildAuditWorkbookPlan({
      state: sample,
      findings: collectAuditFindings(sample, { today: "2026-08-25" }),
      exportedAt: "2026-08-25T12:00:00.000Z",
      orgName: "Plant IT",
    })

    const laptops = plan.sheets.find((sheet) => sheet.name === "Laptops")
    const byDept = plan.sheets.find((sheet) => sheet.name === "Laptops by department")

    expect(laptops?.rows).toHaveLength(2)
    expect(byDept?.rows.some((row) => row.includes("Engineering"))).toBe(true)
    expect(byDept?.rows.some((row) => row.includes("Operations"))).toBe(true)
  })

  it("excludes destroyed laptops from the department tab", () => {
    const withDestroyed: InventoryState = {
      ...sample,
      laptops: [
        ...sample.laptops,
        {
          ...sample.laptops[0]!,
          id: "lap-dead",
          assetTag: "LT-DEAD",
          serialNumber: "SN-DEAD",
          status: "destroyed",
        },
      ],
    }

    const plan = buildAuditWorkbookPlan({
      state: withDestroyed,
      findings: collectAuditFindings(withDestroyed, { today: "2026-08-25" }),
      exportedAt: "2026-08-25T12:00:00.000Z",
      orgName: "Plant IT",
    })

    const byDept = plan.sheets.find((sheet) => sheet.name === "Laptops by department")
    expect(byDept?.rows.some((row) => row.includes("LT-DEAD"))).toBe(false)
    expect(byDept?.rows.some((row) => row.includes("LT-1001"))).toBe(true)
  })

  it("exports annual cost as a number", () => {
    const plan = buildAuditWorkbookPlan({
      state: sample,
      findings: collectAuditFindings(sample, { today: "2026-08-25" }),
      exportedAt: "2026-08-25T12:00:00.000Z",
      orgName: "Plant IT",
    })

    const licenses = plan.sheets.find((sheet) => sheet.name === "Software licenses")
    const cost = licenses?.rows[0]?.[9]
    expect(cost).toBe(12600)
  })

  it("writes audit findings onto a dedicated tab", () => {
    const findings = collectAuditFindings(sample, { today: "2026-08-25" })
    const plan = buildAuditWorkbookPlan({
      state: sample,
      findings,
      exportedAt: "2026-08-25T12:00:00.000Z",
      orgName: "Plant IT",
    })

    const sheet = plan.sheets.find((item) => item.name === "Audit findings")
    expect(sheet?.rows.length).toBe(findings.length)
    expect(findings.length).toBeGreaterThan(0)
  })
})
