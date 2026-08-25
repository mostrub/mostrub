export type ChartSlice = {
  label: string
  value: number
}

const BAR_COLORS = ["#1a1a1a", "#3f3f3f", "#6b6b6b", "#8f8f8f"]
const DONUT_COLORS = ["#1a1a1a", "#d97706", "#b91c1c", "#6b6b6b", "#a3a3a3", "#404040"]

export function renderBarChartSvg(slices: ChartSlice[]): string {
  const rows = slices.filter((item) => item.value > 0)
  if (rows.length === 0) {
    return emptySvg("Keine Daten")
  }

  const max = Math.max(...rows.map((item) => item.value))
  const rowHeight = 28
  const labelWidth = 150
  const chartWidth = 420
  const height = rows.length * rowHeight + 8

  const bars = rows
    .map((item, index) => {
      const width = Math.max(4, Math.round((item.value / max) * chartWidth))
      const y = index * rowHeight + 4
      const color = BAR_COLORS[index % BAR_COLORS.length]
      return [
        `<text x="0" y="${y + 16}" fill="#222" font-size="12">${escapeSvg(item.label)}</text>`,
        `<rect x="${labelWidth}" y="${y}" width="${width}" height="18" fill="${color}" />`,
        `<text x="${labelWidth + width + 8}" y="${y + 14}" fill="#222" font-size="12">${item.value}</text>`,
      ].join("")
    })
    .join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" width="640" height="${height}" role="img">${bars}</svg>`
}

export function renderDonutChartSvg(slices: ChartSlice[]): string {
  const rows = slices.filter((item) => item.value > 0)
  const total = rows.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) {
    return emptySvg("Keine Daten")
  }

  const cx = 90
  const cy = 90
  const radius = 58
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const rings = rows
    .map((item, index) => {
      const length = (item.value / total) * circumference
      const color = DONUT_COLORS[index % DONUT_COLORS.length]
      const circle = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="22" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`
      offset += length
      return circle
    })
    .join("")

  const legend = rows
    .map((item, index) => {
      const y = 28 + index * 22
      const color = DONUT_COLORS[index % DONUT_COLORS.length]
      return [
        `<rect x="200" y="${y - 10}" width="10" height="10" fill="${color}" />`,
        `<text x="218" y="${y}" fill="#222" font-size="12">${escapeSvg(item.label)} · ${item.value}</text>`,
      ].join("")
    })
    .join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 180" width="420" height="180" role="img">${rings}<circle cx="${cx}" cy="${cy}" r="36" fill="#fff" /><text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#111" font-size="16" font-weight="600">${total}</text>${legend}</svg>`
}

function emptySvg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 80" width="420" height="80" role="img"><text x="12" y="44" fill="#666" font-size="13">${escapeSvg(label)}</text></svg>`
}

function escapeSvg(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
