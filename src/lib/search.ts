export function matchesQuery(haystacks: Array<string | number>, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return true
  }
  return haystacks.some((value) => String(value).toLowerCase().includes(needle))
}
