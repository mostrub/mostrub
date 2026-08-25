export function downloadBytes(args: {
  bytes: Uint8Array
  fileName: string
  mime: string
}): void {
  const copy = new Uint8Array(args.bytes.byteLength)
  copy.set(args.bytes)
  const blob = new Blob([copy], { type: args.mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = args.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadText(args: {
  text: string
  fileName: string
  mime: string
}): void {
  const blob = new Blob([args.text], { type: args.mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = args.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
