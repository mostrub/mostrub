import os from "node:os"

import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin, PreviewServer, ViteDevServer } from "vite"

import {
  hostOperatingSystemLabel,
  parsePresenceOs,
  type NetworkPeer,
} from "./src/lib/os-label.ts"

export type LanInfoPayload = {
  hostname: string
  os: string
  platform: NodeJS.Platform
  port: number
  urls: string[]
  peers: NetworkPeer[]
}

type RememberedPeer = {
  os: string
  ip: string
  lastSeen: number
}

const STALE_MS = 90_000
const peers = new Map<string, RememberedPeer>()

function ipv4Urls(port: number): string[] {
  const urls: string[] = []
  for (const addrs of Object.values(os.networkInterfaces())) {
    if (!addrs) {
      continue
    }
    for (const addr of addrs) {
      if (addr.internal) {
        continue
      }
      const family = String(addr.family)
      if (family !== "IPv4" && family !== "4") {
        continue
      }
      urls.push(`http://${addr.address}:${port}/`)
    }
  }
  urls.sort()
  return urls
}

function clientIp(req: IncomingMessage): string {
  return (req.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "")
}

function rememberPeer(ip: string, osLabel: string): void {
  peers.set(`${ip}|${osLabel}`, {
    ip,
    os: osLabel,
    lastSeen: Date.now(),
  })
}

function liveClients(): NetworkPeer[] {
  const now = Date.now()
  for (const [key, peer] of peers) {
    if (now - peer.lastSeen > STALE_MS) {
      peers.delete(key)
    }
  }
  return [...peers.values()]
    .sort((a, b) => a.os.localeCompare(b.os) || a.ip.localeCompare(b.ip))
    .map((peer) => ({
      os: peer.os,
      ip: peer.ip,
      role: "client" as const,
    }))
}

export function lanInfoPayload(port: number): LanInfoPayload {
  const hostname = os.hostname()
  const platform = os.platform()
  const osLabel = `${os.type()} ${os.release()}`
  const hostPeer: NetworkPeer = {
    os: hostOperatingSystemLabel(platform, osLabel),
    ip: hostname,
    role: "host",
  }
  return {
    hostname,
    os: osLabel,
    platform,
    port,
    urls: ipv4Urls(port),
    peers: [hostPeer, ...liveClients()],
  }
}

function sendJson(res: ServerResponse, body: unknown, status = 200): void {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

function sendLanInfo(
  server: ViteDevServer | PreviewServer,
  res: ServerResponse
): void {
  const address = server.httpServer?.address()
  const port = address && typeof address === "object" ? address.port : 5173
  sendJson(res, lanInfoPayload(port))
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      } catch {
        reject(new Error("invalid json"))
      }
    })
    req.on("error", reject)
  })
}

function requestPath(req: IncomingMessage): string {
  return req.url?.split("?")[0] ?? ""
}

function attachLanRoutes(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    const path = requestPath(req)
    if (path === "/__floorline/lan" && req.method === "GET") {
      sendLanInfo(server, res)
      return
    }
    if (path === "/__floorline/presence" && req.method === "POST") {
      void readJson(req)
        .then((body) => {
          const osLabel = parsePresenceOs(body)
          if (!osLabel) {
            sendJson(res, { ok: false }, 400)
            return
          }
          rememberPeer(clientIp(req), osLabel)
          sendJson(res, { ok: true })
        })
        .catch(() => {
          sendJson(res, { ok: false }, 400)
        })
      return
    }
    next()
  })
}

export function lanInfoPlugin(): Plugin {
  return {
    name: "floorline-lan-info",
    configureServer(server) {
      attachLanRoutes(server)
    },
    configurePreviewServer(server) {
      attachLanRoutes(server)
    },
  }
}
