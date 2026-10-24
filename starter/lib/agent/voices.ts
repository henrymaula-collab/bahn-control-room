// Render a simulated call to an mp3 with real voices (ElevenLabs), plus
// per-turn timings so the UI can highlight the transcript while it plays.
// Rendering is a separate step from running the agent: calls are generated
// as text first, and only the final demo calls are voiced (credits are
// shared). Every turn is cached by model + voice + text, so an unchanged
// call is never rendered twice.

import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Call } from "@/lib/control-room/types"
import { paths } from "./config"

const API = "https://api.elevenlabs.io"
export const TEST_MODEL = "eleven_flash_v2_5" // about half the credits per character
export const FINAL_MODEL = "eleven_multilingual_v2"
const GAP_SECONDS = 0.45

export interface CallTimings {
  callId: string
  audioUrl: string
  durationSec: number
  model: string
  voices: { agent: string; pickup_place: string }
  characters: number
  renderedCharacters: number // characters actually sent (cache misses)
  turns: { index: number; speaker: "agent" | "pickup_place"; start: number; end: number }[]
}

interface Voice {
  voice_id: string
  name: string
  category?: string
  labels?: Record<string, string>
  verified_languages?: { language?: string; accent?: string }[]
}

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY?.trim()
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set (starter/.env.local).")
  return k
}

async function listVoices(): Promise<Voice[]> {
  const cacheFile = path.join(paths.dataDir(), "tts-voices.json")
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as Voice[]
  const res = await fetch(`${API}/v2/voices?page_size=100`, { headers: { "xi-api-key": key() } })
  if (!res.ok) throw new Error(`ElevenLabs voices: HTTP ${res.status}`)
  const body = (await res.json()) as { voices: Voice[] }
  fs.mkdirSync(paths.dataDir(), { recursive: true })
  fs.writeFileSync(cacheFile, JSON.stringify(body.voices, null, 1))
  return body.voices
}

const ACCENT: Record<string, string[]> = { de: ["german"], fi: ["helsinki", "finnish", "standard"], da: ["danish"], fr: ["french", "parisian"], en: ["british", "american"] }

/**
 * Two distinct voices for a call in this language: the pickup place sounds
 * local (accent and verified language), Bahn's agent is a calm voice that
 * also speaks the language. Picked from the account's voices via the API.
 */
export async function pickVoices(language: string): Promise<{ agent: Voice; pickup_place: Voice }> {
  const voices = await listVoices()
  const speaks = (v: Voice) => (v.verified_languages ?? []).some((l) => l.language === language) || v.labels?.language === language
  const accentScore = (v: Voice) => (ACCENT[language] ?? []).includes(v.labels?.accent ?? "") ? 2 : 0
  const score = (v: Voice, gender: string, useCase: string) =>
    (speaks(v) ? 5 : 0) + accentScore(v) + (v.labels?.gender === gender ? 3 : 0) + (v.labels?.use_case === useCase ? 1 : 0) + (v.labels?.language === language ? 1 : 0)
  const place = [...voices].sort((a, b) => score(b, "male", "conversational") - score(a, "male", "conversational"))[0]
  const agent = [...voices]
    .filter((v) => v.voice_id !== place?.voice_id)
    .sort((a, b) => score(b, "female", "conversational") - score(a, "female", "conversational"))[0]
  if (!place || !agent) throw new Error("No ElevenLabs voices available.")
  return { agent, pickup_place: place }
}

async function tts(text: string, voiceId: string, model: string, language: string): Promise<{ file: string; sent: number }> {
  const hash = crypto.createHash("sha1").update(`${model}|${voiceId}|${text}`).digest("hex").slice(0, 16)
  const dir = path.join(paths.dataDir(), "tts-cache")
  const file = path.join(dir, `${hash}.mp3`)
  if (fs.existsSync(file)) return { file, sent: 0 }
  fs.mkdirSync(dir, { recursive: true })
  const res = await fetch(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: model,
      ...(model === TEST_MODEL ? { language_code: language } : {}),
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return { file, sent: text.length }
}

function duration(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim()
  return Number(out)
}

/** Render one call. Returns timings; writes public/calls/<id>.mp3 and <id>.json. */
export async function renderCall(call: Call, opts: { model?: string } = {}): Promise<CallTimings> {
  if (call.outcome !== "answered" || call.turns.length === 0) throw new Error(`Call ${call.id} has no conversation to voice.`)
  const model = opts.model ?? process.env.CR_TTS_MODEL ?? TEST_MODEL
  const { agent, pickup_place } = await pickVoices(call.language)
  const segs: { file: string; speaker: "agent" | "pickup_place"; dur: number }[] = []
  let sent = 0
  for (const t of call.turns) {
    const v = t.speaker === "agent" ? agent : pickup_place
    const r = await tts(t.text, v.voice_id, model, call.language)
    sent += r.sent
    segs.push({ file: r.file, speaker: t.speaker, dur: duration(r.file) })
  }
  fs.mkdirSync(paths.calls(), { recursive: true })
  const out = path.join(paths.calls(), `${call.id}.mp3`)
  // The pickup place is heard through a phone line; Bahn's side is the clean recording.
  const inputs = segs.flatMap((s) => ["-i", s.file])
  const filters = segs.map((s, i) => {
    const phone = s.speaker === "pickup_place" ? ",highpass=f=300,lowpass=f=3400" : ""
    return `[${i}:a]aresample=44100,aformat=channel_layouts=mono${phone},apad=pad_dur=${GAP_SECONDS}[a${i}]`
  })
  const concat = `${segs.map((_, i) => `[a${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[out]`
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", [...filters, concat].join(";"), "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "96k", out])
  let t = 0
  const turns = segs.map((s, index) => {
    const start = Math.round(t * 100) / 100
    t += s.dur
    const end = Math.round(t * 100) / 100
    t += GAP_SECONDS
    return { index, speaker: s.speaker, start, end }
  })
  const timings: CallTimings = {
    callId: call.id,
    audioUrl: `/calls/${call.id}.mp3`,
    durationSec: Math.round(duration(out) * 100) / 100,
    model,
    voices: { agent: agent.name, pickup_place: pickup_place.name },
    characters: call.turns.reduce((n, x) => n + x.text.length, 0),
    renderedCharacters: sent,
    turns,
  }
  fs.writeFileSync(path.join(paths.calls(), `${call.id}.json`), JSON.stringify(timings, null, 2))
  return timings
}

/** The audio URL of a call if it has been rendered. */
export function audioUrlFor(callId: string): string | undefined {
  return fs.existsSync(path.join(paths.calls(), `${callId}.mp3`)) ? `/calls/${callId}.mp3` : undefined
}
