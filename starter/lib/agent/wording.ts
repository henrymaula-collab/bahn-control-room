// Today's wording for text the agent recorded earlier. The traces in traces/
// stay as the model wrote them; replay passes every recorded string through
// plainWords() before it reaches the control room, so a recording made with
// an older prompt never shows words the prompt has since dropped. The prompt
// (prompt.ts) and the tool texts (tools.ts, gate.ts) say the same thing for
// new runs.
//
// Today: a trust rule is "on" in lower case ("the ON rule" read like a code).

const REWRITES: [RegExp, string][] = [
  [/\b(the|an|a) ON trust rule\b/g, "the trust rule"],
  [/\b(the|an|a) ON rule\b/g, "the trust rule"],
  [/\(ON, turned on by /g, "(turned on by "],
  [/\(ON\)/g, "(on)"],
  [/\bnone is ON\b/g, "none is on"],
  [/\bis not ON\b/g, "is not on"],
  [/\bno ON trust rule\b/g, "no trust rule that is on"],
  [/\bON\b/g, "on"],
]

/** One recorded string in today's wording. */
export function plainWords(text: string): string {
  let out = text
  for (const [pattern, to] of REWRITES) out = out.replace(pattern, to)
  return out
}

/** Every string inside a recorded value (a trace line, a case, a run), in today's wording. */
export function plainWordsDeep<T>(value: T): T {
  if (typeof value === "string") return plainWords(value) as T
  if (Array.isArray(value)) return value.map((item) => plainWordsDeep(item)) as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = plainWordsDeep(item)
    return out as T
  }
  return value
}
