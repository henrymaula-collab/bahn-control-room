// Try the case chat without a browser.
//   npx tsx scripts/chat.ts CD-420458 --person p-emil                 the thread (knowledge + opener)
//   npx tsx scripts/chat.ts CD-420458 --person p-emil "Why not wait?"  one turn, events as they stream
//   flags: --provider mock|api|claude-code, --voice, --clear (start the thread over), --json
import "dotenv/config"

async function main() {
  const args = process.argv.slice(2)
  const flag = (name: string, takesValue = false) => {
    const i = args.indexOf(`--${name}`)
    if (i < 0) return undefined
    const v = takesValue ? args[i + 1] : "true"
    args.splice(i, takesValue ? 2 : 1)
    return v
  }
  const person = flag("person", true) ?? "p-aino"
  const provider = flag("provider", true)
  const voice = flag("voice")
  const clear = flag("clear")
  const json = flag("json")
  const [caseId, ...words] = args
  if (!caseId) throw new Error("Usage: scripts/chat.ts <case id or CD-reference> --person p-emil [question]")
  const { clearThread, getThread, prepareTurn } = await import("@/lib/chat/service")
  if (clear) console.log(await clearThread(caseId, person))
  const text = words.join(" ").trim()
  if (!text) {
    const r = await getThread(caseId, person)
    if (!r.ok) throw new Error(r.error)
    if (json) console.log(JSON.stringify(r.thread, null, 1))
    else {
      const k = r.thread.knowledge
      console.log(`${r.thread.caseId}  kind: ${k.kindLabel} (${k.novelty}), ${k.decided} decided, ${k.sameAsSuggestion} same as suggestion, ${k.peopleCount} people, needed ${k.needed}  opener: ${r.variant}`)
      console.log(r.thread.opener.text)
      console.log(`${r.thread.messages.length} earlier messages`)
    }
  } else {
    const prep = await prepareTurn(caseId, { person, text, via: voice ? "voice" : "text", provider })
    if (!prep.ok) throw new Error(prep.error)
    const t0 = Date.now()
    let first = 0
    await prep.turn((e) => {
      if (e.type === "delta") {
        if (!first) first = Date.now() - t0
        process.stdout.write(e.text)
      } else if (e.type === "tool") console.log(`  [${e.step.status}] ${e.step.label}`)
      else if (e.type === "done") console.log(`\n-- done (${prep.provider}, first text after ${first} ms, all ${Date.now() - t0} ms), ${e.message.toolSteps?.length ?? 0} steps`)
      else console.log(`-- ${e.type}${"message" in e && typeof e.message === "string" ? `: ${e.message}` : ""}`)
    })
  }
  const { closeCrDb } = await import("@/lib/control-room/db")
  await closeCrDb()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
