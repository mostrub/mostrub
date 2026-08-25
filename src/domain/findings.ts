import { FINDING_LABELS } from "./labels"
import type { AuditFinding, InventoryState, Laptop, Printer } from "./types"

function daysUntil(date: string, today: string): number | null {
  if (!date) {
    return null
  }
  const target = Date.parse(date)
  const now = Date.parse(today)
  if (Number.isNaN(target) || Number.isNaN(now)) {
    return null
  }
  return Math.round((target - now) / 86_400_000)
}

function hardwareFindings(
  items: Array<Laptop | Printer>,
  register: "laptop" | "printer",
  today: string,
): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (const item of items) {
    if (item.status === "destroyed") {
      continue
    }

    if (item.serialNumber.trim().length === 0) {
      findings.push({
        code: "missing-serial",
        severity: "high",
        register,
        recordId: item.id,
        assetTag: item.assetTag,
        department: item.department,
        summary: `${FINDING_LABELS["missing-serial"]}: ${item.assetTag}`,
      })
    }

    if (
      "assignedTo" in item &&
      item.status === "in-service" &&
      item.assignedTo.trim().length === 0
    ) {
      findings.push({
        code: "unassigned-in-service",
        severity: "medium",
        register,
        recordId: item.id,
        assetTag: item.assetTag,
        department: item.department,
        summary: `${FINDING_LABELS["unassigned-in-service"]}: ${item.assetTag}`,
      })
    }

    if ("warrantyEnd" in item) {
      const remaining = daysUntil(item.warrantyEnd, today)
      if (remaining !== null && remaining < 0) {
        findings.push({
          code: "expired-warranty",
          severity: "medium",
          register,
          recordId: item.id,
          assetTag: item.assetTag,
          department: item.department,
          summary: `${FINDING_LABELS["expired-warranty"]}: ${item.assetTag} ended ${item.warrantyEnd}`,
        })
      }
    }
  }

  return findings
}

export function collectAuditFindings(
  state: InventoryState,
  options: { today: string },
): AuditFinding[] {
  const findings: AuditFinding[] = [
    ...hardwareFindings(state.laptops, "laptop", options.today),
    ...hardwareFindings(state.printers, "printer", options.today),
  ]

  for (const license of state.software) {
    if (license.seatsAssigned > license.seatsPurchased) {
      findings.push({
        code: "license-over-assigned",
        severity: "high",
        register: "software",
        recordId: license.id,
        assetTag: license.entitlementId || license.name,
        department: license.department,
        summary: `${license.name} has ${license.seatsAssigned} assigned of ${license.seatsPurchased} purchased`,
      })
    }

    const remaining = daysUntil(license.renewalDate, options.today)
    if (remaining !== null && remaining < 0) {
      findings.push({
        code: "license-expired",
        severity: "high",
        register: "software",
        recordId: license.id,
        assetTag: license.entitlementId || license.name,
        department: license.department,
        summary: `${license.name} expired on ${license.renewalDate}`,
      })
    } else if (remaining !== null && remaining <= 30) {
      findings.push({
        code: "license-expiring",
        severity: "medium",
        register: "software",
        recordId: license.id,
        assetTag: license.entitlementId || license.name,
        department: license.department,
        summary: `${license.name} renews in ${remaining} days (${license.renewalDate})`,
      })
    }
  }

  for (const record of state.destructions) {
    if (record.witnessedBy.trim().length === 0) {
      findings.push({
        code: "destroy-without-witness",
        severity: "high",
        register: "destruction",
        recordId: record.id,
        assetTag: record.assetTag,
        department: record.department,
        summary: `${FINDING_LABELS["destroy-without-witness"]}: ${record.assetTag}`,
      })
    }
  }

  return findings
}
