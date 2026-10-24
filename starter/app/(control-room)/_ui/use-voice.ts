"use client"

// useVoice(): the person talks to the agent instead of typing.
// Listening: the browser records while the button is held (or between two taps),
// the clip goes to /api/cr/voice/stt and the text comes back via onTranscript.
// Speaking: the agent's answer goes to /api/cr/voice/tts sentence by sentence
// while it is still streaming; raw PCM is played through Web Audio as it arrives,
// so the first words are heard about 0.2 s after the first sentence is written.
// The ElevenLabs key never reaches the browser. Mock mode on the server answers
// with a canned transcript and silence, so this works on a fresh clone.

import { useCallback, useEffect, useRef, useState } from "react"
import { Pcm16Decoder, SAMPLE_RATE } from "@/lib/voice/pcm"
import { SentenceFeed } from "@/lib/voice/sentences"
import type { Transcript, VoiceMode } from "@/lib/voice/types"

export type VoiceState = "idle" | "starting" | "listening" | "transcribing" | "speaking"

/** Milliseconds, measured in the browser. */
export interface VoiceTimings {
  recordedMs?: number // length of the last question
  sttMs?: number // speech end -> transcript in hand
  answerWaitMs?: number // transcript -> first sentence handed to speak (the brain's part)
  ttsFirstAudioMs?: number // first sentence handed to speak -> first audio playing
  roundTripMs?: number // speech end -> first audio of the answer
}

export interface UseVoiceOptions {
  onTranscript?: (text: string) => void
  /** Transcript language; "auto" to detect. The server defaults to English. */
  language?: string
  /** Text-to-speech model, for comparing on the dev page. */
  ttsModel?: string
}

export interface Voice {
  state: VoiceState
  error: string | null
  mode: VoiceMode | null // known after the first request
  supported: boolean
  timings: VoiceTimings
  /** Start listening (call from a press: it opens the microphone). */
  start: () => Promise<void>
  /** Stop listening and send what was said. */
  stop: () => void
  /** Stop listening and drop the recording. */
  cancel: () => void
  /** Read a whole text aloud, sentence by sentence. */
  speak: (text: string) => void
  /** Read an answer while it streams: call with the text so far; `done` once it is complete. Idempotent. */
  speakStream: (id: string, textSoFar: string, done: boolean) => void
  stopSpeaking: () => void
  /** Callback ref for the element that shows the level: sets --voice-level (0..1) while listening or speaking. */
  meterRef: (el: HTMLElement | null) => void
}

const KEEP_MIC_MS = 20_000 // keep the microphone open between quick follow-up questions
const MIN_RECORDING_MS = 300
const FIRST_BUFFER = Math.round(SAMPLE_RATE * 0.05) // start playing after 50 ms of audio
const BUFFER = Math.round(SAMPLE_RATE * 0.12) // then in 120 ms buffers (fewer joins, no clicks)

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(t)) return t
  return undefined
}

function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "The microphone is blocked. Allow it for this page in Chrome's address bar."
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone found."
  return "The microphone could not start."
}

declare global {
  interface Window {
    __crVoice?: { state: VoiceState; timings: VoiceTimings; mode: VoiceMode | null }
  }
}

export function useVoice(options: UseVoiceOptions = {}): Voice {
  const [state, setStateRaw] = useState<VoiceState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<VoiceMode | null>(null)
  const [timings, setTimingsRaw] = useState<VoiceTimings>({})
  const [supported, setSupported] = useState(true)

  const opts = useRef(options)
  opts.current = options
  const stateRef = useRef<VoiceState>("idle")
  const timingsRef = useRef<VoiceTimings>({})
  const modeRef = useRef<VoiceMode | null>(null)

  // Microphone
  const micCtx = useRef<AudioContext | null>(null)
  const micAnalyser = useRef<AnalyserNode | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const recordStart = useRef(0)
  const dropRecording = useRef(false)
  const stopWhenReady = useRef(false)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Playback
  const outCtx = useRef<AudioContext | null>(null)
  const outGain = useRef<GainNode | null>(null)
  const outAnalyser = useRef<AnalyserNode | null>(null)
  const nextTime = useRef(0)
  const sources = useRef(new Set<AudioBufferSourceNode>())
  const chain = useRef<Promise<void>>(Promise.resolve())
  const pending = useRef(0)
  const gen = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const feed = useRef<{ id: string; feed: SentenceFeed; done: boolean; firstQueued: boolean; firstQueuedAt: number; firstAudio: boolean } | null>(null)
  const speechEndAt = useRef<number | null>(null)
  const transcriptAt = useRef<number | null>(null)

  // Level meter
  const meterEl = useRef<HTMLElement | null>(null)
  const raf = useRef<number | null>(null)
  const level = useRef(0)

  const publish = useCallback(() => {
    if (typeof window !== "undefined") window.__crVoice = { state: stateRef.current, timings: timingsRef.current, mode: modeRef.current }
  }, [])
  const setState = useCallback((s: VoiceState) => {
    stateRef.current = s
    setStateRaw(s)
    publish()
  }, [publish])
  const setTimings = useCallback((patch: VoiceTimings) => {
    timingsRef.current = { ...timingsRef.current, ...patch }
    setTimingsRaw(timingsRef.current)
    publish()
  }, [publish])
  const noteMode = useCallback((res: Response) => {
    const m = res.headers.get("x-voice-mode") as VoiceMode | null
    if (m && m !== modeRef.current) {
      modeRef.current = m
      setMode(m)
    }
  }, [])

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!pickMime() && typeof AudioContext !== "undefined")
  }, [])

  // ---- level meter: the microphone while listening, the agent's voice while speaking ----
  const tick = useCallback(() => {
    const analyser = stateRef.current === "listening" ? micAnalyser.current : stateRef.current === "speaking" ? outAnalyser.current : null
    let target = 0
    if (analyser) {
      const data = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(data)
      let sum = 0
      for (const x of data) sum += x * x
      target = Math.min(1, Math.sqrt(sum / data.length) * 5)
    }
    // Rise quickly, fall slowly: calm, not jittery.
    level.current = target > level.current ? level.current * 0.6 + target * 0.4 : level.current * 0.92 + target * 0.08
    meterEl.current?.style.setProperty("--voice-level", level.current.toFixed(3))
    raf.current = analyser || level.current > 0.005 ? requestAnimationFrame(tick) : null
  }, [])
  const runMeter = useCallback(() => {
    if (raf.current === null) raf.current = requestAnimationFrame(tick)
  }, [tick])

  const meterRef = useCallback((el: HTMLElement | null) => {
    meterEl.current = el
  }, [])

  // ---- playback ----
  const output = useCallback(() => {
    if (!outCtx.current) {
      // A context at the stream's own rate: buffers join without resampling seams.
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" })
      const gain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      gain.connect(analyser)
      analyser.connect(ctx.destination)
      outCtx.current = ctx
      outGain.current = gain
      outAnalyser.current = analyser
    }
    if (outCtx.current.state === "suspended") void outCtx.current.resume()
    return outCtx.current
  }, [])

  const settle = useCallback(() => {
    const f = feed.current
    if (pending.current === 0 && sources.current.size === 0 && (!f || f.done) && stateRef.current === "speaking") setState("idle")
  }, [setState])

  const stopSpeaking = useCallback(() => {
    gen.current++
    abort.current?.abort()
    abort.current = null
    for (const s of sources.current) {
      try { s.stop() } catch { /* already ended */ }
    }
    sources.current.clear()
    pending.current = 0
    chain.current = Promise.resolve()
    nextTime.current = 0
    if (feed.current) feed.current.done = true
    if (stateRef.current === "speaking") setState("idle")
  }, [setState])

  const schedule = useCallback((samples: Float32Array, myGen: number) => {
    const ctx = outCtx.current
    if (!ctx || myGen !== gen.current || samples.length === 0) return
    const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE)
    buffer.getChannelData(0).set(samples)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(outGain.current!)
    const at = Math.max(nextTime.current, ctx.currentTime + 0.02)
    src.start(at)
    nextTime.current = at + buffer.duration
    sources.current.add(src)
    src.onended = () => {
      sources.current.delete(src)
      settle()
    }
    const f = feed.current
    if (f && !f.firstAudio) {
      f.firstAudio = true
      const audible = performance.now() + (at - ctx.currentTime) * 1000 + (ctx.baseLatency ?? 0) * 1000
      const patch: VoiceTimings = { ttsFirstAudioMs: Math.round(audible - f.firstQueuedAt) }
      if (speechEndAt.current !== null) {
        patch.roundTripMs = Math.round(audible - speechEndAt.current)
        if (transcriptAt.current !== null) patch.answerWaitMs = Math.round(f.firstQueuedAt - transcriptAt.current)
        speechEndAt.current = null
        transcriptAt.current = null
      }
      setTimings(patch)
    }
    runMeter()
  }, [runMeter, setTimings, settle])

  const pump = useCallback(async (request: Promise<Response>, myGen: number) => {
    let res: Response
    try {
      res = await request
    } catch {
      return // aborted
    }
    noteMode(res)
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (myGen === gen.current) setError(body.error ?? "The agent's voice is not available right now.")
      return
    }
    const decoder = new Pcm16Decoder()
    const reader = res.body.getReader()
    let held: Float32Array[] = []
    let heldLen = 0
    let started = false
    const flush = () => {
      if (!heldLen) return
      const joined = new Float32Array(heldLen)
      let o = 0
      for (const h of held) { joined.set(h, o); o += h.length }
      held = []
      heldLen = 0
      schedule(joined, myGen)
      started = true
    }
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (myGen !== gen.current) {
          void reader.cancel()
          return
        }
        if (done) break
        const samples = decoder.push(value)
        if (!samples.length) continue
        held.push(samples)
        heldLen += samples.length
        if (heldLen >= (started ? BUFFER : FIRST_BUFFER)) flush()
      }
      flush()
    } catch {
      /* aborted mid-stream */
    }
  }, [noteMode, schedule])

  const enqueue = useCallback((text: string) => {
    const myGen = gen.current
    if (!abort.current) abort.current = new AbortController()
    const f = feed.current
    if (f && !f.firstQueued) {
      f.firstQueued = true
      f.firstQueuedAt = performance.now()
    }
    // Start the request now (it overlaps the sentence before); play in order.
    const request = fetch("/api/cr/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, format: "pcm", ...(opts.current.ttsModel ? { model: opts.current.ttsModel } : {}) }),
      signal: abort.current.signal,
    })
    pending.current++
    if (stateRef.current !== "speaking") setState("speaking")
    chain.current = chain.current
      .then(() => pump(request, myGen))
      .finally(() => {
        if (myGen !== gen.current) return
        pending.current = Math.max(0, pending.current - 1)
        settle()
      })
  }, [pump, setState, settle])

  const speakStream = useCallback((id: string, textSoFar: string, done: boolean) => {
    if (feed.current?.id !== id) {
      stopSpeaking()
      feed.current = { id, feed: new SentenceFeed(), done: false, firstQueued: false, firstQueuedAt: 0, firstAudio: false }
    }
    const f = feed.current
    if (f.done) return
    output()
    const pieces = done ? f.feed.finish(textSoFar) : f.feed.push(textSoFar)
    if (done) f.done = true
    for (const p of pieces) enqueue(p)
    if (done) settle()
  }, [enqueue, output, settle, stopSpeaking])

  const sayCount = useRef(0)
  const speak = useCallback((text: string) => {
    speakStream(`say-${++sayCount.current}`, text, true)
  }, [speakStream])

  // ---- listening ----
  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    micAnalyser.current = null
    void micCtx.current?.close()
    micCtx.current = null
  }, [])
  const keepMicWarm = useCallback(() => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    releaseTimer.current = setTimeout(releaseMic, KEEP_MIC_MS)
  }, [releaseMic])

  const send = useCallback(async (blob: Blob, recordedMs: number) => {
    const t0 = performance.now()
    try {
      const params = opts.current.language ? `?language=${encodeURIComponent(opts.current.language)}` : ""
      const res = await fetch(`/api/cr/voice/stt${params}`, { method: "POST", body: blob, headers: { "Content-Type": blob.type || "audio/webm" } })
      noteMode(res)
      const body = (await res.json()) as Partial<Transcript> & { error?: string }
      if (!res.ok) throw new Error(body.error ?? "Speech to text failed.")
      const text = (body.text ?? "").trim()
      if (!text) {
        setError("I did not catch that. Hold the button and speak.")
        setState("idle")
        speechEndAt.current = null
        return
      }
      transcriptAt.current = performance.now()
      setTimings({ recordedMs: Math.round(recordedMs), sttMs: Math.round(transcriptAt.current - (speechEndAt.current ?? t0)), answerWaitMs: undefined, ttsFirstAudioMs: undefined, roundTripMs: undefined })
      setState("idle")
      opts.current.onTranscript?.(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speech to text failed.")
      setState("idle")
      speechEndAt.current = null
    }
  }, [noteMode, setState, setTimings])

  const stop = useCallback(() => {
    if (stateRef.current === "starting") {
      stopWhenReady.current = true
      return
    }
    const rec = recorder.current
    if (rec && rec.state === "recording") {
      speechEndAt.current = performance.now()
      setState("transcribing")
      rec.stop()
    }
  }, [setState])

  const cancel = useCallback(() => {
    if (stateRef.current === "starting") {
      dropRecording.current = true
      stopWhenReady.current = true
      return
    }
    const rec = recorder.current
    if (rec && rec.state === "recording") {
      dropRecording.current = true
      rec.stop()
    }
  }, [])

  const start = useCallback(async () => {
    if (stateRef.current === "listening" || stateRef.current === "starting" || stateRef.current === "transcribing") return
    if (stateRef.current === "speaking") stopSpeaking() // talking over the agent stops it
    setError(null)
    output() // a press is the gesture that lets the answer play later
    stopWhenReady.current = false
    dropRecording.current = false
    setState("starting")
    try {
      if (!stream.current) {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
        micCtx.current = new AudioContext()
        const analyser = micCtx.current.createAnalyser()
        analyser.fftSize = 1024
        micCtx.current.createMediaStreamSource(stream.current).connect(analyser)
        micAnalyser.current = analyser
      }
      if (micCtx.current?.state === "suspended") await micCtx.current.resume()
    } catch (e) {
      releaseMic()
      setError(micError(e))
      setState("idle")
      return
    }
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    const mime = pickMime()
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined)
    chunks.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      keepMicWarm()
      const recordedMs = performance.now() - recordStart.current
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" })
      chunks.current = []
      if (dropRecording.current) {
        dropRecording.current = false
        speechEndAt.current = null
        setState("idle")
        return
      }
      if (recordedMs < MIN_RECORDING_MS) {
        speechEndAt.current = null
        setError("Hold the button while you speak.")
        setState("idle")
        return
      }
      void send(blob, recordedMs)
    }
    recorder.current = rec
    rec.start()
    recordStart.current = performance.now()
    setState("listening")
    runMeter()
    if (stopWhenReady.current) {
      stopWhenReady.current = false
      if (dropRecording.current) rec.stop()
      // A press shorter than the microphone's start-up is a tap: keep listening (the button decides).
    }
  }, [keepMicWarm, output, releaseMic, runMeter, send, setState, stopSpeaking])

  useEffect(() => () => {
    gen.current++
    abort.current?.abort()
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    try { recorder.current?.stop() } catch { /* not recording */ }
    stream.current?.getTracks().forEach((t) => t.stop())
    void micCtx.current?.close()
    void outCtx.current?.close()
  }, [])

  return { state, error, mode, supported, timings, start, stop, cancel, speak, speakStream, stopSpeaking, meterRef }
}
