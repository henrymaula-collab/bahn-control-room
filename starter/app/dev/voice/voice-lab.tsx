"use client"

// The voice dev page: ask by voice, hear an answer, see what each step took.
// Answers come from a sample (streamed at the pace Claude writes), an echo, or
// the real chat API (POST /api/cr/cases/:id/chat) once it is in the build.

import { useRef, useState } from "react"
import { useVoice } from "../../(control-room)/_ui/use-voice"
import { VoiceButton, type SpeakInput } from "../../(control-room)/_ui/voice-button"
import type { ChatEvent } from "@/lib/control-room/types-chat"
import type { VoiceStatus } from "@/lib/voice/types"
import "./voice-lab.css"

type Source = "sample" | "echo" | "chat"

/** Made-up, in Bahn's words: the round 2 answer from VISION_V4.md. */
const SAMPLE =
  "Last time this happened, at Calverona Hamburg, Aino paused the gig and asked the seller to release the car. " +
  "The seller confirmed within the hour, and the driver went the next morning. " +
  "It has happened once, so it is your call."
const SAMPLE_FIRST_WORD_MS = 700 // a typical wait for Claude's first words
const SAMPLE_CHARS_PER_SECOND = 180

export function VoiceLab({ status }: { status: VoiceStatus }) {
  const [source, setSource] = useState<Source>("sample")
  const [caseId, setCaseId] = useState("CD-420458")
  const [person, setPerson] = useState("p-aino")
  const [model, setModel] = useState(status.ttsModel)
  const [heard, setHeard] = useState("")
  const [answer, setAnswer] = useState<SpeakInput | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [sayText, setSayText] = useState("The seller has not released the car yet. I suggest pausing the gig until they confirm.")
  const run = useRef(0)

  const answerTo = async (question: string) => {
    const id = `answer-${++run.current}`
    const mine = run.current
    setAnswerError(null)
    setAnswer(null)
    if (source === "echo") {
      setAnswer({ id, text: `You asked: ${question}`, done: true })
      return
    }
    if (source === "sample") {
      await new Promise((r) => setTimeout(r, SAMPLE_FIRST_WORD_MS))
      for (let n = 0; n <= SAMPLE.length && mine === run.current; n += 6) {
        setAnswer({ id, text: SAMPLE.slice(0, n), done: false })
        await new Promise((r) => setTimeout(r, (6 / SAMPLE_CHARS_PER_SECOND) * 1000))
      }
      if (mine === run.current) setAnswer({ id, text: SAMPLE, done: true })
      return
    }
    // The chat API: text/event-stream of ChatEvent.
    try {
      const res = await fetch(`/api/cr/cases/${encodeURIComponent(caseId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person, text: question, via: "voice" }),
      })
      if (!res.ok || !res.body) throw new Error(res.status === 404 ? "The chat API is not in this build yet." : `The chat API answered ${res.status}.`)
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ""
      let text = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done || mine !== run.current) break
        buffer += value
        let cut: number
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n")
          if (!data) continue
          const event = JSON.parse(data) as ChatEvent
          if (event.type === "delta") {
            text += event.text
            setAnswer({ id, text, done: false })
          } else if (event.type === "done") {
            text = event.message.text || text
            setAnswer({ id, text, done: true })
          } else if (event.type === "error") {
            throw new Error(event.message)
          }
        }
      }
      setAnswer((a) => (a && a.id === id ? { ...a, done: true } : a))
    } catch (e) {
      setAnswerError(e instanceof Error ? e.message : String(e))
    }
  }

  const voice = useVoice({
    onTranscript: (text) => {
      setHeard(text)
      void answerTo(text)
    },
    ttsModel: model === "mock" ? undefined : model,
  })
  const t = voice.timings
  const ms = (n?: number) => (n === undefined ? "" : n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n} ms`)

  return (
    <div className="lab">
      <h1 className="l strong">Voice</h1>
      <p className="quiet lab-mode">
        {status.mode === "mock"
          ? "Mock: a set question comes back as the transcript and the answer plays as silence. Add ELEVENLABS_API_KEY to starter/.env.local for real speech."
          : `ElevenLabs speaks as ${status.voice} with ${model}; ${status.sttModel} writes down what you say. Claude stays the brain.`}
      </p>

      <section className="lab-ask">
        <VoiceButton voice={voice} onTranscript={() => {}} speak={answer} />
        <p className="s">Hold to talk and let go to send, or tap to start and tap again to send.</p>
      </section>

      <dl className="lab-lines">
        <dt className="s">You said</dt>
        <dd>{heard || <span className="quiet">Nothing yet</span>}</dd>
        <dt className="s">The agent</dt>
        <dd>{answerError ? answerError : answer?.text || <span className="quiet">Answers once you have asked</span>}</dd>
      </dl>

      <section className="lab-settings">
        <label className="lab-field">
          <span className="s">Answer from</span>
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            <option value="sample">A sample answer, written at Claude&apos;s pace</option>
            <option value="echo">Repeat what I said</option>
            <option value="chat">The chat API</option>
          </select>
        </label>
        {source === "chat" && (
          <>
            <label className="lab-field">
              <span className="s">Case</span>
              <input value={caseId} onChange={(e) => setCaseId(e.target.value)} />
            </label>
            <label className="lab-field">
              <span className="s">Person</span>
              <input value={person} onChange={(e) => setPerson(e.target.value)} />
            </label>
          </>
        )}
        {status.mode === "elevenlabs" && (
          <label className="lab-field">
            <span className="s">Speech model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="eleven_v4_turbo">eleven_v4_turbo</option>
              <option value="eleven_flash_v2_5">eleven_flash_v2_5</option>
            </select>
          </label>
        )}
      </section>

      <section className="lab-say">
        <label className="lab-field lab-grow">
          <span className="s">Say this</span>
          <input value={sayText} onChange={(e) => setSayText(e.target.value)} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => (voice.state === "speaking" ? voice.stopSpeaking() : voice.speak(sayText))}>
          {voice.state === "speaking" ? "Stop" : "Speak"}
        </button>
      </section>

      <section>
        <h2 className="m strong">Last question, measured in this browser</h2>
        <dl className="lab-times" data-testid="voice-timings">
          <dt>Your question</dt><dd className="num">{ms(t.recordedMs)}</dd>
          <dt>Speech to text, from when you stopped</dt><dd className="num">{ms(t.sttMs)}</dd>
          <dt>Waiting for the first sentence of the answer</dt><dd className="num">{ms(t.answerWaitMs)}</dd>
          <dt>First sentence to first sound</dt><dd className="num">{ms(t.ttsFirstAudioMs)}</dd>
          <dt className="strong">From when you stopped to the agent&apos;s first sound</dt><dd className="num strong">{ms(t.roundTripMs)}</dd>
        </dl>
      </section>
    </div>
  )
}
