// Server side of voice: the ElevenLabs key never leaves this module.
// Speech to text: Scribe v2 (batch; a push-to-talk clip is a few seconds).
// Text to speech: a low-latency model streaming raw PCM, so the browser can
// play the first sentence while the rest is still being made.
// Mock: a canned transcript and silent audio of a natural length, so the UI
// works on a fresh clone without keys. Never log, echo or return the key.

import fs from "node:fs"
import path from "node:path"
import { SAMPLE_RATE, silentSeconds, silentWav } from "./pcm"
import type { SpeechRequest, Transcript, VoiceMode, VoiceStatus } from "./types"

const API = "https://api.elevenlabs.io"
export const STT_MODEL = "scribe_v2"
/** Measured 24 Oct: first byte 179 to 312 ms (eleven_flash_v2_5: 205 to 695 ms), both 0.5 credits a character. */
export const DEFAULT_TTS_MODEL = "eleven_v4_turbo"
export const TTS_MODELS = ["eleven_v4_turbo", "eleven_flash_v2_5", "eleven_turbo_v2_5"] as const
/** "Sapphire", the voice Bahn's agent already speaks with in the rendered calls; a premade voice if the account lacks it. */
export const DEFAULT_VOICE = { id: "tpS5zOAgWUiQMhzYbG2h", name: "Sapphire" }
const FALLBACK_VOICE = { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" } // premade, every account has it
export const MAX_TEXT = 600 // characters per speech request (a few sentences)
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024 // about a minute of compressed speech
export const MOCK_TRANSCRIPT = "What did people do the last time this happened?"

/** Characters this server process may send to text to speech; protects the shared credits from a runaway loop. */
const BUDGET = Number(process.env.CR_VOICE_MAX_CHARS ?? 12000)
let spent = 0

export function elevenLabsKey(): string | null {
  const k = process.env.ELEVENLABS_API_KEY?.trim()
  if (k) return k
  try {
    const file = fs.readFileSync(path.join(process.env.CR_STARTER_ROOT ?? process.cwd(), ".env.local"), "utf8")
    return /^ELEVENLABS_API_KEY=(\S+)/m.exec(file)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * mock when CR_VOICE_PROVIDER=mock, when the agent runs on the mock provider (tests),
 * or when there is no key; elevenlabs otherwise.
 */
export function voiceMode(): VoiceMode {
  const raw = process.env.CR_VOICE_PROVIDER?.trim().toLowerCase()
  if (raw === "mock") return "mock"
  if (raw !== "elevenlabs" && process.env.CR_AGENT_PROVIDER?.trim().toLowerCase() === "mock") return "mock"
  return elevenLabsKey() ? "elevenlabs" : "mock"
}

function voice() {
  const id = process.env.CR_VOICE_ID?.trim()
  return id ? { id, name: process.env.CR_VOICE_NAME?.trim() || id } : DEFAULT_VOICE
}

function ttsModel(requested?: string): string {
  const fromEnv = process.env.CR_TTS_VOICE_MODEL?.trim()
  if (requested && (TTS_MODELS as readonly string[]).includes(requested)) return requested
  return fromEnv || DEFAULT_TTS_MODEL
}

/** The language transcripts are held to: English by default (the control room's language); CR_VOICE_LANGUAGE=auto detects. */
function language(): string | null {
  const raw = process.env.CR_VOICE_LANGUAGE?.trim().toLowerCase()
  if (raw === "auto") return null
  return raw || "en"
}

export function voiceStatus(): VoiceStatus {
  const mode = voiceMode()
  return { mode, sttModel: mode === "mock" ? "mock" : STT_MODEL, ttsModel: mode === "mock" ? "mock" : ttsModel(), voice: mode === "mock" ? "silent stand-in" : voice().name, sampleRate: SAMPLE_RATE, language: language() }
}

export class VoiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** An upstream failure in plain words, without the body (which could carry request details). */
function upstream(what: string, status: number): VoiceError {
  if (status === 401) return new VoiceError(`${what}: the speech service refused the key.`, 502)
  if (status === 429) return new VoiceError(`${what}: the speech service is busy or out of credits. Try again in a moment.`, 503)
  return new VoiceError(`${what}: the speech service answered ${status}.`, 502)
}

export async function transcribe(audio: Blob, opts: { language?: string | null } = {}): Promise<Transcript> {
  if (audio.size === 0) throw new VoiceError("No audio was recorded.", 400)
  if (audio.size > MAX_AUDIO_BYTES) throw new VoiceError("The recording is too long. Keep a question under a minute.", 413)
  const t0 = performance.now()
  if (voiceMode() === "mock") {
    await new Promise((r) => setTimeout(r, Number(process.env.CR_VOICE_MOCK_DELAY_MS ?? 250)))
    return { text: process.env.CR_VOICE_MOCK_TRANSCRIPT?.trim() || MOCK_TRANSCRIPT, language: "en", mode: "mock", ms: Math.round(performance.now() - t0) }
  }
  const lang = opts.language === undefined ? language() : opts.language
  const form = new FormData()
  const ext = /mp4|m4a|aac/.test(audio.type) ? "m4a" : /wav/.test(audio.type) ? "wav" : /ogg/.test(audio.type) ? "ogg" : "webm"
  form.append("file", audio, `question.${ext}`)
  form.append("model_id", STT_MODEL)
  if (lang) form.append("language_code", lang)
  form.append("tag_audio_events", "false") // no "(laughter)" in what the agent reads
  form.append("timestamps_granularity", "none")
  form.append("no_verbatim", "true") // no "um", no false starts
  const res = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": elevenLabsKey()! }, body: form })
  if (!res.ok) throw upstream("Speech to text", res.status)
  const body = (await res.json()) as { text?: string; language_code?: string }
  return { text: (body.text ?? "").trim(), language: body.language_code ?? lang, mode: "elevenlabs", ms: Math.round(performance.now() - t0) }
}

export interface Speech {
  body: ReadableStream<Uint8Array>
  contentType: string
  mode: VoiceMode
  model: string
  firstByteMs?: number
}

/** A stream of silence: PCM chunks paced like real speech would arrive, or one WAV. */
function silence(text: string, format: "pcm" | "mp3" | "wav"): ReadableStream<Uint8Array> {
  const seconds = silentSeconds(text)
  if (format !== "pcm") {
    const wav = silentWav(seconds)
    return new ReadableStream({ start(c) { c.enqueue(wav); c.close() } })
  }
  const total = Math.round(seconds * SAMPLE_RATE) * 2
  const chunk = 8820 // 0.2 s
  let sent = 0
  return new ReadableStream({
    async pull(c) {
      if (sent >= total) return c.close()
      const n = Math.min(chunk, total - sent)
      c.enqueue(new Uint8Array(n))
      sent += n
    },
  })
}

export async function synthesize(req: SpeechRequest, signal?: AbortSignal): Promise<Speech> {
  const text = (req.text ?? "").trim()
  const format = req.format ?? "pcm"
  if (!text) throw new VoiceError("Nothing to say.", 400)
  if (text.length > MAX_TEXT) throw new VoiceError(`Too long to say at once (${text.length} characters, at most ${MAX_TEXT}). Send it sentence by sentence.`, 413)
  const contentType = format === "pcm" ? `audio/L16;rate=${SAMPLE_RATE};channels=1` : format === "mp3" ? "audio/mpeg" : "audio/wav"
  if (voiceMode() === "mock") return { body: silence(text, format), contentType: format === "mp3" ? "audio/wav" : contentType, mode: "mock", model: "mock" }

  if (spent + text.length > BUDGET) throw new VoiceError("The voice budget for this session is used up (CR_VOICE_MAX_CHARS). Restart the server to reset it.", 429)
  const model = ttsModel(req.model)
  const outputFormat = format === "mp3" ? "mp3_22050_32" : `pcm_${SAMPLE_RATE}`
  const call = (voiceId: string) =>
    fetch(`${API}/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`, {
      method: "POST",
      signal,
      headers: { "xi-api-key": elevenLabsKey()!, "Content-Type": "application/json", Accept: format === "mp3" ? "audio/mpeg" : "audio/pcm" },
      body: JSON.stringify({
        text,
        model_id: model,
        language_code: "en",
        // Calm and even: higher stability, no added style.
        voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 1.0 },
      }),
    })
  const t0 = performance.now()
  let res = await call(voice().id)
  // A voice the account does not have (a fresh key): fall back to a premade one.
  if ((res.status === 400 || res.status === 404) && !process.env.CR_VOICE_ID) res = await call(FALLBACK_VOICE.id)
  if (!res.ok || !res.body) throw upstream("Text to speech", res.status)
  spent += text.length
  const wav = format === "wav"
  // format=wav is for simple players; real speech arrives as PCM, so wrap it in a header of unknown length.
  const body = wav ? withWavHeader(res.body) : res.body
  return { body, contentType: wav ? "audio/wav" : contentType, mode: "elevenlabs", model, firstByteMs: Math.round(performance.now() - t0) }
}

function withWavHeader(pcm: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const header = silentWav(0).slice(0, 44)
  const v = new DataView(header.buffer)
  v.setUint32(4, 0xffffffff, true)
  v.setUint32(40, 0xffffffff - 36, true)
  let sentHeader = false
  const reader = pcm.getReader()
  return new ReadableStream({
    async pull(c) {
      if (!sentHeader) {
        sentHeader = true
        c.enqueue(header)
        return
      }
      const { done, value } = await reader.read()
      if (done) c.close()
      else c.enqueue(value)
    },
    cancel(reason) { return reader.cancel(reason) },
  })
}

/** Characters sent to text to speech by this process (for the dev page and the report). */
export function voiceSpent(): { characters: number; budget: number } {
  return { characters: spent, budget: BUDGET }
}
