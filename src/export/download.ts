import { collectAuditFindings } from "@/domain/findings"
import { ORG_NAME } from "@/domain/seed"
import type { InventoryState } from "@/domain/types"
import { rowsToCsv } from "./csv"
import { AUDIT_SHEET_NAMES, buildAuditWorkbookPlan, type WorkbookSheet } from "./workbook"

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function planFor(state: InventoryState) {
  return buildAuditWorkbookPlan({
    state,
    findings: collectAuditFindings(state, { today: todayStamp() }),
    exportedAt: new Date().toISOString(),
    orgName: ORG_NAME,
  })
}

export async function downloadAuditWorkbook(state: InventoryState): Promise<void> {
  const { workbookPlanToBuffer } = await import("./excel")
  const buffer = await workbookPlanToBuffer(planFor(state))
  downloadBlob(
    `plant-it-audit-${stamp()}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
}

export function downloadSheetCsv(sheet: WorkbookSheet): void {
  const csv = rowsToCsv({ headers: sheet.headers, rows: sheet.rows })
  const slug = sheet.name.toLowerCase().replaceAll(" ", "-")
  downloadBlob(
    `plant-it-${slug}-${stamp()}.csv`,
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  )
}

export function downloadRegisterCsv(
  state: InventoryState,
  name: (typeof AUDIT_SHEET_NAMES)[number],
): void {
  const sheet = planFor(state).sheets.find((item) => item.name === name)
  if (!sheet) {
    return
  }
  downloadSheetCsv(sheet)
}

export function downloadAllCsv(state: InventoryState): void {
  for (const sheet of planFor(state).sheets) {
    downloadSheetCsv(sheet)
  }
}

export function downloadBackup(state: InventoryState): void {
  downloadBlob(
    `plant-it-backup-${stamp()}.json`,
    new Blob([JSON.stringify({ version: 1, state }, null, 2)], {
      type: "application/json",
    }),
  )
}
