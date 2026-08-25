export const DEPARTMENTS = [
  "operations",
  "maintenance",
  "engineering",
  "quality",
  "safety",
  "it",
  "finance",
  "hr",
  "warehouse",
  "production",
  "ot-controls",
  "contractor",
] as const

export const LAPTOP_TYPES = [
  "standard",
  "engineering",
  "field-rugged",
  "executive",
  "shared-kiosk",
  "contractor-loaner",
] as const

export const OPERATING_SYSTEMS = [
  "windows-11",
  "windows-10",
  "macos",
  "ubuntu",
  "rhel",
] as const

export const ASSET_STATUSES = [
  "in-service",
  "spare",
  "repair",
  "lost",
  "retired",
  "destroyed",
] as const

export const PRINTER_TYPES = [
  "laser",
  "inkjet",
  "label",
  "mfp",
  "plotter",
] as const

export const LICENSE_TYPES = [
  "per-seat",
  "site",
  "subscription",
  "oem",
  "freeware",
] as const

export const DESTRUCTION_METHODS = [
  "secure-wipe-recycle",
  "physical-shred",
  "degauss",
  "return-to-vendor",
] as const

export const ASSET_KINDS = ["laptop", "printer", "other"] as const

export type Department = (typeof DEPARTMENTS)[number]
export type LaptopType = (typeof LAPTOP_TYPES)[number]
export type OperatingSystem = (typeof OPERATING_SYSTEMS)[number]
export type AssetStatus = (typeof ASSET_STATUSES)[number]
export type PrinterType = (typeof PRINTER_TYPES)[number]
export type LicenseType = (typeof LICENSE_TYPES)[number]
export type DestructionMethod = (typeof DESTRUCTION_METHODS)[number]
export type AssetKind = (typeof ASSET_KINDS)[number]

export type Laptop = {
  id: string
  inventoryNumber: string
  assetTag: string
  serialNumber: string
  hostname: string
  make: string
  model: string
  laptopType: LaptopType
  operatingSystem: OperatingSystem
  department: Department
  assignedTo: string
  location: string
  status: AssetStatus
  purchaseDate: string
  warrantyEnd: string
  notes: string
}

export type Printer = {
  id: string
  inventoryNumber: string
  assetTag: string
  serialNumber: string
  make: string
  model: string
  printerType: PrinterType
  department: Department
  location: string
  ipAddress: string
  status: AssetStatus
  notes: string
}

export type SoftwareLicense = {
  id: string
  inventoryNumber: string
  name: string
  vendor: string
  entitlementId: string
  licenseType: LicenseType
  seatsPurchased: number
  seatsAssigned: number
  department: Department
  renewalDate: string
  annualCost: number
  notes: string
}

export type DestructionRecord = {
  id: string
  assetKind: AssetKind
  assetId: string
  inventoryNumber: string
  assetTag: string
  serialNumber: string
  department: Department
  method: DestructionMethod
  destroyedOn: string
  witnessedBy: string
  certificateId: string
  reason: string
  notes: string
}

export const HISTORY_ACTIONS = [
  "created",
  "updated",
  "destroyed",
  "destruction-removed",
  "removed",
] as const

export type HistoryAction = (typeof HISTORY_ACTIONS)[number]

export type HistoryChange = {
  field: string
  from: string
  to: string
}

export type HistoryEvent = {
  id: string
  at: string
  action: HistoryAction
  register: "laptop" | "printer" | "software" | "destruction"
  recordId: string
  inventoryNumber: string
  assetTag: string
  serialNumber: string
  summary: string
  changes: HistoryChange[]
}

export type InventoryState = {
  laptops: Laptop[]
  printers: Printer[]
  software: SoftwareLicense[]
  destructions: DestructionRecord[]
  history: HistoryEvent[]
}

export type SaveResult<T> =
  | { ok: true; state: T }
  | { ok: false; error: string }

export const FINDING_CODES = [
  "missing-serial",
  "expired-warranty",
  "unassigned-in-service",
  "license-over-assigned",
  "license-expiring",
  "license-expired",
  "destroy-without-witness",
] as const

export type FindingCode = (typeof FINDING_CODES)[number]

export type AuditFinding = {
  code: FindingCode
  severity: "high" | "medium"
  register: "laptop" | "printer" | "software" | "destruction"
  recordId: string
  assetTag: string
  department: Department | ""
  summary: string
}
