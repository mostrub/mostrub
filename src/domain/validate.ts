import {
  ASSET_KINDS,
  ASSET_STATUSES,
  DEPARTMENTS,
  DESTRUCTION_METHODS,
  LAPTOP_TYPES,
  LICENSE_TYPES,
  OPERATING_SYSTEMS,
  PRINTER_TYPES,
  type DestructionRecord,
  type InventoryState,
  type Laptop,
  type Printer,
  type SoftwareLicense,
} from "./types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
}

function hasStrings(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => isString(record[key]))
}

export function isLaptop(value: unknown): value is Laptop {
  if (!isRecord(value)) {
    return false
  }
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    hasStrings(value, [
      "inventoryNumber",
      "assetTag",
      "serialNumber",
      "hostname",
      "make",
      "model",
      "assignedTo",
      "location",
      "purchaseDate",
      "warrantyEnd",
      "notes",
    ]) &&
    isOneOf(value.laptopType, LAPTOP_TYPES) &&
    isOneOf(value.operatingSystem, OPERATING_SYSTEMS) &&
    isOneOf(value.department, DEPARTMENTS) &&
    isOneOf(value.status, ASSET_STATUSES)
  )
}

export function isPrinter(value: unknown): value is Printer {
  if (!isRecord(value)) {
    return false
  }
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    hasStrings(value, [
      "inventoryNumber",
      "assetTag",
      "serialNumber",
      "make",
      "model",
      "location",
      "ipAddress",
      "notes",
    ]) &&
    isOneOf(value.printerType, PRINTER_TYPES) &&
    isOneOf(value.department, DEPARTMENTS) &&
    isOneOf(value.status, ASSET_STATUSES)
  )
}

export function isSoftwareLicense(value: unknown): value is SoftwareLicense {
  if (!isRecord(value)) {
    return false
  }
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    hasStrings(value, [
      "inventoryNumber",
      "name",
      "vendor",
      "entitlementId",
      "renewalDate",
      "notes",
    ]) &&
    isOneOf(value.licenseType, LICENSE_TYPES) &&
    isOneOf(value.department, DEPARTMENTS) &&
    isFiniteNumber(value.seatsPurchased) &&
    isFiniteNumber(value.seatsAssigned) &&
    isFiniteNumber(value.annualCost)
  )
}

export function isDestructionRecord(value: unknown): value is DestructionRecord {
  if (!isRecord(value)) {
    return false
  }
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    hasStrings(value, [
      "assetId",
      "inventoryNumber",
      "assetTag",
      "serialNumber",
      "destroyedOn",
      "witnessedBy",
      "certificateId",
      "reason",
      "notes",
    ]) &&
    isOneOf(value.assetKind, ASSET_KINDS) &&
    isOneOf(value.department, DEPARTMENTS) &&
    isOneOf(value.method, DESTRUCTION_METHODS)
  )
}

export function isInventoryState(value: unknown): value is InventoryState {
  if (!isRecord(value)) {
    return false
  }
  return (
    Array.isArray(value.laptops) &&
    value.laptops.every(isLaptop) &&
    Array.isArray(value.printers) &&
    value.printers.every(isPrinter) &&
    Array.isArray(value.software) &&
    value.software.every(isSoftwareLicense) &&
    Array.isArray(value.destructions) &&
    value.destructions.every(isDestructionRecord) &&
    (value.history === undefined || Array.isArray(value.history))
  )
}
