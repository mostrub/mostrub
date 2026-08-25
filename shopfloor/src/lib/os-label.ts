export type NetworkPeer = {
  os: string
  ip: string
  role: "host" | "client"
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

export function parsePresenceOs(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("os" in data)) {
    return null
  }
  const os = data.os
  if (typeof os !== "string") {
    return null
  }
  const trimmed = os.trim()
  if (trimmed.length === 0 || trimmed.length > 40) {
    return null
  }
  return trimmed
}

export function formatPeerLabel(peer: NetworkPeer): string {
  if (peer.role === "host") {
    return `${peer.os} · host`
  }
  if (peer.ip === "127.0.0.1" || peer.ip === "::1") {
    return `${peer.os} · this machine`
  }
  return `${peer.os} · ${peer.ip}`
}

export function uniqueOperatingSystems(peers: NetworkPeer[]): string[] {
  const seen = new Set<string>()
  for (const peer of peers) {
    if (peer.os.length > 0) {
      seen.add(peer.os)
    }
  }
  return [...seen].sort()
}
