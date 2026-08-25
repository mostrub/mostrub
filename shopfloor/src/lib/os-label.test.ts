import { describe, expect, it } from "vitest"

import {
  formatPeerLabel,
  hostOperatingSystemLabel,
  parsePresenceOs,
  uniqueOperatingSystems,
  visitorOperatingSystem,
} from "./os-label"

describe("visitorOperatingSystem", () => {
  it("classifies common shopfloor clients", () => {
    expect(visitorOperatingSystem("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "Windows"
    )
    expect(
      visitorOperatingSystem("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    ).toBe("macOS")
    expect(visitorOperatingSystem("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux")
  })
})

describe("hostOperatingSystemLabel", () => {
  it("maps node platforms", () => {
    expect(hostOperatingSystemLabel("win32", "Windows_NT 10.0")).toBe("Windows")
    expect(hostOperatingSystemLabel("darwin", "Darwin 24.0")).toBe("macOS")
    expect(hostOperatingSystemLabel("linux", "Linux 6.12")).toBe("Linux")
  })
})

describe("parsePresenceOs", () => {
  it("accepts a short os label", () => {
    expect(parsePresenceOs({ os: "Windows" })).toBe("Windows")
    expect(parsePresenceOs({ os: "  macOS  " })).toBe("macOS")
  })

  it("rejects empty or huge payloads", () => {
    expect(parsePresenceOs({})).toBeNull()
    expect(parsePresenceOs({ os: "" })).toBeNull()
    expect(parsePresenceOs({ os: "x".repeat(41) })).toBeNull()
  })
})

describe("peer labels", () => {
  it("formats host, loopback, and LAN clients", () => {
    expect(formatPeerLabel({ os: "Windows", ip: "host", role: "host" })).toBe(
      "Windows · host"
    )
    expect(formatPeerLabel({ os: "macOS", ip: "127.0.0.1", role: "client" })).toBe(
      "macOS · this machine"
    )
    expect(formatPeerLabel({ os: "Linux", ip: "192.168.1.20", role: "client" })).toBe(
      "Linux · 192.168.1.20"
    )
  })

  it("lists unique operating systems", () => {
    expect(
      uniqueOperatingSystems([
        { os: "Windows", ip: "host", role: "host" },
        { os: "Windows", ip: "10.0.0.8", role: "client" },
        { os: "macOS", ip: "10.0.0.9", role: "client" },
      ])
    ).toEqual(["Windows", "macOS"])
  })
})
