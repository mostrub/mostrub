import { DEPARTMENTS, type Department, type InventoryState } from "./types"

export function countLaptopsByDepartment(
  state: InventoryState,
): { department: Department; count: number }[] {
  return DEPARTMENTS.flatMap((department) => {
    const count = state.laptops.filter(
      (item) => item.department === department && item.status !== "destroyed",
    ).length
    return count === 0 ? [] : [{ department, count }]
  })
}

export function summarizeInventory(state: InventoryState) {
  return {
    laptops: state.laptops.length,
    laptopsInService: state.laptops.filter((item) => item.status === "in-service")
      .length,
    printers: state.printers.length,
    software: state.software.length,
    seatsAssigned: state.software.reduce((sum, item) => sum + item.seatsAssigned, 0),
    destructions: state.destructions.length,
  }
}
