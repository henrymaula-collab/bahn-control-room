// The mock model: a deterministic stand-in that drives the same tools in the
// same loop when no model is available (CR_AGENT_PROVIDER=mock). It reads the
// tool results it got back, like the model does, and follows the brief's
// order: cheap work first, ask, then resolve or bring one decision. It is
// plain rules, not intelligence; traces say "mock" so nobody mistakes it.

import type { BetaContentBlock, BetaMessage, BetaMessageParam } from "./llm"

type Result = Record<string, unknown> & { error?: string }
interface History {
  calls: { name: string; input: Record<string, unknown>; result: Result }[]
}

interface FactOut { id: string; statement: string; source: string; strength: string }

function history(messages: BetaMessageParam[]): History {
  const uses = new Map<string, { name: string; input: Record<string, unknown> }>()
  const calls: History["calls"] = []
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue
    for (const b of m.content as unknown as Array<Record<string, unknown>>) {
      if (b.type === "tool_use") uses.set(String(b.id), { name: String(b.name), input: (b.input ?? {}) as Record<string, unknown> })
      if (b.type === "tool_result") {
        const use = uses.get(String(b.tool_use_id))
        if (!use) continue
        let result: Result = {}
        try {
          result = JSON.parse(typeof b.content === "string" ? b.content : JSON.stringify(b.content)) as Result
        } catch {
          result = { error: String(b.content) }
        }
        calls.push({ ...use, result })
      }
    }
  }
  return { calls }
}

function firstUserText(messages: BetaMessageParam[]): string {
  const m = messages[0]
  return typeof m?.content === "string" ? m.content : ""
}

let seq = 0
function toolUse(name: string, input: Record<string, unknown>): BetaContentBlock {
  seq += 1
  return { type: "tool_use", id: `mock_${Date.now().toString(36)}_${seq}`, name, input } as unknown as BetaContentBlock
}
function text(t: string): BetaContentBlock {
  return { type: "text", text: t, citations: null } as unknown as BetaContentBlock
}
function message(content: BetaContentBlock[], stop: "tool_use" | "end_turn"): BetaMessage {
  return { id: `mock_msg_${Date.now().toString(36)}`, type: "message", role: "assistant", model: "mock", content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } as unknown as BetaMessage
}

const facts = (r: Result | undefined): FactOut[] => (Array.isArray(r?.facts) ? (r!.facts as FactOut[]) : [])
const has = (re: RegExp, s: string) => re.test(s)

function pickFacts(all: FactOut[], callFacts: FactOut[], extra: RegExp): string[] {
  const chosen = [...callFacts]
  for (const f of all) {
    if (chosen.length >= 7) break
    if (!chosen.some((c) => c.id === f.id) && extra.test(f.statement)) chosen.push(f)
  }
  return chosen.map((f) => f.id)
}

export function mockTurn(messages: BetaMessageParam[]): BetaMessage {
  const h = history(messages)
  const done = (n: string) => h.calls.find((c) => c.name === n)
  const ref = /Order (CD-\d+|ord-\d+)/i.exec(firstUserText(messages))?.[1] ?? ""
  const first = firstUserText(messages)
  const callback = /A person decided case (\S+)\./.exec(first)
    ? {
        decision: /Decision: (.*)/.exec(first)?.[1] ?? "",
        option: /Option: (\S+)/.exec(first)?.[1] ?? "other",
        type: /Case type: (\S+)/.exec(first)?.[1] ?? "readiness.facts_disagree",
        changes: JSON.parse(/Approved changes \(JSON\): (.*)/.exec(first)?.[1] ?? "[]") as unknown[],
      }
    : undefined
  const order = ref
  const last = h.calls[h.calls.length - 1]
  if (last && ["propose_case", "resolve_without_person"].includes(last.name) && !last.result.error) {
    const r = last.result
    if (r.status === "done") return message([text("Carried out the decision and told the pickup place. The case is done.")], "end_turn")
    return message([text(r.case_id ? (r.handled_under_rule ? `Handled under trust rule ${r.handled_under_rule}; the case is recorded as handled by the agent.` : `Case ${r.case_id} is waiting for a person with the facts, the call and one suggestion. I will carry out the decision and call the pickup place back.`) : "Checked: nothing on this order needs a person now.")], "end_turn")
  }
  if (last?.result.error && h.calls.filter((c) => c.name === last.name && c.result.error).length >= 2) {
    return message([text(`I stopped: ${last.name} was refused twice (${String(last.result.error)}). A person needs to look at this order.`)], "end_turn")
  }
  if (last?.name === "schedule_callback" && !last.result.error) {
    return message([text("Nobody answered. I wrote to the pickup place and will call again at the time I promised; the order stays on my list.")], "end_turn")
  }

  // Carrying out a person's decision: call back, then close with the decided change.
  if (callback) {
    const call = done("call_pickup_place")
    if (!call) {
      const place = done("get_pickup_place") ?? undefined
      if (!place) return message([toolUse("get_pickup_place", { order })], "tool_use")
      return message([toolUse("call_pickup_place", { order, goal: `Tell the pickup place what Bahn decided (${callback.decision}) and confirm the next step.`, language: String(place.result.language ?? "en") })], "tool_use")
    }
    return message([toolUse("resolve_without_person", {
      order, type: callback.type,
      summary: "Carried out the person's decision and told the pickup place.",
      checks: [{ label: "Pickup place told about the decision", ok: true, fact_ids: facts(call.result).map((f) => f.id).slice(0, 3) }],
      changes: callback.changes, option_key: callback.option, trust_rule_id: "",
    })], "tool_use")
  }

  // Cheap work first.
  for (const n of ["get_order", "get_pickup_place", "get_conversations", "get_documents", "get_time_windows", "list_trust_rules"]) {
    if (!done(n)) return message([toolUse(n, n === "list_trust_rules" ? {} : { order })], "tool_use")
  }
  const place = done("get_pickup_place")!.result
  const all = h.calls.flatMap((c) => facts(c.result))
  const lessons = (place.accepted_lessons as { lesson_id: string; text: string; fact_id: string }[] | undefined) ?? []
  const rules = ((done("list_trust_rules")!.result.rules as { trust_rule_id: string; status: string; case_type: string; option_key: string | null; scope: { placeId?: string } }[]) ?? []).filter((r) => r.status === "on")
  const windows = (done("get_time_windows")!.result.windows as { purpose: string; start_at: string; selected: boolean }[]) ?? []
  const slot = windows.find((w) => w.purpose === "SELECTED_PICKUP_SLOT")
  const decideBy = slot ? new Date(new Date(slot.start_at).getTime() - 24 * 3600_000).toISOString() : ""
  const now = String(done("get_order")!.result.now ?? new Date().toISOString())

  // A pickup place run by the customer: a person contacts it.
  if (String(place.may_contact ?? "").startsWith("Needs a person")) {
    return message([toolUse("propose_case", {
      order, type: "readiness.keys_or_access", headline: "The pickup place is run by the customer, so a person has to ask them about the pickup.",
      reasons: ["needs_the_customer"], fact_ids: pickFacts(all, [], /(instruction|contact|slot|alert|work item)/i), new_facts: [],
      suggestion: { key: "ask_customer", label: "Call the customer's branch about the pickup", effect: "You call them; the agent records what they say on the order.", changes: [{ kind: "customer_message", detail: "Ask the branch to confirm the car, the keys and the release for the selected slot.", amount_eur: null }], draft: null, why_choices: [] },
      alternatives: [{ key: "keep_slot_call_again", label: "Keep the slot and check again tomorrow", effect: "Nothing changes now; the agent checks the order again tomorrow morning.", changes: [], draft: null, why_choices: [] }],
      decide_by: decideBy, lesson_ids_used: [],
    })], "tool_use")
  }

  const call = done("call_pickup_place")
  if (!call) {
    const releaseLesson = lessons.find((l) => /release/i.test(l.text))
    const missingDoc = all.some((f) => /no release document is on the order|release document on the order: missing/i.test(f.statement))
    const goal = releaseLesson || missingDoc
      ? "Find out whether the signed release document for this car has reached the right desk, and whether the car is ready for the slot."
      : "Confirm the car is ready for the selected slot, where the keys are, and whether anything is needed before the car can leave."
    return message([toolUse("call_pickup_place", { order, goal, language: String(place.language ?? "en") })], "tool_use")
  }
  if (call.result.error) {
    return message([text(`I could not call the pickup place: ${call.result.error}`)], "end_turn")
  }
  if (call.result.outcome === "no_answer") {
    if (!done("message_pickup_place")) {
      return message([toolUse("message_pickup_place", { order, text: `Hello, Bahn here about pickup ${order}. Can you confirm that the car is ready for the selected slot, who releases the keys, and whether anything is needed before the car can leave? Thank you.` })], "tool_use")
    }
    return message([toolUse("schedule_callback", { order, due_at: new Date(new Date(now).getTime() + 3600_000 + 10 * 60_000).toISOString(), reason: "Nobody answered at the pickup place. Call again in an hour." })], "tool_use")
  }

  const cf = facts(call.result)
  const said = cf.map((f) => f.statement).join(" ")
  const placeId = rules.length ? undefined : undefined
  void placeId
  const ruleFor = (key: string, type: string) => rules.find((r) => r.option_key === key && r.case_type === type)

  if (has(/(fee|euro|eur\b|gebühr)/i, said)) {
    const amount = Number(/(\d+(?:[.,]\d+)?)\s*(?:euro|eur|€)/i.exec(said)?.[1]?.replace(",", ".") ?? "0")
    const rule = ruleFor("accept_fee", "readiness.fee_requested")
    if (rule) {
      return message([toolUse("resolve_without_person", {
        order, type: "readiness.fee_requested", summary: `The pickup place asks for a ${amount} EUR fee; the trust rule that is on covers fees of this size.`,
        checks: [{ label: "Car located and ready for the slot", ok: true, fact_ids: cf.map((f) => f.id) }],
        changes: [{ kind: "cost", detail: `Accept the ${amount} EUR fee at the pickup place`, amount_eur: amount }], option_key: "accept_fee", trust_rule_id: rule.trust_rule_id,
      })], "tool_use")
    }
    return message([toolUse("propose_case", {
      order, type: "readiness.fee_requested", headline: `The pickup place asks for a ${amount} EUR fee before the car can leave.`,
      reasons: ["costs_extra_money"], fact_ids: pickFacts(all, cf, /(slot|instruction)/i), new_facts: [],
      suggestion: { key: "accept_fee", label: `Accept the ${amount} EUR fee and confirm the pickup`, effect: "The agent confirms with the pickup place and the gig stays as planned.", changes: [{ kind: "cost", detail: `${amount} EUR fee at the pickup place`, amount_eur: amount }], draft: null, why_choices: [] },
      alternatives: [{ key: "ask_customer", label: "Ask the customer who pays the fee", effect: "You send the message; the agent waits for the answer before confirming.", changes: [{ kind: "customer_message", detail: `The pickup place asks ${amount} EUR to release the car. Do you want us to pay it and add it to the invoice?`, amount_eur: null }], draft: null, why_choices: [] }],
      decide_by: decideBy, lesson_ids_used: lessons.map((l) => l.lesson_id),
    })], "tool_use")
  }

  if (has(/(hold|release document|freigabe|no release|not .*release)/i, said)) {
    const usedLessons = lessons.filter((l) => /release/i.test(l.text))
    const holds = has(/hold/i, said)
    return message([toolUse("propose_case", {
      order, type: "readiness.release_document_missing",
      headline: holds ? "The car is at the pickup place, but the seller's hold and the missing release document stop the handover." : "The pickup place has no signed release document for this car yet, so the driver would leave empty-handed.",
      reasons: holds ? ["papers_missing", "needs_the_customer"] : ["papers_missing", "needs_the_customer"],
      fact_ids: pickFacts(all, cf, /(release document|learned from|slot|hold)/i),
      new_facts: usedLessons.length ? [{ statement: "Asking ahead: the release document has to reach the workshop before the pickup day, as the accepted lesson says.", basis_fact_ids: usedLessons.map((l) => l.fact_id) }] : [],
      suggestion: { key: "ask_customer_for_release", label: "Ask the customer to have the seller e-mail the signed release document to the workshop", effect: "You send the message; the agent checks with the workshop the next morning and keeps the gig unpublished until it arrives.", changes: [{ kind: "customer_message", detail: "For this pickup the pickup place releases the car only after the seller's signed release document is e-mailed to their workshop (see the address they gave). Could you ask the seller to send it before the pickup day?", amount_eur: null }], draft: null, why_choices: [] },
      alternatives: [{ key: "pause_gig", label: "Hold the pickup until the seller clears it", effect: "No driver is sent; the agent checks with the pickup place again tomorrow.", changes: [{ kind: "booking", detail: "Keep the gig paused", amount_eur: null }], draft: null, why_choices: [] }],
      decide_by: decideBy, lesson_ids_used: usedLessons.map((l) => l.lesson_id),
    })], "tool_use")
  }

  if (has(/(comes back|ready for collection from|not ready|next week|only be ready|ready on)/i, said)) {
    return message([toolUse("propose_case", {
      order, type: "readiness.car_not_ready", headline: "The car is not at the pickup place for the selected slot; it will only be ready later.",
      reasons: ["car_not_ready", "moves_delivery_date", "needs_the_customer"], fact_ids: pickFacts(all, cf, /(slot|delivery promise|note|instruction)/i), new_facts: [],
      suggestion: { key: "move_pickup_next_day", label: "Ask the customer to move pickup and delivery to the day the car is ready", effect: "You send the message; once the customer agrees the agent moves the slot and tells the pickup place.", changes: [{ kind: "date", detail: "Pickup and delivery move to the day the pickup place named", amount_eur: null }, { kind: "customer_message", detail: "The pickup place tells us the car is not at the branch for the agreed slot and will be ready later. Can we move pickup and delivery to that day?", amount_eur: null }], draft: null, why_choices: [] },
      alternatives: [{ key: "keep_slot_call_again", label: "Keep the slot and ask the pickup place to bring the car back in time", effect: "The agent asks the pickup place and calls again tomorrow morning.", changes: [], draft: null, why_choices: [] }],
      decide_by: decideBy, lesson_ids_used: [],
    })], "tool_use")
  }

  if (has(/(not found|cannot confirm|can't confirm|checking|check both|call .* back|do not send|don't send)/i, said)) {
    const rule = ruleFor("pause_gig", "readiness.facts_disagree") ?? ruleFor("pause_gig", "readiness.keys_or_access")
    if (rule) {
      return message([toolUse("resolve_without_person", {
        order, type: rule.case_type, summary: "The pickup place still cannot say where the car and keys are; the gig is paused under the trust rule until they confirm.",
        checks: [{ label: "Pickup place asked today", ok: true, fact_ids: cf.map((f) => f.id) }],
        changes: [{ kind: "booking", detail: "Pause the gig until the pickup place confirms the collection point", amount_eur: null }], option_key: "pause_gig", trust_rule_id: rule.trust_rule_id,
      })], "tool_use")
    }
    return message([toolUse("propose_case", {
      order, type: "readiness.facts_disagree", headline: "The pickup place cannot confirm where the car and keys are, and the gig is still open to drivers.",
      reasons: ["facts_disagree"], fact_ids: pickFacts(all, cf, /(instruction|note|gig|alert)/i), new_facts: [],
      suggestion: { key: "pause_gig", label: "Pause the gig until the pickup place confirms", effect: "No driver can take it; the agent calls the pickup place again after their check.", changes: [{ kind: "booking", detail: "Pause the published gig", amount_eur: null }], draft: null, why_choices: [] },
      alternatives: [{ key: "keep_slot_call_again", label: "Keep the gig open and call again in an hour", effect: "Nothing changes now; the agent calls again in an hour.", changes: [], draft: null, why_choices: [] }],
      decide_by: decideBy, lesson_ids_used: [],
    })], "tool_use")
  }

  return message([toolUse("resolve_without_person", {
    order, type: "readiness.keys_or_access", summary: "The pickup place confirmed the pickup as planned; nothing needs to change.",
    checks: [{ label: "Pickup place confirmed by phone", ok: true, fact_ids: cf.map((f) => f.id) }],
    changes: [], option_key: "other", trust_rule_id: "",
  })], "tool_use")
}
