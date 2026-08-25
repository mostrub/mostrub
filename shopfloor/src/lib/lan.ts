import {
  hostOperatingSystemLabel,
  uniqueOperatingSystems,
  visitorOperatingSystem,
  type NetworkPeer,
} from "@/lib/os-label"

export type { NetworkPeer } from "@/lib/os-label"
export {
  formatPeerLabel,
  hostOperatingSystemLabel,
  parsePresenceOs,
  uniqueOperatingSystems,
  visitorOperatingSystem,
} from "@/lib/os-label"

export type LanShareInfo = {
  hostname: string
  os: string
  platform: string
  port: number
  urls: string[]
  peers: NetworkPeer[]
  thisOrigin: string
  visitorOs: string
}

function fallbackInfo(): LanShareInfo {
  const port = Number(window.location.port)
  const visitorOs = visitorOperatingSystem(navigator.userAgent)
  return {
    hostname: window.location.hostname,
    os: navigator.userAgent,
    platform: "",
    port: Number.isFinite(port) && port > 0 ? port : 80,
    urls: [`${window.location.origin}/`],
    peers: [{ os: visitorOs, ip: window.location.hostname, role: "host" }],
    thisOrigin: window.location.origin,
    visitorOs,
  }
}

function readPeers(value: unknown): NetworkPeer[] {
  if (!Array.isArray(value)) {
    return []
  }
  const peers: NetworkPeer[] = []
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue
    }
    if (!("os" in item) || !("ip" in item) || !("role" in item)) {
      continue
    }
    if (typeof item.os !== "string" || typeof item.ip !== "string") {
      continue
    }
    if (item.role !== "host" && item.role !== "client") {
      continue
    }
    peers.push({ os: item.os, ip: item.ip, role: item.role })
  }
  return peers
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
    const urls = data.urls.filter((url): url is string => typeof url === "string")
    const hostname =
      "hostname" in data && typeof data.hostname === "string"
        ? data.hostname
        : window.location.hostname
    const os = "os" in data && typeof data.os === "string" ? data.os : ""
    const platform =
      "platform" in data && typeof data.platform === "string" ? data.platform : ""
    const port =
      "port" in data && typeof data.port === "number"
        ? data.port
        : fallbackInfo().port
    const peers = "peers" in data ? readPeers(data.peers) : []
    return {
      hostname,
      os,
      platform,
      port,
      urls: urls.length > 0 ? urls : fallbackInfo().urls,
      peers,
      thisOrigin: window.location.origin,
      visitorOs,
    }
  } catch {
    return { ...fallbackInfo(), visitorOs }
  }
}

export async function reportPresence(): Promise<void> {
  try {
    await fetch("/__floorline/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ os: visitorOperatingSystem(navigator.userAgent) }),
    })
  } catch {
    return
  }
}

export function attachShareHash(lanUrl: string, shareUrl: string): string {
  const hashIndex = shareUrl.indexOf("#")
  const hash = hashIndex >= 0 ? shareUrl.slice(hashIndex) : ""
  return `${lanUrl.replace(/\/?#.*$/, "").replace(/\/$/, "")}/${hash}`
}

export function buildJoinMessage(info: LanShareInfo): string {
  const hostOs = hostOperatingSystemLabel(info.platform, info.os)
  const systems = uniqueOperatingSystems(info.peers)
  const systemLine =
    systems.length > 0
      ? `Operating systems on this instance: ${systems.join(", ")}.`
      : "Open from Windows, macOS, or Linux on this LAN."
  return [
    `Floorline on ${info.hostname} (${hostOs})`,
    ...info.urls,
    "",
    systemLine,
    "Data stays on the host PC.",
  ].join("\n")
}
