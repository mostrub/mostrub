import { collectAuditFindings } from "@/domain/findings"
import {
  ASSET_KIND_LABELS,
  DEPARTMENT_LABELS,
  DESTRUCTION_METHOD_LABELS,
  LICENSE_TYPE_LABELS,
  STATUS_LABELS,
} from "@/domain/labels"
import { countLaptopsByDepartment, summarizeInventory } from "@/domain/summary"
import { ASSET_STATUSES, type InventoryState } from "@/domain/types"
import type { ChartSlice } from "./charts"

export type ReportTable = {
  title: string
  headers: string[]
  rows: Array<Array<string | number>>
}

export type PlantReport = {
  orgName: string
  exportedAt: string
  today: string
  totals: ReturnType<typeof summarizeInventory> & { findings: number }
  laptopsByDepartment: ChartSlice[]
  laptopStatus: ChartSlice[]
  printerStatus: ChartSlice[]
  findings: ReturnType<typeof collectAuditFindings>
  registerSheet: {
    headers: string[]
    rows: Array<Array<string | number>>
  }
  tables: ReportTable[]
}

function statusSeries(
  items: Array<{ status: (typeof ASSET_STATUSES)[number] }>,
): ChartSlice[] {
  return ASSET_STATUSES.flatMap((status) => {
    const value = items.filter((item) => item.status === status).length
    return value === 0 ? [] : [{ label: STATUS_LABELS[status], value }]
  })
}

export function buildPlantReport(
  state: InventoryState,
  options: { orgName: string; exportedAt: string; today: string },
): PlantReport {
  const findings = collectAuditFindings(state, { today: options.today })
  const totals = {
    ...summarizeInventory(state),
    findings: findings.length,
  }

  const registerSheet = {
    headers: [
      "Register",
      "Inv.-Nr.",
      "Kennzeichen",
      "Serie",
      "Bezeichnung",
      "Abteilung",
      "Status",
      "Standort",
    ],
    rows: [
      ...state.laptops.map((item) => [
        "Laptop",
        item.inventoryNumber,
        item.assetTag,
        item.serialNumber,
        item.hostname || `${item.make} ${item.model}`.trim(),
        DEPARTMENT_LABELS[item.department],
        STATUS_LABELS[item.status],
        item.location,
      ]),
      ...state.printers.map((item) => [
        "Drucker",
        item.inventoryNumber,
        item.assetTag,
        item.serialNumber,
        `${item.make} ${item.model}`.trim(),
        DEPARTMENT_LABELS[item.department],
        STATUS_LABELS[item.status],
        item.location,
      ]),
      ...state.software.map((item) => [
        "Software",
        item.inventoryNumber,
        item.entitlementId,
        "",
        item.name,
        DEPARTMENT_LABELS[item.department],
        `${item.seatsAssigned} / ${item.seatsPurchased} Plätze`,
        LICENSE_TYPE_LABELS[item.licenseType],
      ]),
      ...state.destructions.map((item) => [
        "Vernichtung",
        item.inventoryNumber,
        item.assetTag,
        item.serialNumber,
        ASSET_KIND_LABELS[item.assetKind],
        DEPARTMENT_LABELS[item.department],
        DESTRUCTION_METHOD_LABELS[item.method],
        item.destroyedOn,
      ]),
    ],
  }

  return {
    orgName: options.orgName,
    exportedAt: options.exportedAt,
    today: options.today,
    totals,
    laptopsByDepartment: countLaptopsByDepartment(state).map((item) => ({
      label: DEPARTMENT_LABELS[item.department],
      value: item.count,
    })),
    laptopStatus: statusSeries(state.laptops),
    printerStatus: statusSeries(state.printers),
    findings,
    registerSheet,
    tables: [
      {
        title: "Laptops",
        headers: [
          "Inv.-Nr.",
          "Kennzeichen",
          "Serie",
          "Hostname",
          "Abteilung",
          "Zugewiesen",
          "Status",
          "Notizen",
        ],
        rows: state.laptops.map((item) => [
          item.inventoryNumber,
          item.assetTag,
          item.serialNumber,
          item.hostname,
          DEPARTMENT_LABELS[item.department],
          item.assignedTo,
          STATUS_LABELS[item.status],
          item.notes,
        ]),
      },
      {
        title: "Drucker",
        headers: [
          "Inv.-Nr.",
          "Kennzeichen",
          "Serie",
          "Gerät",
          "Abteilung",
          "Standort",
          "Status",
        ],
        rows: state.printers.map((item) => [
          item.inventoryNumber,
          item.assetTag,
          item.serialNumber,
          `${item.make} ${item.model}`.trim(),
          DEPARTMENT_LABELS[item.department],
          item.location,
          STATUS_LABELS[item.status],
        ]),
      },
      {
        title: "Software",
        headers: [
          "Inv.-Nr.",
          "Name",
          "Hersteller",
          "Abteilung",
          "Plätze",
          "Verlängerung",
        ],
        rows: state.software.map((item) => [
          item.inventoryNumber,
          item.name,
          item.vendor,
          DEPARTMENT_LABELS[item.department],
          `${item.seatsAssigned} / ${item.seatsPurchased}`,
          item.renewalDate,
        ]),
      },
      {
        title: "Vernichtung",
        headers: ["Inv.-Nr.", "Kennzeichen", "Art", "Verfahren", "Datum", "Zeuge"],
        rows: state.destructions.map((item) => [
          item.inventoryNumber,
          item.assetTag,
          ASSET_KIND_LABELS[item.assetKind],
          DESTRUCTION_METHOD_LABELS[item.method],
          item.destroyedOn,
          item.witnessedBy,
        ]),
      },
    ],
  }
}
