import { describe, expect, it } from "vitest"

import { emptyInventory, upsertLaptop } from "./catalog"
import { queryDeviceHistory } from "./history"
import type { Laptop } from "./types"

function laptop(overrides: Partial<Laptop> = {}): Laptop {
  return {
    id: "lap-1",
    inventoryNumber: "",
    assetTag: "LT-1001",
    serialNumber: "SN-AA11",
    hostname: "ops-lt-01",
    make: "Dell",
    model: "Latitude 5550",
    laptopType: "standard",
    operatingSystem: "windows-11",
    department: "operations",
    assignedTo: "A. Rivera",
    location: "Plant 1",
    status: "in-service",
    purchaseDate: "2024-03-12",
    warrantyEnd: "2027-03-12",
    notes: "",
    ...overrides,
  }
}

describe("queryDeviceHistory", () => {
  it("returns events for an inventory number", () => {
    const created = upsertLaptop(emptyInventory(), laptop())
    if (!created.ok) {
      throw new Error(created.error)
    }
    const inventoryNumber = created.state.laptops[0]!.inventoryNumber
    const updated = upsertLaptop(
      created.state,
      laptop({ inventoryNumber, assignedTo: "B. Jones" }),
    )
    if (!updated.ok) {
      throw new Error(updated.error)
    }

    const rows = queryDeviceHistory(updated.state, inventoryNumber)
    expect(rows.length).toBe(2)
    expect(rows.every((event) => event.inventoryNumber === inventoryNumber)).toBe(
      true,
    )
  })

  it("finds history by serial number", () => {
    const created = upsertLaptop(emptyInventory(), laptop())
    if (!created.ok) {
      throw new Error(created.error)
    }

    const rows = queryDeviceHistory(created.state, "sn-aa11")
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe("created")
  })
})
