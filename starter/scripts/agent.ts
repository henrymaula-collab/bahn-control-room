// CLI for the Readiness desk agent.
//
//   npm run agent -- CD-420516                       run the agent on one order
//   npm run agent -- CD-420516 --provider mock       claude-code (default) | api | mock | replay
//   npm run agent -- --callback <caseId> <optionId> [--person aino] [--why "..."] [--edit "..."]
//   npm run agent -- --accept-lesson <lessonId> [--by mikko]
//   npm run agent -- --trust-rule <ruleId> on|off [--by mikko]
//   npm run agent -- --seed-demo                     local store only: the suggested Arvelano rule
//   npm run agent -- --list                          cases, lessons, trust rules, runs
//   npm run agent -- --replay <runId>                play a recorded trace back
//   npm run agent -- --reset                         clear the local store (.cr-data)

import { config } from "dotenv"
config({ path: ".env.local", override: true, quiet: true })

import type { Call, Case, Fact } from "../lib/control-room/types"
import { carryOutDecision, decideAndCarryOut, reviewLesson } from "../lib/agent/callback"
import { registerAgentHooks } from "../lib/agent/hooks"
import { agentModel, effectiveProvider, type Provider } from "../lib/agent/config"
import { findOrder, LANGUAGE_NAMES, site } from "../lib/agent/data"
import { runReadinessAgent, replayTrace, type RunResult } from "../lib/agent/loop"
import { closeStore, getStore, initStore, resetLocalStore, type StoredRun } from "../lib/agent/store"
import { appendTrace, listTraces } from "../lib/agent/trace"
import type { TrustRule } from "../lib/agent/gate"

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (name: string) => args.includes(name)

const dim = (s: string) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s)
const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s)
const hhmm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const short = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function printStep(step: StoredRun["steps"][number]) {
  const t = dim(hhmm(step.at))
  switch (step.type) {
    case "thinking":
      console.log(`  ${t}  ${dim(`thinking  ${short(step.content.replace(/\s+/g, " "), 220)}`)}`)
      break
    case "tool_call": {
      let a = step.content
      try {
        const o = JSON.parse(step.content) as Record<string, unknown>
        delete o.order
        a = Object.keys(o).length ? short(JSON.stringify(o), 140) : ""
      } catch {
        // keep raw
      }
      console.log(`  ${t}  ${bold(step.name ?? "tool")} ${dim(a)}`)
      break
    }
    case "tool_result": {
      let line = short(step.content.replace(/\s+/g, " "), 140)
      try {
        const o = JSON.parse(step.content) as Record<string, unknown>
        if (o.error) line = `refused: ${String(o.error)}`
        else if (Array.isArray(o.facts)) line = `${o.facts.length} fact(s)${o.summary ? `. ${String(o.summary)}` : ""}`
        else if (Array.isArray(o.conversations)) line = `${o.conversations.length} conversation(s), ${(o.conversations as { messages: unknown[] }[]).reduce((n, c) => n + c.messages.length, 0)} message(s)`
        else if (Array.isArray(o.rules)) line = `${o.rules.length} rule(s)${(o.rules as { status: string }[]).some((r) => r.status === "on") ? ", ON: " + (o.rules as { status: string; trust_rule_id: string }[]).filter((r) => r.status === "on").map((r) => r.trust_rule_id).join(", ") : ", none ON"}`
        else if (o.case_id) line = `case ${String(o.case_id)} (${String(o.status ?? (o.handled_under_rule ? "handled_by_agent" : "resolved"))})`
        else if (o.resolved) line = "resolved"
      } catch {
        // keep raw
      }
      console.log(`  ${t}  ${dim(`  -> ${line}`)}`)
      break
    }
    case "message":
      if (step.name === "brief") console.log(`  ${t}  ${dim(short(step.content.replace(/\s+/g, " "), 200))}`)
      else console.log(`  ${t}  ${step.content}`)
      break
  }
}

function printCall(call: Call) {
  const lang = LANGUAGE_NAMES[call.language] ?? call.language
  console.log(`\n${bold("Call")} ${call.id}  ${lang}, ${call.outcome}, ${call.turns.length} turns${call.audioUrl ? `, audio ${call.audioUrl}` : ""}`)
  for (const t of call.turns) {
    const who = t.speaker === "agent" ? "Bahn         " : "Pickup place "
    console.log(`  ${dim(hhmm(t.at))}  ${who} ${t.text}`)
    if (t.translation) console.log(`  ${" ".repeat(5)}  ${" ".repeat(13)} ${dim(`Translated: ${t.translation}`)}`)
  }
}

function factLine(f: Fact) {
  return `${f.statement}  ${dim(`(${f.source.name ?? f.source.kind}, ${f.source.channel ?? "record"}, ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(f.source.at))}, ${f.strength})`)}`
}

function printCase(c: Case) {
  const place = site(c.placeId)?.name
  console.log(`\n${bold("Case")} ${c.id}  ${c.type}  ${c.status}${place ? `  at ${place}` : ""}`)
  console.log(`  ${bold(c.headline)}`)
  if (c.decideBy) console.log(`  Decide by ${c.decideBy.replace("T", " ").slice(0, 16)} UTC`)
  console.log(`  Why a person: ${c.reasons.join(", ") || "none"}`)
  console.log("  What the agent found:")
  for (const f of c.facts) console.log(`    - ${factLine(f)}`)
  console.log(`  Suggestion: ${bold(c.suggestion.label)}  [${c.suggestion.id}]`)
  console.log(`    ${c.suggestion.effect}`)
  for (const ch of c.suggestion.changes) console.log(`    change ${ch.kind}: ${ch.detail}${ch.amountEur !== undefined ? ` (EUR ${ch.amountEur})` : ""}`)
  for (const o of c.alternatives) {
    console.log(`  Other option: ${o.label}  [${o.id}]`)
    console.log(`    ${dim(o.effect)}`)
  }
  if (c.lessonIdsUsed?.length) console.log(`  Lessons used: ${c.lessonIdsUsed.join(", ")}`)
}

function printResult(r: RunResult) {
  for (const call of r.calls) printCall(call)
  if (r.case) printCase(r.case)
  const u = r.run.usage
  console.log(`\n${bold("Outcome")} ${r.run.outcome}${r.run.caseId ? `  case ${r.run.caseId}` : ""}`)
  if (r.handover) console.log(`  ${r.handover}`)
  if (u) console.log(dim(`  tokens in ${u.inputTokens} (cache read ${u.cacheReadTokens}, write ${u.cacheWriteTokens}), out ${u.outputTokens}, about USD ${u.usd.toFixed(4)}`))
  console.log(dim(`  trace ${r.traceFile}`))
}

function providerArg(): Provider | undefined {
  const p = flag("--provider")
  return p ? (p as Provider) : undefined
}

async function main() {
  const kind = await initStore(flag("--store"))
  const store = getStore()
  console.log(dim(`Store: ${kind === "foundation" ? "control room tables (Postgres)" : "local files (.cr-data)"}`))
  if (has("--reset")) {
    resetLocalStore()
    console.log("Local agent store cleared.")
    return
  }
  if (has("--seed-demo")) {
    if (kind === "foundation") throw new Error("The foundation seeds its own trust rules (npm run db:seed:cr). --seed-demo is for the local store (--store local).")
    const rule: TrustRule = {
      id: "rule-readiness_facts_disagree-site-047-pause_gig",
      caseType: "readiness.facts_disagree",
      scope: { placeId: "site-047" },
      when: "At Arvelano Hamburg, the order notes and the pickup place disagree about where to collect the car",
      then: "Pause the gig until the pickup place confirms",
      evidence: { matched: 13, total: 14, caseIds: [] },
      status: "suggested",
      optionId: "pause_gig",
    }
    await store.saveTrustRule(rule)
    console.log(`Saved the suggested rule ${rule.id} to the local store (as the foundation seeds it).`)
    return
  }
  if (has("--list")) {
    const [cases, lessons, rules, runs] = await Promise.all([store.listCases(), store.listLessons(), store.listTrustRules(), store.listRuns()])
    console.log(bold("Cases"))
    for (const c of cases) console.log(`  ${c.id}  ${c.status}  ${c.type}  ${short(c.headline, 90)}  options: ${[c.suggestion, ...c.alternatives].map((o) => o.id).join(", ")}`)
    console.log(bold("Lessons"))
    for (const l of lessons) console.log(`  ${l.id}  ${l.status}  ${short(l.text, 120)}`)
    console.log(bold("Trust rules"))
    for (const r of rules) console.log(`  ${r.id}  ${r.status}  ${r.when} -> ${r.then}`)
    console.log(bold("Runs"))
    for (const r of runs) console.log(`  ${r.id}  ${r.mode}  ${r.model}  ${r.outcome}${r.caseId ? `  ${r.caseId}` : ""}`)
    console.log(bold("Recorded traces"))
    for (const t of listTraces()) console.log(`  ${t.runId}  ${t.provider}  ${t.outcome}`)
    return
  }
  if (has("--accept-lesson")) {
    const id = flag("--accept-lesson")!
    const by = flag("--by") ?? "p-kaisa"
    if (kind === "foundation") {
      const { reviewLessonById } = await import("../lib/control-room/service")
      const l = await reviewLessonById(id, true, by)
      if (!l) throw new Error(`No lesson ${id}`)
      console.log(`Accepted ${l.id}: ${l.text}`)
    } else {
      const l = await reviewLesson(id, true, by)
      console.log(`Accepted ${l.id}: ${l.text}`)
    }
    return
  }
  if (has("--trust-rule")) {
    const id = flag("--trust-rule")!
    const state = args[args.indexOf("--trust-rule") + 2] as "on" | "off"
    if (!["on", "off"].includes(state)) throw new Error("Usage: --trust-rule <ruleId> on|off")
    if (kind === "foundation") {
      const { setTrustRule } = await import("../lib/control-room/service")
      if (!(await setTrustRule(id, state, flag("--by") ?? "p-kaisa"))) throw new Error(`No trust rule ${id}`)
    } else {
      const rule = (await store.listTrustRules()).find((r) => r.id === id)
      if (!rule) throw new Error(`No trust rule ${id}`)
      await store.saveTrustRule({ ...rule, status: state, changedBy: flag("--by") ?? "p-kaisa", changedAt: new Date().toISOString() })
    }
    console.log(`Trust rule ${id} is now ${state}.`)
    return
  }
  if (has("--replay")) {
    const id = flag("--replay")!
    const t = listTraces().find((x) => x.runId === id || x.file.endsWith(id))
    if (!t) throw new Error(`No trace ${id}`)
    console.log(`${bold("Replay")} ${t.runId}  ${t.orderRef}  recorded with ${t.provider} (${t.model})`)
    printResult(await replayTrace(t.file, { onStep: printStep, delayMs: 40 }))
    return
  }
  if (has("--callback")) {
    const i = args.indexOf("--callback")
    const caseId = args[i + 1]
    const optionId = args[i + 2]
    if (!caseId || !optionId) throw new Error("Usage: --callback <caseId> <optionId>")
    const provider = providerArg()
    const personId = flag("--person") ?? "p-aino"
    console.log(`${bold("Decision")} ${caseId}: ${optionId} by ${personId}  (${effectiveProvider(provider)})`)
    if (kind === "foundation") {
      // The foundation records the decision and proposes the lesson (with our summariser); the agent carries it out.
      registerAgentHooks()
      const { decide } = await import("../lib/control-room/service")
      const res = await decide({ caseId, optionId, personId, why: flag("--why"), editedDetail: flag("--edit") })
      if ("error" in res) throw new Error(String(res.error))
      const carried = await carryOutDecision(res.case, res.decision, provider)
      appendTrace(carried.traceFile, [{ type: "decision", decision: res.decision }, { type: "lesson", lesson: res.lesson }])
      for (const s of carried.run.steps) printStep(s)
      printResult(carried)
      console.log(`\n${bold("Lesson proposed")} ${res.lesson.id}: ${res.lesson.text}`)
      console.log(dim(`  accept it with: npm run agent -- --accept-lesson ${res.lesson.id}`))
      return
    }
    const res = await decideAndCarryOut({ caseId, optionId, personId, why: flag("--why"), editedDetail: flag("--edit"), provider })
    for (const s of res.carriedOut.run.steps) printStep(s)
    printResult(res.carriedOut)
    console.log(`\n${bold("Lesson proposed")} ${res.lesson.id}: ${res.lesson.text}`)
    console.log(dim(`  accept it with: npm run agent -- --accept-lesson ${res.lesson.id}`))
    return
  }
  const ref = args.find((a) => /^CD-\d+$/i.test(a) || /^ord-\d+$/i.test(a))
  if (!ref) {
    console.log("Usage: npm run agent -- CD-420516 [--provider claude-code|api|mock|replay]")
    process.exit(1)
  }
  const order = findOrder(ref)
  if (!order) throw new Error(`No order ${ref}`)
  const provider = effectiveProvider(providerArg())
  console.log(dim("Times are Helsinki time. Dataset clock unless CR_CLOCK=real."))
  console.log(`${bold("Readiness agent")}  ${order.reference}  ${dim(`${provider}${provider === "mock" || provider === "replay" ? "" : `, ${agentModel()}`}`)}`)
  const res = await runReadinessAgent(order.reference, { provider, onStep: printStep })
  printResult(res)
}

main()
  .then(() => closeStore())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e)
    await closeStore().catch(() => {})
    process.exit(1)
  })
