const ATTR_RE = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

export function parseAttributes(attrBlock: string): Record<string, string> {
  const out: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let match = ATTR_RE.exec(attrBlock)
  while (match) {
    const key = match[1]
    const value = match[2] ?? match[3] ?? ""
    if (key) {
      out[key] = value
    }
    match = ATTR_RE.exec(attrBlock)
  }
  return out
}

export function attr(
  attrs: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    if (key in attrs && attrs[key] !== undefined) {
      return attrs[key]
    }
    const lower = key.toLowerCase()
    for (const [actual, value] of Object.entries(attrs)) {
      if (actual.toLowerCase() === lower) {
        return value
      }
    }
  }
  return ""
}

export function attrInt(
  attrs: Record<string, string>,
  fallback: number,
  ...keys: string[]
): number {
  const raw = attr(attrs, ...keys)
  if (raw === "") {
    return fallback
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function attrFloat(
  attrs: Record<string, string>,
  fallback: number,
  ...keys: string[]
): number {
  const raw = attr(attrs, ...keys)
  if (raw === "") {
    return fallback
  }
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function collectElements(
  xml: string,
  tagName: string
): Record<string, string>[] {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`<${escaped}\\b([^>]*)\\/?>`, "gi")
  const rows: Record<string, string>[] = []
  let match = re.exec(xml)
  while (match) {
    rows.push(parseAttributes(match[1] ?? ""))
    match = re.exec(xml)
  }
  return rows
}

export function parseRootAttributes(xml: string): Record<string, string> {
  const match = xml.match(/<([A-Za-z_:][\w:.-]*)\b([^>]*)>/)
  if (!match) {
    return {}
  }
  return parseAttributes(match[2] ?? "")
}

export function fnv1a(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}
