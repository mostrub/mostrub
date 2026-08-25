import ExcelJS from "exceljs"

import type { WorkbookPlan } from "./workbook"

export async function workbookPlanToBuffer(plan: WorkbookPlan): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Plant IT inventory"
  workbook.created = new Date()

  for (const sheet of plan.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name)
    worksheet.addRow(sheet.headers)
    for (const row of sheet.rows) {
      worksheet.addRow(row)
    }

    const header = worksheet.getRow(1)
    header.font = { bold: true }
    header.commit()

    worksheet.columns.forEach((column, index) => {
      const headerText = String(sheet.headers[index] ?? "")
      const longest = sheet.rows.reduce((max, row) => {
        const cell = String(row[index] ?? "")
        return Math.max(max, cell.length)
      }, headerText.length)
      column.width = Math.min(42, Math.max(12, longest + 2))
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}
