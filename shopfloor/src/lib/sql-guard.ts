const BLOCKED = /\b(insert|update|delete|drop|alter|copy|attach|detach|pragma|call|create|replace|install|load|export|import|vacuum|checkpoint)\b/i

export function assertReadOnlySelect(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "")
  if (trimmed === "") {
    throw new Error("SQL ist leer")
  }
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Nur SELECT- und WITH-Abfragen sind erlaubt")
  }
  const withoutStrings = trimmed.replace(/'[^']*'/g, "''")
  if (withoutStrings.includes(";")) {
    throw new Error("Nur eine Anweisung")
  }
  if (BLOCKED.test(withoutStrings)) {
    throw new Error("Schreib- oder Admin-SQL ist gesperrt")
  }
  return trimmed
}
