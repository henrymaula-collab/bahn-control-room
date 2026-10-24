// Every fact the agent may put in front of a person is registered here by a
// tool, with who said it, how and when. propose_case only accepts fact ids
// from this registry, so the model cannot hand a person an unsourced fact.

import type { Fact, SourceKind } from "@/lib/control-room/types"

export class FactRegistry {
  private facts = new Map<string, Fact>()
  private n = 0
  constructor(private prefix: string) {}

  add(statement: string, source: Fact["source"], strength: Fact["strength"]): Fact {
    // Same statement from the same source: reuse, so a re-read does not duplicate.
    for (const f of this.facts.values()) {
      if (f.statement === statement && f.source.kind === source.kind && f.source.at === source.at) return f
    }
    this.n += 1
    const fact: Fact = { id: `${this.prefix}-f${this.n}`, statement, source, strength }
    this.facts.set(fact.id, fact)
    return fact
  }

  get(id: string): Fact | undefined {
    return this.facts.get(id)
  }

  has(id: string): boolean {
    return this.facts.has(id)
  }

  all(): Fact[] {
    return [...this.facts.values()]
  }

  restore(facts: Fact[]): void {
    for (const f of facts) {
      this.facts.set(f.id, f)
      const m = /-f(\d+)$/.exec(f.id)
      if (m) this.n = Math.max(this.n, Number(m[1]))
    }
  }
}

/** Who said it, from the dataset's author or stated_by fields. */
export function sourceKindFrom(raw: string | undefined): SourceKind {
  switch ((raw ?? "").toLowerCase()) {
    case "customer":
    case "customer_order_input":
    case "handoff_contact":
    case "handoff_access_reply":
      return "customer"
    case "site_contact":
    case "site_contact_reply":
    case "site":
      return "pickup_place"
    case "driver":
      return "driver"
    case "driver_app":
    case "app":
      return "driver_app"
    case "operator":
    case "ops":
      return "person"
    case "agent":
      return "agent"
    default:
      return "record"
  }
}

export function channelFrom(raw: string | undefined): Fact["source"]["channel"] {
  const c = (raw ?? "").toLowerCase()
  if (c.includes("call")) return "call"
  if (c.includes("email")) return "email"
  if (c.includes("app")) return "app"
  if (c.includes("chat") || c.includes("whatsapp") || c.includes("note")) return "message"
  return "record"
}

/** A short, plain view of facts for the model (ids first so it can cite them). */
export function factLines(facts: Fact[]): string[] {
  return facts.map((f) => `${f.id} [${f.source.kind}${f.source.name ? `: ${f.source.name}` : ""}, ${f.source.channel ?? "record"}, ${f.source.at}, ${f.strength}] ${f.statement}`)
}
