const ATTR_RE = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const SIMPLE_CHILD_RE =
  /<(?:[\w.-]+:)?([A-Za-z_][\w.-]*)\b[^>]*>([^<]*)<\/(?:[\w.-]+:)?\1\s*>/gi

export function stripXmlBom(xml: string): string {
  return xml.replace(/^\uFEFF/, "")
}

export function localXmlName(name: string): string {
  const sep = name.lastIndexOf(":")
  return sep >= 0 ? name.slice(sep + 1) : name
}

export function isXmlnsName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower === "xmlns" || lower.startsWith("xmlns:")
}

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
  return normalizeAttrNames(out)
}

export function normalizeAttrNames(
  attrs: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (isXmlnsName(key)) {
      continue
    }
    out[localXmlName(key)] = value
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

function escapeTag(tagName: string): string {
  return tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function childAttrs(inner: string): Record<string, string> {
  const out: Record<string, string> = {}
  SIMPLE_CHILD_RE.lastIndex = 0
  let match = SIMPLE_CHILD_RE.exec(inner)
  while (match) {
    const key = match[1]
    const value = decodeXmlText((match[2] ?? "").trim())
    if (key && value !== "") {
      out[key] = value
    }
    match = SIMPLE_CHILD_RE.exec(inner)
  }
  return normalizeAttrNames(out)
}

export function collectElements(
  xml: string,
  tagName: string
): Record<string, string>[] {
  const local = escapeTag(tagName)
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b([^>]*)>`, "gi")
  const closeRe = new RegExp(`<\\/(?:[\\w.-]+:)?${local}\\s*>`, "gi")
  const rows: Record<string, string>[] = []
  let match = re.exec(xml)
  while (match) {
    const open = match[0]
    const fromOpen = parseAttributes(match[1] ?? "")
    if (/\/\s*>$/.test(open)) {
      rows.push(fromOpen)
      match = re.exec(xml)
      continue
    }
    const innerStart = re.lastIndex
    closeRe.lastIndex = innerStart
    const close = closeRe.exec(xml)
    if (!close) {
      rows.push(fromOpen)
      match = re.exec(xml)
      continue
    }
    const fromChildren = childAttrs(xml.slice(innerStart, close.index))
    rows.push({ ...fromChildren, ...fromOpen })
    re.lastIndex = close.index + close[0].length
    match = re.exec(xml)
  }
  return rows
}

export function parseRootAttributes(xml: string): Record<string, string> {
  const match = stripXmlBom(xml).match(
    /<(?:[\w.-]+:)?([A-Za-z_][\w.-]*)\b([^>]*)>/
  )
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

export function elapsedMs(startedAt: string, endedAt: string): number {
  if (startedAt === "" || endedAt === "") {
    return 0
  }
  const start = Date.parse(startedAt)
  const end = Date.parse(endedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0
  }
  return end - start
}
