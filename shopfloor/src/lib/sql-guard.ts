const BLOCKED = /\b(insert|update|delete|drop|alter|copy|attach|detach|pragma|call|create|replace|install|load|export|import|vacuum|checkpoint)\b/i

export function assertReadOnlySelect(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "")
  if (trimmed === "") {
    throw new Error("SQL is empty")
  }
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Only SELECT / WITH queries are allowed")
  }
  const withoutStrings = trimmed.replace(/'[^']*'/g, "''")
  if (withoutStrings.includes(";")) {
    throw new Error("One statement only")
  }
  if (BLOCKED.test(withoutStrings)) {
    throw new Error("Write or admin SQL is blocked")
  }
  return trimmed
}
