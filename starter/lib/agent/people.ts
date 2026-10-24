// Names for the made-up ops team. The foundation owns the real list
// (OpsPerson); until it is merged, a person id is shown by its first name.

const KNOWN: Record<string, string> = {}

export function registerPeople(people: { id: string; name: string }[]): void {
  for (const p of people) KNOWN[p.id] = p.name
}

export function personName(personId: string | undefined): string {
  if (!personId) return "A person"
  if (KNOWN[personId]) return KNOWN[personId]
  const base = personId.replace(/^(person|ops|p)-/, "").split(/[-_.]/)[0] ?? personId
  return base.charAt(0).toUpperCase() + base.slice(1)
}
