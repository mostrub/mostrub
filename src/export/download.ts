import { collectAuditFindings } from "@/domain/findings"
import { ORG_NAME } from "@/domain/seed"
import type { InventoryState } from "@/domain/types"
import { localDateStamp } from "@/lib/dates"
import { csvBlob, rowsToCsv } from "./csv"
import { buildPlantReport } from "./report"
import { renderPlantReportHtml } from "./report-html"
import { AUDIT_SHEET_NAMES, buildAuditWorkbookPlan, type WorkbookSheet } from "./workbook"

function planFor(state: InventoryState) {
  return buildAuditWorkbookPlan({
    state,
    findings: collectAuditFindings(state, { today: localDateStamp() }),
    exportedAt: new Date().toISOString(),
    orgName: ORG_NAME,
  })
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}

export async function downloadAuditWorkbook(state: InventoryState): Promise<void> {
  const { workbookPlanToBuffer } = await import("./excel")
  const buffer = await workbookPlanToBuffer(planFor(state))
  downloadBlob(
    `plant-it-audit-${localDateStamp()}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
}

export function downloadSheetCsv(sheet: WorkbookSheet): void {
  const csv = rowsToCsv({ headers: sheet.headers, rows: sheet.rows })
  const slug = sheet.name.toLowerCase().replaceAll(" ", "-")
  downloadBlob(`plant-it-${slug}-${localDateStamp()}.csv`, csvBlob(csv))
}

export function downloadRegisterCsv(
  state: InventoryState,
  name: (typeof AUDIT_SHEET_NAMES)[number],
): void {
  const sheet = planFor(state).sheets.find((item) => item.name === name)
  if (!sheet) {
    throw new Error(`Missing workbook sheet: ${name}`)
  }
  downloadSheetCsv(sheet)
}

export async function downloadCsvPack(state: InventoryState): Promise<void> {
  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  for (const sheet of planFor(state).sheets) {
    const csv = rowsToCsv({ headers: sheet.headers, rows: sheet.rows })
    const slug = sheet.name.toLowerCase().replaceAll(" ", "-")
    zip.file(`plant-it-${slug}.csv`, `\uFEFF${csv}`)
  }
  const blob = await zip.generateAsync({ type: "blob" })
  downloadBlob(`inventory-csv-pack-${localDateStamp()}.zip`, blob)
}

function reportFor(state: InventoryState) {
  return buildPlantReport(state, {
    orgName: ORG_NAME,
    exportedAt: new Date().toISOString(),
    today: localDateStamp(),
  })
}

export function downloadPlantReportHtml(state: InventoryState): void {
  const html = renderPlantReportHtml(reportFor(state))
  downloadBlob(
    `plant-it-bericht-${localDateStamp()}.html`,
    new Blob([html], { type: "text/html;charset=utf-8" }),
  )
}

export function downloadPlantRegisterCsv(state: InventoryState): void {
  const csv = rowsToCsv(reportFor(state).registerSheet)
  downloadBlob(`plant-it-register-${localDateStamp()}.csv`, csvBlob(csv))
}

export function downloadBackup(state: InventoryState): void {
  downloadBlob(
    `plant-it-backup-${localDateStamp()}.json`,
    new Blob([JSON.stringify({ version: 1, state }, null, 2)], {
      type: "application/json",
    }),
  )
}
