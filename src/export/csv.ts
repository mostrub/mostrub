export function escapeCsvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function rowsToCsv(input: {
  headers: string[]
  rows: Array<Array<string | number>>
}): string {
  const lines = [
    input.headers.map(escapeCsvCell).join(","),
    ...input.rows.map((row) => row.map(escapeCsvCell).join(",")),
  ]
  return lines.join("\n")
}
