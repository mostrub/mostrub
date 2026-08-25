import { describe, expect, it } from "vitest"

import { buildJoinMessage, type LanShareInfo } from "./lan"

describe("buildJoinMessage", () => {
  it("names the host OS and the systems already on the instance", () => {
    const info: LanShareInfo = {
      hostname: "AUS-LINE-PC",
      os: "Windows_NT 10.0",
      platform: "win32",
      port: 5173,
      urls: ["http://192.168.1.20:5173/"],
      peers: [
        { os: "Windows", ip: "host", role: "host" },
        { os: "macOS", ip: "192.168.1.44", role: "client" },
      ],
      thisOrigin: "http://192.168.1.20:5173",
      visitorOs: "Windows",
    }
    const message = buildJoinMessage(info)
    expect(message).toContain("Floorline on AUS-LINE-PC (Windows)")
    expect(message).toContain("http://192.168.1.20:5173/")
    expect(message).toContain("Operating systems on this instance: Windows, macOS.")
  })
})
