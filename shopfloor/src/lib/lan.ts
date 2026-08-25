export type LanShareInfo = {
  hostname: string
  os: string
  platform: string
  port: number
  urls: string[]
  thisOrigin: string
  visitorOs: string
}

export function visitorOperatingSystem(userAgent: string): string {
  if (userAgent.includes("Windows")) {
    return "Windows"
  }
  if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) {
    return "macOS"
  }
  if (userAgent.includes("CrOS")) {
    return "ChromeOS"
  }
  if (userAgent.includes("Android")) {
    return "Android"
  }
  if (userAgent.includes("Linux")) {
    return "Linux"
  }
  return "this device"
}

export function hostOperatingSystemLabel(platform: string, os: string): string {
  switch (platform) {
    case "win32":
      return "Windows"
    case "darwin":
      return "macOS"
    case "linux":
      return "Linux"
    default: {
      if (os.length > 0) {
        return os
      }
      return "this computer"
    }
  }
}

function fallbackInfo(): LanShareInfo {
  const port = Number(window.location.port)
  return {
    hostname: window.location.hostname,
    os: navigator.userAgent,
    platform: "",
    port: Number.isFinite(port) && port > 0 ? port : 80,
    urls: [`${window.location.origin}/`],
    thisOrigin: window.location.origin,
    visitorOs: visitorOperatingSystem(navigator.userAgent),
  }
}

export async function fetchLanShare(): Promise<LanShareInfo> {
  const visitorOs = visitorOperatingSystem(navigator.userAgent)
  try {
    const response = await fetch("/__floorline/lan")
    if (!response.ok) {
      return { ...fallbackInfo(), visitorOs }
    }
    const data: unknown = await response.json()
    if (
      typeof data !== "object" ||
      data === null ||
      !("urls" in data) ||
      !Array.isArray(data.urls)
    ) {
      return { ...fallbackInfo(), visitorOs }
    }
    const record = data as {
      hostname?: unknown
      os?: unknown
      platform?: unknown
      port?: unknown
      urls: unknown[]
    }
    const urls = record.urls.filter((url): url is string => typeof url === "string")
    return {
      hostname: typeof record.hostname === "string" ? record.hostname : window.location.hostname,
      os: typeof record.os === "string" ? record.os : "",
      platform: typeof record.platform === "string" ? record.platform : "",
      port: typeof record.port === "number" ? record.port : fallbackInfo().port,
      urls: urls.length > 0 ? urls : fallbackInfo().urls,
      thisOrigin: window.location.origin,
      visitorOs,
    }
  } catch {
    return { ...fallbackInfo(), visitorOs }
  }
}
