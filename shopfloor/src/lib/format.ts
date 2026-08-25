export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatMinutes(ms: number): string {
  return `${formatNumber(ms / 60000, 1)} Min`
}

export function formatPct(value: number): string {
  return `${formatNumber(value, 1)} %`
}

export function formatMoney(value: number): string {
  return `${formatNumber(value, 2)} $`
}

export function cellText(value: string | number | boolean | null): string {
  if (value === null) {
    return ""
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? formatNumber(value) : formatNumber(value, 2)
  }
  return String(value)
}
