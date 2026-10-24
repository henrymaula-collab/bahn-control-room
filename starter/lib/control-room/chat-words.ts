// Words for what the agent knows about a kind of case (CaseKnowledge), shown under
// the chat's opener. Plain, short, never a score per person.

import type { CaseKnowledge } from "./types-chat"

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`)

/** Where the kind stands: "New kind of case", "Decided once, by Mikko", "14 of 16 agree, 3 people". */
export function knowledgeWords(k: CaseKnowledge): string {
  if (k.novelty === "new" || k.decided === 0) return "New kind of case"
  if (k.decided === 1) return `Decided once, by ${k.precedents[0]?.decidedBy ?? "one person"}`
  return `${Math.min(k.sameAsSuggestion, k.needed)} of ${k.needed} agree, ${people(k.peopleCount)}`
}

/** How far the kind is from the agent offering to handle it alone (the gate: N agreeing answers from more than one person). */
export function gateWords(k: CaseKnowledge): string {
  const more = Math.max(0, k.needed - k.sameAsSuggestion)
  const onePerson = k.peopleCount < 2
  if (more === 0 && !onePerson) return "Enough people agree: the agent may offer to handle this kind alone."
  if (more === 0) return "Enough answers, but all from one person: the agent waits for someone else to agree."
  return `${more} more agreeing ${more === 1 ? "answer" : "answers"}${onePerson ? ", from more than one person," : ""} and the agent may offer to handle this kind alone.`
}
