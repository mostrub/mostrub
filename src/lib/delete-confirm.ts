export function deleteConfirmMatches(typed: string, required: string): boolean {
  const needle = typed.trim().toLowerCase()
  const expected = required.trim().toLowerCase()
  return expected.length > 0 && needle === expected
}
