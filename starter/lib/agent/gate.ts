// The authority gate. It sits in the tool layer, not in the prompt: whatever
// the model asks for, a change (booking, date, cost, customer message) only
// goes through with a person's yes or an ON trust rule that covers exactly
// this kind of case. Otherwise the tool answers "needs a person" and the
// model has to bring a person one decision instead.

import type { Change, TrustRule as ContractTrustRule } from "@/lib/control-room/types"

/** The foundation stores the option a rule covers (semantic id such as "pause_gig"). */
export type TrustRule = ContractTrustRule & { optionId?: string }
import type { OrderRow, SiteRow } from "./data"
import { customer } from "./data"

export interface GateContext {
  caseType: string
  placeId?: string
  customerId?: string
  country?: string
}

export type GateResult =
  | { allowed: true; rule?: TrustRule; note: string }
  | { allowed: false; needsPerson: true; reason: string }

/** The largest EUR amount a rule's text allows, e.g. "a storage fee up to 50 EUR" -> 50. */
export function ruleMaxEur(rule: TrustRule): number | undefined {
  const text = `${rule.when} ${rule.then}`
  const m = /(?:up to|max(?:imum)?|at most|under|≤)\s*(?:EUR\s*|€\s*)?(\d+(?:[.,]\d+)?)\s*(?:EUR|€|euros?)?/i.exec(text)
  return m ? Number(m[1].replace(",", ".")) : undefined
}

function ruleCovers(rule: TrustRule, change: Change): boolean {
  const text = `${rule.when} ${rule.then}`.toLowerCase()
  switch (change.kind) {
    case "none":
      return true
    case "cost": {
      if (!/(fee|cost|eur|€|charge|pay)/.test(text)) return false
      const max = ruleMaxEur(rule)
      if (max === undefined || change.amountEur === undefined) return false
      return change.amountEur <= max
    }
    case "date":
      return /(date|day|slot|move|reschedul|later)/.test(text)
    case "booking":
      // Pausing or withdrawing the gig, or rebooking, when the rule names it.
      return /(book|booking|gig|pause|withdraw|offer)/.test(text)
    case "driver_message":
      // Telling the driver what a covered change means for the gig.
      return true
    case "customer_message":
      // Bahn: the agent never contacts a customer on its own. No rule covers this here.
      return false
  }
}

function scopeMatches(rule: TrustRule, ctx: GateContext): boolean {
  if (rule.scope.placeId && rule.scope.placeId !== ctx.placeId) return false
  if (rule.scope.customerId && rule.scope.customerId !== ctx.customerId) return false
  if (rule.scope.country && ctx.country && rule.scope.country.toUpperCase() !== ctx.country.toUpperCase()) return false
  if (rule.scope.country && !ctx.country) return false
  return true
}

export function matchingRules(rules: TrustRule[], ctx: GateContext): TrustRule[] {
  return rules.filter((r) => r.status === "on" && r.caseType === ctx.caseType && scopeMatches(r, ctx))
}

/**
 * May the agent make these changes alone? A rule covers the case when it is
 * ON, has the same case type and scope, names the same option the agent
 * takes (rule.optionId, as the foundation's ruleFor matches it), and each
 * change fits the rule (a fee no higher than the rule says).
 */
export function checkChanges(changes: Change[], ctx: GateContext, rules: TrustRule[], trustRuleId?: string, optionKey?: string): GateResult {
  const real = changes.filter((c) => c.kind !== "none")
  if (real.length === 0 && !trustRuleId) return { allowed: true, note: "Nothing changes, so no yes is needed." }
  const customerMsg = real.find((c) => c.kind === "customer_message")
  if (customerMsg) {
    return { allowed: false, needsPerson: true, reason: "Needs a person: a message to the customer always needs a person's yes. Bring a person this decision with propose_case." }
  }
  const candidates = matchingRules(rules, ctx)
    .filter((r) => !trustRuleId || r.id === trustRuleId)
    .filter((r) => !r.optionId || !optionKey || r.optionId === optionKey)
  for (const rule of candidates) {
    if (real.every((c) => ruleCovers(rule, c))) {
      return { allowed: true, rule, note: `Covered by trust rule ${rule.id} (on): "${rule.when}" -> "${rule.then}".` }
    }
  }
  const kinds = real.map((c) => (c.kind === "cost" && c.amountEur !== undefined ? `cost ${c.amountEur} EUR` : c.kind)).join(", ") || optionKey || "this option"
  const why = trustRuleId
    ? `trust rule ${trustRuleId} is not on for ${ctx.caseType} here, or it does not cover: ${kinds}`
    : `no trust rule that is on covers ${ctx.caseType} with: ${kinds}`
  return { allowed: false, needsPerson: true, reason: `Needs a person: ${why}. A person says yes before any change. Bring a person this decision with propose_case.` }
}

/** Contacting the pickup place is allowed, unless the pickup place is the paying customer itself. */
export function contactCheck(order: OrderRow, s: SiteRow | undefined): GateResult {
  if (s?.customer_id && s.customer_id === order.customer_id) {
    const name = String(customer(order.customer_id)?.name ?? "the customer")
    return {
      allowed: false,
      needsPerson: true,
      reason: `Needs a person: this pickup place is run by the customer (${name}). Bahn's rule: the agent never contacts a customer on its own. Bring a person this decision with propose_case.`,
    }
  }
  return { allowed: true, note: "Pickup places and drivers may be asked without a yes." }
}

const AGREE = /(we (will )?(accept|agree|pay|confirm|book)|accepted|agreed|go ahead|einverstanden|akzeptier|wir (zahlen|übernehmen|bestätigen)|bezahlen wir|maksamme|hyväksy|vahvistamme|vi (betaler|accepterer|bekræfter)|nous (payons|acceptons|confirmons))/i
const AMOUNT = /(\d+(?:[.,]\d+)?)\s*(eur|€|euro)/i
const DATE_COMMIT = /(we (will )?(move|change|reschedule)|verschieben wir|wir verlegen|siirrämme|vi flytter)/i

/** A message to a driver or pickup place may ask anything, but must not agree to a cost, booking or date. */
export function messageCommits(text: string): string | undefined {
  if (AMOUNT.test(text) && AGREE.test(text)) return "the message agrees to a cost"
  if (DATE_COMMIT.test(text)) return "the message moves a date"
  if (/\b(we (have )?booked|wir haben gebucht|olemme varanneet)\b/i.test(text)) return "the message confirms a booking"
  return undefined
}
