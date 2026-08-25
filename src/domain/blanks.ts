import { localDateStamp } from "@/lib/dates"
import type { DestructionRecord, Laptop, Printer, SoftwareLicense } from "./types"

export function blankLaptop(id: string): Laptop {
  return {
    id,
    assetTag: "",
    serialNumber: "",
    hostname: "",
    make: "",
    model: "",
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
}

export function blankPrinter(id: string): Printer {
  return {
    id,
    assetTag: "",
    serialNumber: "",
    make: "",
    model: "",
    printerType: "laser",
    department: "it",
    location: "",
    ipAddress: "",
    status: "in-service",
    notes: "",
  }
}

export function blankSoftware(id: string): SoftwareLicense {
  return {
    id,
    name: "",
    vendor: "",
    entitlementId: "",
    licenseType: "subscription",
    seatsPurchased: 1,
    seatsAssigned: 0,
    department: "it",
    renewalDate: "",
    annualCost: 0,
    notes: "",
  }
}

export function blankDestruction(id: string): DestructionRecord {
  return {
    id,
    assetKind: "laptop",
    assetId: "",
    assetTag: "",
    serialNumber: "",
    department: "it",
    method: "secure-wipe-recycle",
    destroyedOn: localDateStamp(),
    witnessedBy: "",
    certificateId: "",
    reason: "",
    notes: "",
  }
}
