// The night lab's slots and URL params. Plain module: the proxy, server pages and client
// components all read it. See CONTRACT.md.

export const SLOTS = ["needs", "card", "welcome", "chat", "decide", "situation", "map", "menu", "rows", "rule"] as const
export type Slot = (typeof SLOTS)[number]

/** The Desktop image folder per slot (~/Desktop/Bahn-lab-bilder/<folder>/). */
export const SLOT_FOLDERS: Record<Slot, string> = {
  needs: "01-needs-you",
  card: "02-beslutskortet",
  welcome: "03-valkomstpanelen",
  chat: "04-chatten",
  decide: "05-beslutet",
  situation: "06-situationen",
  map: "07-kartan",
  menu: "08-menyn",
  rows: "09-raderna",
  rule: "10-regeln",
}

export const isSlot = (s: string): s is Slot => (SLOTS as readonly string[]).includes(s)

/** `?v=card:07,needs:03` -> { card: "07", needs: "03" }. Unknown slots are ignored. */
export function parseV(v: string | null | undefined): Partial<Record<Slot, string>> {
  const out: Partial<Record<Slot, string>> = {}
  for (const pair of (v ?? "").split(",")) {
    const [slot, nn] = pair.split(":").map((x) => x.trim())
    if (slot && nn && isSlot(slot)) out[slot] = nn.padStart(2, "0")
  }
  return out
}

/** Params that move a page into a photographable state. Every one is optional; none = today. */
export type LabState = {
  v: Partial<Record<Slot, string>>
  many: number // ?many=12|40: pad the person's Needs you with other real cases and red orders
  panel?: "situation" | "chat" | "email" | "none" // ?panel=: the side panel open on first paint
  chat?: "thread" | "thinking" | "offer" // ?chat=: the fixture conversation (CD-420458 only)
  others: boolean // ?others=open: the "Other tasks" row (needs) open
  why: boolean // ?why=open: "Why it came to you" open
  sheet: boolean // ?sheet=open: the Other options sheet open
  decided: boolean // ?decided=1: the card right after a yes to the suggestion (nothing saved)
  rule: boolean // ?rule=1 or any v=rule:nn: Kaisa's trust-rule proposal in her Your tasks
  ruleState?: "on" // ?rulestate=on: the proposal shown as turned on (nothing saved)
}

/** The params that must survive a move between cases (J/K, Other tasks, Next case). */
export const KEEP_PARAMS = ["v", "many", "rule"] as const

export function labStateOf(get: (k: string) => string | null | undefined): LabState {
  const v = parseV(get("v"))
  const many = Math.max(0, Math.min(80, Number(get("many") ?? 0) || 0))
  const panel = get("panel")
  const chat = get("chat")
  return {
    v,
    many,
    panel: panel === "situation" || panel === "chat" || panel === "email" || panel === "none" ? panel : undefined,
    chat: chat === "thread" || chat === "thinking" || chat === "offer" ? chat : undefined,
    others: get("others") === "open",
    why: get("why") === "open",
    sheet: get("sheet") === "open",
    decided: get("decided") === "1",
    rule: get("rule") === "1" || !!v.rule,
    ruleState: get("rulestate") === "on" ? "on" : undefined,
  }
}

/** "?v=card:07&many=12" from a search string, keeping only KEEP_PARAMS ("" when none). */
export function keepQuery(search: URLSearchParams | null | undefined, base = ""): string {
  const q = new URLSearchParams(base.replace(/^\?/, ""))
  for (const k of KEEP_PARAMS) {
    const val = search?.get(k)
    if (val) q.set(k, val)
  }
  const s = q.toString()
  return s ? `?${s}` : ""
}

/** The trust-rule proposal's place in Kaisa's Your tasks (slot `rule`). */
export const RULE_ITEM_PREFIX = "rule-"
/** Padding rows for red orders that have no case yet (?many=): they open the order. */
export const PAD_ORDER_PREFIX = "lab-order-"

/** Request header the proxy sets with the page's own search string, for layouts (they get no searchParams). */
export const LAB_HEADER = "x-cr-lab-search"
