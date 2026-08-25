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
  "Device history",
] as const

export type WorkbookSheet = {
  name: (typeof AUDIT_SHEET_NAMES)[number]
  headers: string[]
  rows: Array<Array<string | number>>
}

export type WorkbookPlan = {
  sheets: WorkbookSheet[]
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
      const laptops = state.laptops.filter(
        (item) => item.department === department && item.status !== "destroyed",
      )
      if (laptops.length === 0) {
        return []
      }
      return laptops.map((item) => [
        label,
        item.inventoryNumber,
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
      headers: ["Feld", "Wert"],
      rows: [
        ["Organisation", orgName],
        ["Export", "Prüfmappe"],
        ["Exportiert am", exportedAt],
        ["Laptops", state.laptops.length],
        ["Drucker", state.printers.length],
        ["Softwaretitel", state.software.length],
        ["Vernichtungseinträge", state.destructions.length],
        ["Prüfbefunde", findings.length],
      ],
    },
    {
      name: "Summary",
      headers: ["Register", "Im Einsatz", "Reserve", "Reparatur", "Verloren", "Ausgemustert", "Vernichtet", "Gesamt"],
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
          "Drucker",
          countByStatus(state.printers, "in-service"),
          countByStatus(state.printers, "spare"),
          countByStatus(state.printers, "repair"),
          countByStatus(state.printers, "lost"),
          countByStatus(state.printers, "retired"),
          countByStatus(state.printers, "destroyed"),
          state.printers.length,
        ],
        [
          "Aktive Laptops (nicht vernichtet)",
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
        "Inv.-Nr.",
        "Kennzeichen",
        "Serie",
        "Hostname",
        "Hersteller",
        "Modell",
        "Typ",
        "Betriebssystem",
        "Abteilung",
        "Zugewiesen an",
        "Standort",
        "Status",
        "Kaufdatum",
        "Garantieende",
        "Notizen",
      ],
      rows: state.laptops.map((item) => [
        item.inventoryNumber,
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
        "Abteilung",
        "Inv.-Nr.",
        "Kennzeichen",
        "Hostname",
        "Typ",
        "Betriebssystem",
        "Status",
        "Zugewiesen an",
        "Standort",
      ],
      rows: departmentRows,
    },
    {
      name: "Printers",
      headers: [
        "Inv.-Nr.",
        "Kennzeichen",
        "Serie",
        "Hersteller",
        "Modell",
        "Typ",
        "Abteilung",
        "Standort",
        "IP-Adresse",
        "Status",
        "Notizen",
      ],
      rows: state.printers.map((item) => [
        item.inventoryNumber,
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
        "Inv.-Nr.",
        "Name",
        "Hersteller",
        "Lizenz",
        "Lizenztyp",
        "Gekaufte Plätze",
        "Zugewiesene Plätze",
        "Abteilung",
        "Verlängerung",
        "Jahreskosten",
        "Notizen",
      ],
      rows: state.software.map((item) => [
        item.inventoryNumber,
        item.name,
        item.vendor,
        item.entitlementId,
        LICENSE_TYPE_LABELS[item.licenseType],
        item.seatsPurchased,
        item.seatsAssigned,
        DEPARTMENT_LABELS[item.department],
        item.renewalDate,
        item.annualCost,
        item.notes,
      ]),
    },
    {
      name: "License exceptions",
      headers: [
        "Name",
        "Hersteller",
        "Gekaufte Plätze",
        "Zugewiesene Plätze",
        "Überbelegt um",
        "Abteilung",
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
        "Inv.-Nr.",
        "Geräteart",
        "Kennzeichen",
        "Serie",
        "Abteilung",
        "Verfahren",
        "Vernichtet am",
        "Zeuge",
        "Zertifikat",
        "Grund",
        "Notizen",
      ],
      rows: state.destructions.map((item) => [
        item.inventoryNumber,
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
      headers: ["Schwere", "Befund", "Register", "Gerät / Lizenz", "Abteilung", "Kurztext"],
      rows: findings.map((item) => [
        item.severity,
        FINDING_LABELS[item.code],
        item.register,
        item.assetTag,
        item.department ? DEPARTMENT_LABELS[item.department] : "",
        item.summary,
      ]),
    },
    {
      name: "Device history",
      headers: [
        "Wann",
        "Aktion",
        "Inv.-Nr.",
        "Kennzeichen",
        "Serie",
        "Register",
        "Kurztext",
        "Änderungen",
      ],
      rows: [...state.history]
        .sort((left, right) => right.at.localeCompare(left.at))
        .map((item) => [
          item.at,
          item.action,
          item.inventoryNumber,
          item.assetTag,
          item.serialNumber,
          item.register,
          item.summary,
          item.changes
            .map((change) => `${change.field}: ${change.from} → ${change.to}`)
            .join("; "),
        ]),
    },
  ]

  return { sheets }
}
