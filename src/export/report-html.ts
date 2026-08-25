import { FINDING_LABELS } from "@/domain/labels"
import { renderBarChartSvg, renderDonutChartSvg } from "./charts"
import type { PlantReport, ReportTable } from "./report"

export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function cells(values: Array<string | number>): string {
  return values.map((value) => `<td>${escapeHtml(value || "—")}</td>`).join("")
}

function table(block: ReportTable): string {
  if (block.rows.length === 0) {
    return `<section class="block"><h2>${escapeHtml(block.title)}</h2><p class="muted">Keine Einträge.</p></section>`
  }
  return `<section class="block">
    <h2>${escapeHtml(block.title)}</h2>
    <table>
      <thead><tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${block.rows.map((row) => `<tr>${cells(row)}</tr>`).join("")}</tbody>
    </table>
  </section>`
}

export function renderPlantReportHtml(report: PlantReport): string {
  const findingRows =
    report.findings.length === 0
      ? `<p class="muted">Keine offenen Befunde.</p>`
      : `<table>
          <thead><tr><th>Schwere</th><th>Befund</th><th>Inv.-Nr.</th><th>Gerät</th><th>Kurztext</th></tr></thead>
          <tbody>${report.findings
            .map(
              (item) =>
                `<tr>${cells([
                  item.severity === "high" ? "Hoch" : "Mittel",
                  FINDING_LABELS[item.code],
                  item.inventoryNumber,
                  item.assetTag,
                  item.summary,
                ])}</tr>`,
            )
            .join("")}</tbody>
        </table>`

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Werksbericht — ${escapeHtml(report.orgName)}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font: 13px/1.45 "Segoe UI", Helvetica, Arial, sans-serif; color: #171717; background: #fff; }
    header { padding: 28px 32px 16px; border-bottom: 3px solid #171717; }
    header p { margin: 0; color: #525252; }
    h1 { margin: 4px 0 0; font-size: 26px; letter-spacing: -0.03em; }
    main { padding: 20px 32px 48px; }
    .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 0 0 22px; }
    .kpi { border: 1px solid #d4d4d4; padding: 10px 12px; }
    .kpi strong { display: block; font-size: 22px; }
    .kpi span { color: #525252; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .chart { border: 1px solid #d4d4d4; padding: 12px; }
    .chart h2, .block h2 { margin: 0 0 10px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5e5e5; text-align: left; padding: 6px 8px; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #525252; }
    .block { margin: 22px 0; break-inside: avoid; }
    .muted { color: #737373; }
    .toolbar { margin: 14px 0 0; }
    button { font: inherit; border: 1px solid #171717; background: #171717; color: #fff; padding: 6px 12px; cursor: pointer; }
    @media print {
      .toolbar { display: none; }
      header, .block, .chart { break-inside: avoid; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header>
    <p>${escapeHtml(report.orgName)} · Stichtag ${escapeHtml(report.today)}</p>
    <h1>Werksbericht</h1>
    <p>Exportiert ${escapeHtml(report.exportedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC"))}. Im Browser: Drucken → Als PDF speichern.</p>
    <p class="toolbar"><button type="button" onclick="window.print()">Drucken / Als PDF speichern</button></p>
  </header>
  <main>
    <section class="kpis">
      <div class="kpi"><span>Laptops</span><strong>${report.totals.laptops}</strong></div>
      <div class="kpi"><span>Drucker</span><strong>${report.totals.printers}</strong></div>
      <div class="kpi"><span>Software</span><strong>${report.totals.software}</strong></div>
      <div class="kpi"><span>Vernichtung</span><strong>${report.totals.destructions}</strong></div>
      <div class="kpi"><span>Befunde</span><strong>${report.totals.findings}</strong></div>
    </section>
    <section class="charts">
      <div class="chart">
        <h2>Laptops nach Abteilung</h2>
        ${renderBarChartSvg(report.laptopsByDepartment)}
      </div>
      <div class="chart">
        <h2>Laptop-Status</h2>
        ${renderDonutChartSvg(report.laptopStatus)}
      </div>
    </section>
    <section class="block">
      <h2>Offene Befunde</h2>
      ${findingRows}
    </section>
    ${report.tables.map(table).join("")}
    <section class="block">
      <h2>Drucker-Status</h2>
      ${renderDonutChartSvg(report.printerStatus)}
      <p class="muted">Lizenzplätze belegt: ${report.totals.seatsAssigned}.</p>
    </section>
  </main>
</body>
</html>`
}
