import os from "node:os"

import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin, PreviewServer, ViteDevServer } from "vite"

export type LanInfoPayload = {
  hostname: string
  os: string
  platform: NodeJS.Platform
  port: number
  urls: string[]
}

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

export function lanInfoPayload(port: number): LanInfoPayload {
  return {
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    platform: os.platform(),
    port,
    urls: ipv4Urls(port),
  }
}

function sendLanInfo(
  server: ViteDevServer | PreviewServer,
  res: ServerResponse
): void {
  const address = server.httpServer?.address()
  const port = address && typeof address === "object" ? address.port : 5173
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(lanInfoPayload(port)))
}

function isLanPath(req: IncomingMessage): boolean {
  const path = req.url?.split("?")[0]
  return path === "/__floorline/lan"
}

export function lanInfoPlugin(): Plugin {
  return {
    name: "floorline-lan-info",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isLanPath(req)) {
          next()
          return
        }
        sendLanInfo(server, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isLanPath(req)) {
          next()
          return
        }
        sendLanInfo(server, res)
      })
    },
  }
}
