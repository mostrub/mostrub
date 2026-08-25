import { describe, expect, it } from "vitest"

import type { InventoryState } from "@/domain/types"
import { buildPlantReport } from "./report"
import { renderBarChartSvg, renderDonutChartSvg } from "./charts"
import { renderPlantReportHtml } from "./report-html"
import { rowsToCsv } from "./csv"

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
      serialNumber: "SN-BB22",
      hostname: "eng-ws-04",
      make: "Lenovo",
      model: "P16",
      laptopType: "engineering",
      operatingSystem: "windows-11",
      department: "engineering",
      assignedTo: "J. Patel",
      location: "CAD",
      status: "repair",
      purchaseDate: "2022-01-10",
      warrantyEnd: "2024-01-10",
      notes: "<script>alert(1)</script>",
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
      seatsAssigned: 10,
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
      reason: "EOL",
      notes: "",
    },
  ],
  history: [],
}

describe("buildPlantReport", () => {
  it("counts every register and builds chart series", () => {
    const report = buildPlantReport(sample, {
      orgName: "Plant IT",
      exportedAt: "2026-08-25T12:00:00.000Z",
      today: "2026-08-25",
    })

    expect(report.totals.laptops).toBe(2)
    expect(report.totals.printers).toBe(1)
    expect(report.totals.software).toBe(1)
    expect(report.totals.destructions).toBe(1)
    expect(report.findings.length).toBeGreaterThan(0)
    expect(report.laptopsByDepartment.map((item) => item.label)).toEqual([
      "Betrieb",
      "Konstruktion",
    ])
    expect(report.laptopStatus.map((item) => item.value)).toEqual(
      expect.arrayContaining([1]),
    )
  })

  it("flattens the plant into one CSV table", () => {
    const report = buildPlantReport(sample, {
      orgName: "Plant IT",
      exportedAt: "2026-08-25T12:00:00.000Z",
      today: "2026-08-25",
    })
    const csv = rowsToCsv(report.registerSheet)
    const lines = csv.split("\r\n")
    expect(lines[0]).toBe(
      "Register;Inv.-Nr.;Kennzeichen;Serie;Bezeichnung;Abteilung;Status;Standort",
    )
    expect(lines).toHaveLength(6)
    expect(csv).toContain("Laptop;INV-0001;LT-1001")
    expect(csv).toContain("Drucker;INV-2001;PR-2001")
    expect(csv).toContain("Software;INV-3001")
    expect(csv).toContain("Vernichtung;INV-0090")
  })
})

describe("report charts", () => {
  it("draws a bar for each department", () => {
    const svg = renderBarChartSvg([
      { label: "Betrieb", value: 3 },
      { label: "IT", value: 1 },
    ])
    expect(svg).toContain("<svg")
    expect(svg.match(/<rect/g)?.length).toBe(2)
    expect(svg).toContain("Betrieb")
  })

  it("draws a donut slice per status with a count", () => {
    const svg = renderDonutChartSvg([
      { label: "Im Einsatz", value: 4 },
      { label: "Reparatur", value: 1 },
    ])
    expect(svg).toContain("<svg")
    expect(svg).toContain("Im Einsatz")
    expect(svg).toContain("4")
  })
})

describe("renderPlantReportHtml", () => {
  it("writes a printable German report and escapes notes", () => {
    const report = buildPlantReport(sample, {
      orgName: "Plant IT",
      exportedAt: "2026-08-25T12:00:00.000Z",
      today: "2026-08-25",
    })
    const html = renderPlantReportHtml(report)
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("Werksbericht")
    expect(html).toContain("@media print")
    expect(html).toContain("Als PDF speichern")
    expect(html).toContain("<svg")
    expect(html).toContain("INV-0001")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  })
})
