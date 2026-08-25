import { describe, expect, it } from "vitest"

import { hostOperatingSystemLabel, visitorOperatingSystem } from "./lan"

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
