// Render simulated calls to mp3 with ElevenLabs (separate from running the agent).
//
//   npm run calls:render -- --dry                 list what would be rendered and the characters
//   npm run calls:render -- --call <callId>       one call (test model, about half the credits)
//   npm run calls:render -- --order CD-420458     the newest call for one order
//   npm run calls:render -- --final ...           the best multilingual model, for the demo
//
// Calls come from the recorded traces (and the local store). Turns are cached
// by model + voice + text, so an unchanged call costs nothing the second time.

import { config } from "dotenv"
config({ path: ".env.local", override: true, quiet: true })

import type { Call } from "../lib/control-room/types"
import { closeStore, getStore, initStore } from "../lib/agent/store"
import { listTraces, readTrace } from "../lib/agent/trace"
import { FINAL_MODEL, pickVoices, renderCall, TEST_MODEL } from "../lib/agent/voices"

const args = process.argv.slice(2)
const flag = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined)

function callsFromTraces(): { call: Call; orderRef: string; provider: string; at: number }[] {
  const out: { call: Call; orderRef: string; provider: string; at: number }[] = []
  for (const t of listTraces()) {
    for (const l of readTrace(t.file)) if (l.type === "call") out.push({ call: l.call, orderRef: t.orderRef, provider: t.provider, at: t.recordedAt })
  }
  return out
}

async function main() {
  await initStore(flag("--store"))
  const store = getStore()
  const model = args.includes("--final") ? FINAL_MODEL : process.env.CR_TTS_MODEL ?? TEST_MODEL
  const fromTraces = callsFromTraces()
  const local = (await store.listCalls()).map((call) => ({ call, orderRef: "", provider: "store", at: 0 }))
  const all = [...fromTraces, ...local.filter((l) => !fromTraces.some((t) => t.call.id === l.call.id))]
  let chosen = all.filter((c) => c.call.outcome === "answered" && c.call.turns.length > 0)
  const id = flag("--call")
  const order = flag("--order")
  if (id) chosen = chosen.filter((c) => c.call.id === id)
  if (order) chosen = chosen.filter((c) => c.orderRef.toUpperCase() === order.toUpperCase()).sort((a, b) => b.at - a.at).slice(0, 1)
  if (!id && !order && !args.includes("--all")) {
    console.log("Calls you can render (pass --call <id>, --order <ref> or --all):")
    for (const c of all) console.log(`  ${c.call.id}  ${c.orderRef}  ${c.call.language}  ${c.call.outcome}  ${c.call.turns.length} turns  ${c.call.turns.reduce((n, t) => n + t.text.length, 0)} chars  (${c.provider})`)
    return
  }
  for (const { call } of chosen) {
    const chars = call.turns.reduce((n, t) => n + t.text.length, 0)
    if (args.includes("--dry")) {
      const v = await pickVoices(call.language)
      console.log(`${call.id}  ${call.language}  ${chars} chars  model ${model}  voices: Bahn "${v.agent.name}", pickup place "${v.pickup_place.name}"`)
      continue
    }
    const t = await renderCall(call, { model })
    await store.saveCall({ ...call, audioUrl: t.audioUrl })
    console.log(`${call.id}  ${t.durationSec}s  model ${t.model}  sent ${t.renderedCharacters} of ${t.characters} chars  voices: Bahn "${t.voices.agent}", pickup place "${t.voices.pickup_place}"  -> public${t.audioUrl}`)
  }
}

main()
  .then(() => closeStore())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e)
    await closeStore().catch(() => {})
    process.exit(1)
  })
