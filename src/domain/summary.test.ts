import { describe, expect, it } from "vitest"

import { emptyInventory } from "./catalog"
import { countLaptopsByDepartment } from "./summary"
import type { Laptop } from "./types"

function laptop(overrides: Partial<Laptop> = {}): Laptop {
  return {
    id: "lap-1",
    inventoryNumber: "INV-0001",
    assetTag: "LT-1001",
    serialNumber: "SN-AA11",
    hostname: "prod-01",
    make: "Dell",
    model: "Latitude 5550",
    laptopType: "standard",
    operatingSystem: "windows-11",
    department: "production",
    assignedTo: "A. Rivera",
    location: "Line 1",
    status: "in-service",
    purchaseDate: "2024-03-12",
    warrantyEnd: "2027-03-12",
    notes: "",
    ...overrides,
  }
}

describe("countLaptopsByDepartment", () => {
  it("excludes destroyed laptops from department counts", () => {
    const state = {
      ...emptyInventory(),
      laptops: [
        laptop(),
        laptop({
          id: "lap-2",
          assetTag: "LT-1002",
          serialNumber: "SN-BB22",
          status: "destroyed",
        }),
      ],
    }

    const counts = countLaptopsByDepartment(state)
    expect(counts.find((row) => row.department === "production")?.count).toBe(1)
  })
})
