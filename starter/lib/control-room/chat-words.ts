// Words for what the agent knows about a kind of case (CaseKnowledge), shown under
// the chat's opener. Plain, short, never a score per person.

import type { CaseKnowledge } from "./types-chat"

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`)

/**
 * Where the kind stands: the trust gate's line, the same words as Know-how
 * ("New kind of case", "Decided once, by Mikko", "2 of 16, 2 people",
 * "29 of 30 agree, 4 people", "People answer this differently").
 */
export function knowledgeWords(k: CaseKnowledge): string {
  if (k.gate) return k.gate.line
  if (k.novelty === "new" || k.decided === 0) return "New kind of case"
  if (k.decided === 1) return `Decided once, by ${k.precedents[0]?.decidedBy ?? "one person"}`
  return `${Math.min(k.sameAsSuggestion, k.needed)} of ${k.needed} agree, ${people(k.peopleCount)}`
}

/** How far the kind is from the agent offering to handle it alone (the gate: N agreeing answers from more than one person). */
export function gateWords(k: CaseKnowledge): string {
  if (k.gate?.status === "differ") return "People answer this differently, so the agent does not offer to handle this kind alone."
  const more = k.gate ? (k.gate.status === "ready" ? 0 : Math.max(0, k.gate.needed - k.gate.agreeing)) : Math.max(0, k.needed - k.sameAsSuggestion)
  const onePerson = k.gate ? k.gate.agreeingPeople < 2 : k.peopleCount < 2
  if (more === 0 && !onePerson) return "Enough people agree: the agent may offer to handle this kind alone."
  if (more === 0) return "Enough answers, but all from one person: the agent waits for someone else to agree."
  return `${more} more agreeing ${more === 1 ? "answer" : "answers"}${onePerson ? ", from more than one person," : ""} and the agent may offer to handle this kind alone.`
}
