export function historyHref(query: string): string {
  return `/history?q=${encodeURIComponent(query)}`
}

export function destructionHref(item: {
  kind: "laptop" | "printer"
  inventoryNumber: string
  assetTag: string
  serialNumber: string
  department: string
}): string {
  const params = new URLSearchParams({
    kind: item.kind,
    inv: item.inventoryNumber,
    tag: item.assetTag,
    serial: item.serialNumber,
    dept: item.department,
  })
  return `/destruction?${params.toString()}`
}

export function recordLabel(inventoryNumber: string, fallback: string): string {
  return inventoryNumber ? `${inventoryNumber} (${fallback})` : fallback
}
