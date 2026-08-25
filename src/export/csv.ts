const FORMULA_PREFIX = /^[=+\-@\t\r]/

function neutralizeCsvValue(text: string): string {
  if (FORMULA_PREFIX.test(text)) {
    return `'${text}`
  }
  return text
}

export function csvEscape(value: string | number): string {
  const text = neutralizeCsvValue(String(value))
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export const escapeCsvCell = csvEscape

export function rowsToCsv(input: {
  headers: string[]
  rows: Array<Array<string | number>>
}): string {
  const lines = [
    input.headers.map(csvEscape).join(","),
    ...input.rows.map((row) => row.map(csvEscape).join(",")),
  ]
  return lines.join("\n")
}

export function csvBlob(csv: string): Blob {
  return new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
}
