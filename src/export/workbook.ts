import {
  ASSET_KIND_LABELS,
  DEPARTMENT_LABELS,
  DESTRUCTION_METHOD_LABELS,
  FINDING_LABELS,
  LAPTOP_TYPE_LABELS,
  LICENSE_TYPE_LABELS,
  OS_LABELS,
  PRINTER_TYPE_LABELS,
  STATUS_LABELS,
} from "@/domain/labels"
import type { AuditFinding, InventoryState } from "@/domain/types"

export const AUDIT_SHEET_NAMES = [
  "Cover",
  "Summary",
  "Laptops",
  "Laptops by department",
  "Printers",
  "Software licenses",
  "License exceptions",
  "Destruction log",
  "Audit findings",
] as const

export type WorkbookSheet = {
  name: (typeof AUDIT_SHEET_NAMES)[number]
  headers: string[]
  rows: Array<Array<string | number>>
}

export type WorkbookPlan = {
  sheets: WorkbookSheet[]
}

function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

function countByStatus(items: Array<{ status: string }>, status: string): number {
  return items.filter((item) => item.status === status).length
}

export function buildAuditWorkbookPlan(input: {
  state: InventoryState
  findings: AuditFinding[]
  exportedAt: string
  orgName: string
}): WorkbookPlan {
  const { state, findings, exportedAt, orgName } = input
  const activeLaptops = state.laptops.filter((item) => item.status !== "destroyed")
  const licenseExceptions = state.software.filter(
    (item) => item.seatsAssigned > item.seatsPurchased,
  )

  const departmentRows = Object.entries(DEPARTMENT_LABELS).flatMap(
    ([department, label]) => {
      const laptops = state.laptops.filter((item) => item.department === department)
      if (laptops.length === 0) {
        return []
      }
      return laptops.map((item) => [
        label,
        item.assetTag,
        item.hostname,
        LAPTOP_TYPE_LABELS[item.laptopType],
        OS_LABELS[item.operatingSystem],
        STATUS_LABELS[item.status],
        item.assignedTo,
        item.location,
      ])
    },
  )

  const sheets: WorkbookSheet[] = [
    {
      name: "Cover",
      headers: ["Field", "Value"],
      rows: [
        ["Organization", orgName],
        ["Export", "Consulting audit workbook"],
        ["Exported at", exportedAt],
        ["Laptops", state.laptops.length],
        ["Printers", state.printers.length],
        ["Software titles", state.software.length],
        ["Destruction records", state.destructions.length],
        ["Audit findings", findings.length],
      ],
    },
    {
      name: "Summary",
      headers: ["Register", "In service", "Spare", "Repair", "Lost", "Retired", "Destroyed", "Total"],
      rows: [
        [
          "Laptops",
          countByStatus(state.laptops, "in-service"),
          countByStatus(state.laptops, "spare"),
          countByStatus(state.laptops, "repair"),
          countByStatus(state.laptops, "lost"),
          countByStatus(state.laptops, "retired"),
          countByStatus(state.laptops, "destroyed"),
          state.laptops.length,
        ],
        [
          "Printers",
          countByStatus(state.printers, "in-service"),
          countByStatus(state.printers, "spare"),
          countByStatus(state.printers, "repair"),
          countByStatus(state.printers, "lost"),
          countByStatus(state.printers, "retired"),
          countByStatus(state.printers, "destroyed"),
          state.printers.length,
        ],
        [
          "Active laptops (not destroyed)",
          activeLaptops.filter((item) => item.status === "in-service").length,
          "",
          "",
          "",
          "",
          "",
          activeLaptops.length,
        ],
      ],
    },
    {
      name: "Laptops",
      headers: [
        "Asset tag",
        "Serial",
        "Hostname",
        "Make",
        "Model",
        "Type",
        "Operating system",
        "Department",
        "Assigned to",
        "Location",
        "Status",
        "Purchase date",
        "Warranty end",
        "Notes",
      ],
      rows: state.laptops.map((item) => [
        item.assetTag,
        item.serialNumber,
        item.hostname,
        item.make,
        item.model,
        LAPTOP_TYPE_LABELS[item.laptopType],
        OS_LABELS[item.operatingSystem],
        DEPARTMENT_LABELS[item.department],
        item.assignedTo,
        item.location,
        STATUS_LABELS[item.status],
        item.purchaseDate,
        item.warrantyEnd,
        item.notes,
      ]),
    },
    {
      name: "Laptops by department",
      headers: [
        "Department",
        "Asset tag",
        "Hostname",
        "Type",
        "Operating system",
        "Status",
        "Assigned to",
        "Location",
      ],
      rows: departmentRows,
    },
    {
      name: "Printers",
      headers: [
        "Asset tag",
        "Serial",
        "Make",
        "Model",
        "Type",
        "Department",
        "Location",
        "IP address",
        "Status",
        "Notes",
      ],
      rows: state.printers.map((item) => [
        item.assetTag,
        item.serialNumber,
        item.make,
        item.model,
        PRINTER_TYPE_LABELS[item.printerType],
        DEPARTMENT_LABELS[item.department],
        item.location,
        item.ipAddress,
        STATUS_LABELS[item.status],
        item.notes,
      ]),
    },
    {
      name: "Software licenses",
      headers: [
        "Name",
        "Vendor",
        "Entitlement",
        "License type",
        "Seats purchased",
        "Seats assigned",
        "Department",
        "Renewal date",
        "Annual cost",
        "Notes",
      ],
      rows: state.software.map((item) => [
        item.name,
        item.vendor,
        item.entitlementId,
        LICENSE_TYPE_LABELS[item.licenseType],
        item.seatsPurchased,
        item.seatsAssigned,
        DEPARTMENT_LABELS[item.department],
        item.renewalDate,
        money(item.annualCost),
        item.notes,
      ]),
    },
    {
      name: "License exceptions",
      headers: [
        "Name",
        "Vendor",
        "Seats purchased",
        "Seats assigned",
        "Over by",
        "Department",
      ],
      rows: licenseExceptions.map((item) => [
        item.name,
        item.vendor,
        item.seatsPurchased,
        item.seatsAssigned,
        item.seatsAssigned - item.seatsPurchased,
        DEPARTMENT_LABELS[item.department],
      ]),
    },
    {
      name: "Destruction log",
      headers: [
        "Asset kind",
        "Asset tag",
        "Serial",
        "Department",
        "Method",
        "Destroyed on",
        "Witness",
        "Certificate",
        "Reason",
        "Notes",
      ],
      rows: state.destructions.map((item) => [
        ASSET_KIND_LABELS[item.assetKind],
        item.assetTag,
        item.serialNumber,
        DEPARTMENT_LABELS[item.department],
        DESTRUCTION_METHOD_LABELS[item.method],
        item.destroyedOn,
        item.witnessedBy,
        item.certificateId,
        item.reason,
        item.notes,
      ]),
    },
    {
      name: "Audit findings",
      headers: ["Severity", "Finding", "Register", "Asset / entitlement", "Department", "Summary"],
      rows: findings.map((item) => [
        item.severity,
        FINDING_LABELS[item.code],
        item.register,
        item.assetTag,
        item.department ? DEPARTMENT_LABELS[item.department] : "",
        item.summary,
      ]),
    },
  ]

  return { sheets }
}
