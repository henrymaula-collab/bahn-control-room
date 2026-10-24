// The trust gate: when may the agent propose to handle a kind of case alone?
//
// Only when enough weighted, agreeing answers from more than one person say the
// same thing. "Enough" is a 95% Wilson lower bound on agreement of at least the
// bound that N answers in a row give. With N = 16 that is 0.806: 16 of 16, or
// about 28 of 30 (research/angle/C-lever.md section 5: the old "5 at 90%" gate
// passed a 60%-agreement type 7.8% of the time; this one almost never does).
//
// Weight: how much one answer counts is the person's record on this kind of
// case, never their title or tenure. Every answer starts at full weight; each of
// that person's decisions on this kind that had to be changed later, or after
// which the delivery missed its promise, lowers it:
//   weight = (held + 1) / (decided + 1)
// So a clean record counts 1.0, one miss in ten 0.91, three in six 0.57.
// Weighted answers enter the bound as fractional counts: trusting answers less
// means more of them are needed.
//
// Disagreement blocks: when the leading answer has less than 80% of the
// weighted answers, the kind is reported as "People answer this differently"
// and no proposal is made, however many answers there are.
//
// Pure functions only; the engine feeds them answers (service.ts).

export const GATE_N = 16
export const GATE_MIN_PEOPLE = 2
export const GATE_Z = 1.96
/** Below this weighted share for the leading answer, people answer this differently. */
export const GATE_DIFFER_SHARE = 0.8

/** 95% Wilson score lower bound for `agree` of `total` (fractional counts allowed). */
export function wilsonLower(agree: number, total: number, z = GATE_Z): number {
  if (total <= 0) return 0
  const p = Math.min(1, Math.max(0, agree / total))
  const z2 = z * z
  const centre = p + z2 / (2 * total)
  const spread = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))
  return (centre - spread) / (1 + z2 / total)
}

/** The bound a proposal needs: what N agreeing answers in a row give (0.806 for 16). */
export const GATE_FLOOR = wilsonLower(GATE_N, GATE_N)
const EPS = 1e-9

/** One person's answer on one case of a kind. Outcomes come from the decision ledger. */
export interface Answer {
  caseId: string
  personId: string
  optionId: string
  at: string
  laterChanged: boolean
  onTime: boolean
}

export interface PersonRecord {
  decided: number
  held: number // neither changed later nor followed by a missed promise
}

export function personWeight(record: PersonRecord): number {
  return (record.held + 1) / (record.decided + 1)
}

/** Records per person on this kind, from these answers. */
export function recordsOf(answers: Answer[]): Map<string, PersonRecord> {
  const out = new Map<string, PersonRecord>()
  for (const answer of answers) {
    const record = out.get(answer.personId) ?? { decided: 0, held: 0 }
    record.decided++
    if (!answer.laterChanged && answer.onTime) record.held++
    out.set(answer.personId, record)
  }
  return out
}

export type GateStatus = "new" | "learning" | "differ" | "ready"

export interface KindGate {
  decided: number // cases of this kind people decided
  people: number // different people who decided them
  leadingOptionId: string | null
  agreeing: number // answers that chose the leading option
  agreeingPeople: number
  weightedAgreeing: number
  weightedTotal: number
  share: number // weighted share of the leading option, 0..1
  lowerBound: number // Wilson lower bound on that share
  needed: number // agreeing answers needed before the agent may propose; 16 for a new kind
  status: GateStatus
  /** One plain line: "New kind of case", "2 of 16", "29 of 30 agree", "People answer this differently". */
  line: string
  options: { optionId: string; count: number; weighted: number }[]
  weights: Record<string, number> // personId -> weight on this kind
}

/** Keep one answer per case: the latest. A case decided twice (the choice, then the why) is one answer. */
export function onePerCase(answers: Answer[]): Answer[] {
  const latest = new Map<string, Answer>()
  for (const answer of answers) {
    const known = latest.get(answer.caseId)
    if (!known || answer.at >= known.at) latest.set(answer.caseId, answer)
  }
  return [...latest.values()].sort((a, b) => a.at.localeCompare(b.at) || a.caseId.localeCompare(b.caseId))
}

/**
 * How many more agreeing answers, each at full weight, the bound needs:
 * the smallest m with wilsonLower(a + m, t + m) >= GATE_FLOOR.
 */
export function moreNeeded(weightedAgreeing: number, weightedTotal: number, floor = GATE_FLOOR, cap = 999): number {
  for (let m = 0; m <= cap; m++) {
    if (wilsonLower(weightedAgreeing + m, weightedTotal + m) >= floor - EPS) return m
  }
  return cap
}

export function evaluateKind(all: Answer[]): KindGate {
  const answers = onePerCase(all)
  const records = recordsOf(answers)
  const weights: Record<string, number> = {}
  for (const [personId, record] of records) weights[personId] = personWeight(record)

  const byOption = new Map<string, { optionId: string; count: number; weighted: number; people: Set<string>; last: string }>()
  for (const answer of answers) {
    const entry = byOption.get(answer.optionId) ?? { optionId: answer.optionId, count: 0, weighted: 0, people: new Set<string>(), last: "" }
    entry.count++
    entry.weighted += weights[answer.personId] ?? 1
    entry.people.add(answer.personId)
    if (answer.at > entry.last) entry.last = answer.at
    byOption.set(answer.optionId, entry)
  }
  const options = [...byOption.values()].sort((a, b) => b.weighted - a.weighted || b.count - a.count || b.last.localeCompare(a.last))
  const leading = options[0]
  const weightedTotal = options.reduce((sum, option) => sum + option.weighted, 0)
  const weightedAgreeing = leading?.weighted ?? 0
  const agreeing = leading?.count ?? 0
  const agreeingPeople = leading?.people.size ?? 0
  const share = weightedTotal > 0 ? weightedAgreeing / weightedTotal : 0
  const lowerBound = wilsonLower(weightedAgreeing, weightedTotal)
  let more = moreNeeded(weightedAgreeing, weightedTotal)
  // More than one person: a lone expert never earns a rule on their own.
  if (agreeingPeople < GATE_MIN_PEOPLE) more = Math.max(more, GATE_MIN_PEOPLE - agreeingPeople)
  const needed = agreeing + more

  let status: GateStatus
  if (!answers.length) status = "new"
  else if (answers.length >= 2 && share < GATE_DIFFER_SHARE) status = "differ"
  else if (lowerBound >= GATE_FLOOR - EPS && agreeingPeople >= GATE_MIN_PEOPLE) status = "ready"
  else status = "learning"

  // Learning reads as progress toward a proposal ("2 of 16"); ready as the evidence ("29 of 30 agree").
  const line = status === "new" ? "New kind of case"
    : status === "differ" ? "People answer this differently"
      : status === "ready" ? `${agreeing} of ${answers.length} agree`
        : `${agreeing} of ${needed}`

  return {
    decided: answers.length,
    people: records.size,
    leadingOptionId: leading?.optionId ?? null,
    agreeing,
    agreeingPeople,
    weightedAgreeing,
    weightedTotal,
    share,
    lowerBound,
    needed,
    status,
    line,
    options: options.map(({ optionId, count, weighted }) => ({ optionId, count, weighted })),
    weights,
  }
}
