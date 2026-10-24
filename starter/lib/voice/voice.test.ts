// Tests for voice (Track 3). Run: npm run test:voice. No keys, no network, no credits:
// the routes run in mock mode (CR_VOICE_PROVIDER=mock) and the browser parts that
// matter (sentence feed, PCM decoding) are pure functions.
import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { POST as stt } from "../../app/api/cr/voice/stt/route"
import { POST as tts } from "../../app/api/cr/voice/tts/route"
import { GET as status } from "../../app/api/cr/voice/route"
import { Pcm16Decoder, SAMPLE_RATE, silentSeconds, silentWav } from "./pcm"
import { FIRST_CLAUSE_MIN, SentenceFeed, splitSentences, toSpeech } from "./sentences"
import { MAX_TEXT, MOCK_TRANSCRIPT, voiceMode, voiceStatus } from "./server"

const saved = { ...process.env }
beforeEach(() => {
  process.env.CR_VOICE_PROVIDER = "mock"
  process.env.CR_VOICE_MOCK_DELAY_MS = "0"
})
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
})

// ---------- sentences ----------

test("complete sentences are cut off, the unfinished rest waits", () => {
  const { pieces, rest } = splitSentences("The seller has not released the car. I suggest pausing the gig until they conf")
  assert.deepEqual(pieces, ["The seller has not released the car."])
  assert.equal(rest, " I suggest pausing the gig until they conf")
})

test("a stop without a following space is not an end yet (more may stream in)", () => {
  assert.deepEqual(splitSentences("Fuel is at 2.5 litres.").pieces, [])
  assert.deepEqual(splitSentences("See CD-420458.pdf now. Next").pieces, ["See CD-420458.pdf now."])
})

test("abbreviations and initials do not end a sentence", () => {
  assert.deepEqual(splitSentences("Ask the seller, e.g. Calverona Hamburg, first. Then").pieces, ["Ask the seller, e.g. Calverona Hamburg, first."])
  assert.deepEqual(splitSentences("Aino K. decided it. Then").pieces, ["Aino K. decided it."])
})

test("a long first clause may go at a comma so the first audio starts sooner", () => {
  const long = "Last time this happened at Calverona Hamburg in Germany, Aino paused the gig and"
  assert.ok(long.indexOf(",") >= FIRST_CLAUSE_MIN)
  assert.deepEqual(splitSentences(long, { first: true }).pieces, ["Last time this happened at Calverona Hamburg in Germany,"])
  assert.deepEqual(splitSentences(long).pieces, [], "only the first piece is cut at a comma")
  assert.deepEqual(splitSentences("Short, then more", { first: true }).pieces, [], "a short clause waits for the sentence")
})

test("the feed is idempotent for the same text and flushes the rest at the end", () => {
  const feed = new SentenceFeed()
  const answer = "It happened once. Aino paused the gig. It is your call"
  assert.deepEqual(feed.push(answer.slice(0, 20)), ["It happened once."])
  assert.deepEqual(feed.push(answer.slice(0, 20)), [], "same text twice gives nothing new (React effects run twice)")
  assert.deepEqual(feed.push(answer), ["Aino paused the gig."])
  assert.deepEqual(feed.finish(answer), ["It is your call"])
  assert.deepEqual(feed.finish(answer), [])
})

test("streamed in small deltas, the feed hands out every sentence exactly once", () => {
  const answer = "Last time, at Calverona Hamburg, Aino paused the gig. The seller confirmed within the hour.\nIt has happened once, so it is your call."
  const feed = new SentenceFeed()
  const out: string[] = []
  for (let n = 1; n <= answer.length; n += 3) out.push(...feed.push(answer.slice(0, n)))
  out.push(...feed.finish(answer))
  assert.equal(out.join(" ").replace(/\s+/g, " "), answer.replace(/\s+/g, " "))
  assert.ok(out.length >= 3)
})

test("markdown marks and bullets are not read aloud", () => {
  assert.equal(toSpeech("**Pause the gig** until the seller confirms ›"), "Pause the gig until the seller confirms")
  assert.equal(toSpeech("- Call [Calverona Hamburg](https://x.y) first"), "Call Calverona Hamburg first")
  assert.equal(toSpeech("1. Ask `Aino`"), "Ask Aino")
})

// ---------- PCM ----------

test("PCM decoding carries an odd byte across chunks", () => {
  const samples = [0, 16384, -16384, 32767, -32768]
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  samples.forEach((s, i) => view.setInt16(i * 2, s, true))
  const d = new Pcm16Decoder()
  const a = d.push(bytes.slice(0, 3)) // one sample and half of the next
  const b = d.push(bytes.slice(3))
  const all = [...a, ...b]
  assert.equal(all.length, samples.length)
  assert.deepEqual(all.map((x) => Math.round(x * 32768)), samples)
})

test("the silent stand-in lasts about as long as the text would", () => {
  assert.equal(silentSeconds(""), 0.6)
  assert.equal(silentSeconds("x".repeat(150)), 10)
  const wav = silentWav(1)
  assert.equal(wav.length, 44 + SAMPLE_RATE * 2)
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF")
})

// ---------- mode ----------

test("no key means mock; CR_VOICE_PROVIDER=mock forces it", () => {
  delete process.env.CR_VOICE_PROVIDER
  process.env.ELEVENLABS_API_KEY = ""
  process.env.CR_STARTER_ROOT = "/nonexistent" // no .env.local to fall back on
  assert.equal(voiceMode(), "mock")
  process.env.ELEVENLABS_API_KEY = "test-key-not-real"
  assert.equal(voiceMode(), "elevenlabs")
  process.env.CR_AGENT_PROVIDER = "mock"
  assert.equal(voiceMode(), "mock", "the agent's mock provider (tests) keeps voice silent too")
  process.env.CR_VOICE_PROVIDER = "elevenlabs"
  assert.equal(voiceMode(), "elevenlabs")
  process.env.CR_VOICE_PROVIDER = "mock"
  assert.equal(voiceMode(), "mock")
})

test("the status route never carries the key", async () => {
  delete process.env.CR_VOICE_PROVIDER
  process.env.ELEVENLABS_API_KEY = "sk_secret_value_123"
  const body = await (status() as Response).text()
  assert.ok(!body.includes("sk_secret_value_123"))
  assert.equal(JSON.parse(body).mode, "elevenlabs")
  assert.equal(voiceStatus().language, "en")
})

// ---------- routes in mock mode ----------

test("STT in mock mode returns the canned transcript", async () => {
  const res = await stt(new Request("http://x/api/cr/voice/stt", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: new Uint8Array(2000) }))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.text, MOCK_TRANSCRIPT)
  assert.equal(body.mode, "mock")
})

test("STT accepts multipart with file and refuses an empty recording", async () => {
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(1200)], { type: "audio/webm" }), "q.webm")
  const ok = await stt(new Request("http://x/api/cr/voice/stt", { method: "POST", body: form }))
  assert.equal(ok.status, 200)
  const empty = await stt(new Request("http://x/api/cr/voice/stt", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: new Uint8Array(0) }))
  assert.equal(empty.status, 400)
  assert.match((await empty.json()).error, /No audio/)
})

test("TTS in mock mode streams silent PCM of a natural length", async () => {
  const text = "The seller has not released the car."
  const res = await tts(new Request("http://x/api/cr/voice/tts", { method: "POST", body: JSON.stringify({ text }) }))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("x-voice-mode"), "mock")
  assert.match(res.headers.get("content-type") ?? "", /audio\/L16;rate=22050/)
  const bytes = new Uint8Array(await res.arrayBuffer())
  assert.equal(bytes.length, Math.round(silentSeconds(text) * SAMPLE_RATE) * 2)
  assert.ok(bytes.every((b) => b === 0))
})

test("TTS as wav for a plain player, and refusals in plain words", async () => {
  const wav = await tts(new Request("http://x/api/cr/voice/tts", { method: "POST", body: JSON.stringify({ text: "Hello", format: "wav" }) }))
  assert.equal(wav.headers.get("content-type"), "audio/wav")
  const empty = await tts(new Request("http://x/api/cr/voice/tts", { method: "POST", body: JSON.stringify({ text: "  " }) }))
  assert.equal(empty.status, 400)
  const long = await tts(new Request("http://x/api/cr/voice/tts", { method: "POST", body: JSON.stringify({ text: "a".repeat(MAX_TEXT + 1) }) }))
  assert.equal(long.status, 413)
  const bad = await tts(new Request("http://x/api/cr/voice/tts", { method: "POST", body: "not json" }))
  assert.equal(bad.status, 400)
})
