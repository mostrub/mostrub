import { afterEach, describe, expect, it } from "vitest"

import { emptyInventory } from "@/domain/catalog"
import {
  STORAGE_KEY,
  isInventoryState,
  loadInventory,
  parseInventoryJson,
  saveInventory,
} from "./storage"

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => {
      map.clear()
    },
    key: () => null,
    get length() {
      return map.size
    },
  } satisfies Storage
}

describe("parseInventoryJson", () => {
  it("rejects a backup whose laptop rows are empty objects", () => {
    const raw = JSON.stringify({
      generatedAt: "x",
      laptops: [{}],
      printers: [],
      software: [],
      destructions: [],
    })
    expect(parseInventoryJson(raw).ok).toBe(false)
  })

  it("accepts a valid empty inventory", () => {
    const raw = JSON.stringify({
      generatedAt: new Date().toISOString(),
      laptops: [],
      printers: [],
      software: [],
      destructions: [],
    })
    const result = parseInventoryJson(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state).toEqual(emptyInventory())
    }
  })

  it("accepts the versioned backup wrapper", () => {
    const raw = JSON.stringify({ version: 1, state: emptyInventory() })
    expect(parseInventoryJson(raw).ok).toBe(true)
  })

  it("assigns inventory numbers to older backups that lack them", () => {
    const raw = JSON.stringify({
      laptops: [
        {
          id: "lap-1",
          assetTag: "LT-1",
          serialNumber: "SN",
          hostname: "h",
          make: "Dell",
          model: "X",
          laptopType: "standard",
          operatingSystem: "windows-11",
          department: "it",
          assignedTo: "",
          location: "",
          status: "in-service",
          purchaseDate: "",
          warrantyEnd: "",
          notes: "",
        },
      ],
      printers: [],
      software: [],
      destructions: [],
    })
    const result = parseInventoryJson(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.laptops[0]?.inventoryNumber).toBe("INV-0001")
      expect(result.state.history).toEqual([])
    }
  })

  it("rejects a backup whose history rows are empty objects", () => {
    const raw = JSON.stringify({
      laptops: [],
      printers: [],
      software: [],
      destructions: [],
      history: [{}],
    })
    expect(parseInventoryJson(raw).ok).toBe(false)
  })

  it("rejects a backup with two laptops sharing an inventory number", () => {
    const laptop = {
      id: "lap-1",
      inventoryNumber: "INV-0001",
      assetTag: "LT-1",
      serialNumber: "SN",
      hostname: "h",
      make: "Dell",
      model: "X",
      laptopType: "standard",
      operatingSystem: "windows-11",
      department: "it",
      assignedTo: "",
      location: "",
      status: "in-service",
      purchaseDate: "",
      warrantyEnd: "",
      notes: "",
    }
    const raw = JSON.stringify({
      laptops: [laptop, { ...laptop, id: "lap-2", assetTag: "LT-2", serialNumber: "SN-2" }],
      printers: [],
      software: [],
      destructions: [],
    })
    expect(parseInventoryJson(raw).ok).toBe(false)
  })

  it("rejects unknown laptop status values", () => {
    const raw = JSON.stringify({
      laptops: [
        {
          id: "lap-1",
          inventoryNumber: "INV-1",
          assetTag: "LT-1",
          serialNumber: "SN",
          hostname: "h",
          make: "Dell",
          model: "X",
          laptopType: "standard",
          operatingSystem: "windows-11",
          department: "it",
          assignedTo: "",
          location: "",
          status: "scrapped",
          purchaseDate: "",
          warrantyEnd: "",
          notes: "",
        },
      ],
      printers: [],
      software: [],
      destructions: [],
    })
    expect(parseInventoryJson(raw).ok).toBe(false)
  })
})

describe("isInventoryState", () => {
  it("rejects four arrays of empty objects", () => {
    expect(
      isInventoryState({
        laptops: [{}],
        printers: [{}],
        software: [{}],
        destructions: [{}],
      }),
    ).toBe(false)
  })
})

describe("loadInventory", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage")
  })

  it("still boots when first-visit seed cannot be written", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        ...memoryStorage(),
        setItem: () => {
          throw new Error("quota")
        },
      },
    })

    const loaded = loadInventory()
    expect(loaded.status).toBe("ok")
    if (loaded.status === "ok") {
      expect(loaded.state.laptops.length).toBeGreaterThan(0)
    }
  })

  it("persists seed on first visit", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    })

    const loaded = loadInventory()
    expect(loaded.status).toBe("ok")
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })

  it("does not overwrite corrupt storage with seed", () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, "not-json")
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    })

    const loaded = loadInventory()
    expect(loaded.status).toBe("corrupt")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("not-json")
  })

  it("returns a previously saved inventory", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    })
    saveInventory(emptyInventory())

    const loaded = loadInventory()
    expect(loaded.status).toBe("ok")
    if (loaded.status === "ok") {
      expect(loaded.state).toEqual(emptyInventory())
    }
  })
})
