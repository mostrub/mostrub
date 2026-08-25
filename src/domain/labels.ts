import type {
  AssetKind,
  AssetStatus,
  Department,
  DestructionMethod,
  FindingCode,
  LaptopType,
  LicenseType,
  OperatingSystem,
  PrinterType,
} from "./types"

export const DEPARTMENT_LABELS = {
  operations: "Operations",
  maintenance: "Maintenance",
  engineering: "Engineering",
  quality: "Quality",
  safety: "Safety",
  it: "IT",
  finance: "Finance",
  hr: "HR",
  warehouse: "Warehouse",
  production: "Production",
  "ot-controls": "OT / Controls",
  contractor: "Contractor",
} as const satisfies Record<Department, string>

export const LAPTOP_TYPE_LABELS = {
  standard: "Standard",
  engineering: "Engineering workstation",
  "field-rugged": "Field / rugged",
  executive: "Executive",
  "shared-kiosk": "Shared / kiosk",
  "contractor-loaner": "Contractor loaner",
} as const satisfies Record<LaptopType, string>

export const OS_LABELS = {
  "windows-11": "Windows 11",
  "windows-10": "Windows 10",
  macos: "macOS",
  ubuntu: "Ubuntu",
  rhel: "RHEL",
} as const satisfies Record<OperatingSystem, string>

export const STATUS_LABELS = {
  "in-service": "In service",
  spare: "Spare",
  repair: "Repair",
  lost: "Lost",
  retired: "Retired",
  destroyed: "Destroyed",
} as const satisfies Record<AssetStatus, string>

export const PRINTER_TYPE_LABELS = {
  laser: "Laser",
  inkjet: "Inkjet",
  label: "Label",
  mfp: "Multifunction",
  plotter: "Plotter",
} as const satisfies Record<PrinterType, string>

export const LICENSE_TYPE_LABELS = {
  "per-seat": "Per seat",
  site: "Site",
  subscription: "Subscription",
  oem: "OEM",
  freeware: "Freeware",
} as const satisfies Record<LicenseType, string>

export const DESTRUCTION_METHOD_LABELS = {
  "secure-wipe-recycle": "Secure wipe + recycle",
  "physical-shred": "Physical shred",
  degauss: "Degauss",
  "return-to-vendor": "Return to vendor",
} as const satisfies Record<DestructionMethod, string>

export const ASSET_KIND_LABELS = {
  laptop: "Laptop",
  printer: "Printer",
  other: "Other",
} as const satisfies Record<AssetKind, string>

export const FINDING_LABELS = {
  "missing-serial": "Missing serial",
  "expired-warranty": "Expired warranty",
  "unassigned-in-service": "Unassigned in-service asset",
  "license-over-assigned": "License over-assigned",
  "license-expiring": "License renewing soon",
  "destroy-without-witness": "Destruction without witness",
} as const satisfies Record<FindingCode, string>

export function optionList<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }))
}
