// Turning the agent's streamed answer into pieces worth speaking.
// The chat streams text deltas; voice speaks a sentence as soon as it is
// complete, so the first audio starts while Claude is still writing. Pure
// functions, shared by the browser hook and the tests.

/** Abbreviations whose full stop does not end a sentence. Lower case, without the dot. */
const ABBREVIATIONS = new Set(["e.g", "i.e", "etc", "approx", "no", "nr", "vs", "mr", "mrs", "ms", "dr", "st", "ca", "incl", "min", "max"])

/** A first piece longer than this may be cut at a comma so the first audio comes sooner. */
export const FIRST_CLAUSE_MIN = 48

export interface Split {
  pieces: string[] // complete pieces, in order, ready to speak
  rest: string // text that may still grow
}

function endsSentenceAt(text: string, i: number): boolean {
  const ch = text[i]
  if (ch === "\n") return true
  if (ch !== "." && ch !== "!" && ch !== "?") return false
  const next = text[i + 1]
  // Needs a following space or newline: "2.5", "CD-420458.pdf" and a stop at the very end (more may follow) stay whole.
  if (next === undefined || !/\s/.test(next)) return false
  if (ch === ".") {
    const word = /([A-Za-z][A-Za-z.]*)$/.exec(text.slice(Math.max(0, i - 12), i))?.[1]?.toLowerCase()
    if (word && ABBREVIATIONS.has(word)) return false
    // A single capital letter before the stop is an initial ("Aino K. decided").
    if (word && word.length === 1 && /[A-Z]/.test(text[i - 1] ?? "")) return false
  }
  return true
}

/**
 * Cut the complete sentences off the front of `text`.
 * With `first` set, a long opening clause may end at a comma, semicolon or colon,
 * so the first piece can go to speech before the whole sentence is written.
 */
export function splitSentences(text: string, opts: { first?: boolean } = {}): Split {
  const pieces: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const clauseCut = opts.first && pieces.length === 0 && i - start >= FIRST_CLAUSE_MIN && /[,;:]/.test(text[i]!) && /\s/.test(text[i + 1] ?? "")
    if (endsSentenceAt(text, i) || clauseCut) {
      const piece = text.slice(start, i + 1).trim()
      if (speakable(piece)) pieces.push(piece)
      start = i + 1
    }
  }
  return { pieces, rest: text.slice(start) }
}

/** True when a piece has something to say (not just punctuation or markup). */
export function speakable(piece: string): boolean {
  return /[\p{L}\p{N}]/u.test(piece)
}

/**
 * Plain spoken text from the agent's written text: no markdown marks, no link
 * targets, no list bullets. Words stay as they are (Bahn's words).
 */
export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/(\*\*|__|\*|_)(\S[^*_]*?)\1/g, "$2")
    .replace(/[›»→]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Feeds a growing answer and hands out what can be spoken. `push(textSoFar)` is
 * idempotent for the same text (safe in React effects); `finish()` flushes the rest.
 */
export class SentenceFeed {
  private consumed = 0
  private emitted = 0

  push(textSoFar: string): string[] {
    if (textSoFar.length < this.consumed) return [] // the text was replaced; the caller starts a new feed
    const { pieces, rest } = splitSentences(textSoFar.slice(this.consumed), { first: this.emitted === 0 })
    this.consumed = textSoFar.length - rest.length
    const out = pieces.map(toSpeech).filter(speakable)
    this.emitted += out.length
    return out
  }

  finish(textSoFar: string): string[] {
    const out = this.push(textSoFar)
    const rest = toSpeech(textSoFar.slice(this.consumed))
    this.consumed = textSoFar.length
    if (speakable(rest)) {
      out.push(rest)
      this.emitted++
    }
    return out
  }
}
