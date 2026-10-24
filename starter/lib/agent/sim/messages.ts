// Simulated written replies from a pickup place or a driver. Asking needs no
// yes (Bahn's rules), so these tools only pass the gate's "no commitments"
// check. Replies are simulated; the trace says so.

import type { Fact } from "@/lib/control-room/types"
import type { RunClock } from "../clock"
import type { Provider, Usage } from "../config"
import { activeAssignment, driver, LANGUAGE_NAMES, messagesFor, conversationsFor, str, type OrderRow } from "../data"
import type { FactRegistry } from "../facts"
import { structured } from "../providers"
import { personaFor } from "./places"

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "The written reply, in the writer's language" },
    translation: { type: "string", description: "The same reply in English" },
  },
  required: ["reply", "translation"],
  additionalProperties: false,
}

export interface MessageResult {
  delivered: boolean
  reply?: string
  translation?: string
  facts: Fact[]
  note: string
}

interface Ctx { provider: Provider; model: string; clock: RunClock; registry: FactRegistry; usage: Usage }

export async function messagePickupPlace(order: OrderRow, text: string, ctx: Ctx): Promise<MessageResult> {
  const persona = personaFor(order)
  const sentAt = ctx.clock.advance(30)
  if (!persona.answers) {
    return { delivered: true, facts: [], note: `Sent to ${persona.placeName} at ${sentAt}. No reply yet; a reply will show in the order's conversation.` }
  }
  const name = `${persona.placeName}, ${persona.contactName} (${persona.role})`
  let reply: string
  let translation: string
  if (ctx.provider === "mock") {
    const t = persona.truths.find((x) => x.source === "scenario") ?? persona.truths.find((x) => x.kind === "access")
    reply = t?.en ?? "Thanks, noted."
    translation = reply
  } else {
    const facts = persona.truths.map((t) => `- ${t.en}`).join("\n")
    const r = await structured<{ reply: string; translation: string }>(
      {
        provider: ctx.provider,
        model: ctx.model,
        system: `You are ${persona.contactName}, ${persona.role} at ${persona.placeName}. You answer a short written message from Bahn, a car delivery company, in ${LANGUAGE_NAMES[persona.language] ?? persona.language}. Two sentences at most. Only use what you know:\n${facts}`,
        prompt: `Bahn wrote: ${text}`,
        schema: REPLY_SCHEMA,
      },
      ctx.usage,
    )
    reply = r.reply
    translation = r.translation
  }
  const at = ctx.clock.advance(20 * 60)
  const fact = ctx.registry.add(`${persona.placeName} replied: "${translation}"`, { kind: "pickup_place", name, channel: "message", at }, "stated")
  return { delivered: true, reply, translation, facts: [fact], note: "Simulated reply from the pickup place." }
}

export async function messageDriver(order: OrderRow, text: string, ctx: Ctx): Promise<MessageResult> {
  const asg = activeAssignment(order.id)
  const d = driver(str(asg?.driver_id))
  if (!asg || !d) return { delivered: false, facts: [], note: "No driver is booked on this order yet, so there is nobody to ask." }
  ctx.clock.advance(30)
  const said = conversationsFor(order.id)
    .flatMap((c) => messagesFor(c.id))
    .filter((m) => m.author_type === "driver" && m.author_id === d.id)
    .map((m) => `- (${m.authored_at}) ${m.body}`)
    .slice(-5)
    .join("\n")
  let reply: string
  if (ctx.provider === "mock") {
    reply = "Got it. I will check and come back to you."
  } else {
    const r = await structured<{ reply: string; translation: string }>(
      {
        provider: ctx.provider,
        model: ctx.model,
        system: `You are ${d.display_name}, a freelance driver for Bahn on this gig (status ${asg.status}). You answer a short message in the driver app, in English, one or two sentences. What you said before:\n${said || "- nothing yet"}\nDo not invent your location; say you will check if you do not know.`,
        prompt: `Bahn wrote: ${text}`,
        schema: REPLY_SCHEMA,
      },
      ctx.usage,
    )
    reply = r.translation || r.reply
  }
  const at = ctx.clock.advance(8 * 60)
  const fact = ctx.registry.add(`Driver ${String(d.display_name).split(" ")[0]} replied: "${reply}"`, { kind: "driver", name: `Driver ${d.display_name}`, channel: "app", at }, "stated")
  return { delivered: true, reply, facts: [fact], note: "Simulated reply from the driver. A driver message is not a fresh location." }
}
