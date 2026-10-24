"use client"

// The voice button beside the chat's text field: talk to the agent instead of typing.
// Hold to talk (release sends), or tap to start and tap again to send. While the
// agent speaks, a tap stops it and holding asks the next question. One quiet word
// beside it says what is happening; the ring follows the voice (the person's in
// ink, the agent's in its green), nothing else moves.
//
//   <VoiceButton onTranscript={(text) => send(text, "voice")} speak={answer} />
//
// `speak` is the agent's answer to read aloud as it streams: pass
// { id: message id, text: the text so far, done } and update it on every delta.
// Pass it only for answers to a spoken question (the person chose voice).

import { useEffect, useRef, useState } from "react"
import "./voice.css"
import { useVoice, type Voice } from "./use-voice"

export interface SpeakInput {
  id: string
  text: string
  done?: boolean
}

export interface VoiceButtonProps {
  /** What the person said, once they finish speaking. */
  onTranscript: (text: string) => void
  /** The agent's answer to read aloud while it streams; null or undefined: nothing to say. */
  speak?: SpeakInput | null
  /** Share a useVoice() you hold yourself (to read state or timings). Its onTranscript is used then. */
  voice?: Voice
  disabled?: boolean
  /** The quiet word beside the button ("Listening"). Default true. */
  showState?: boolean
  className?: string
}

const TAP_MS = 350

const WORDS: Record<string, string> = {
  starting: "Listening",
  listening: "Listening",
  transcribing: "Writing it down",
  speaking: "Speaking",
}

export function VoiceButton({ onTranscript, speak, voice: shared, disabled, showState = true, className }: VoiceButtonProps) {
  const own = useVoice({ onTranscript: shared ? undefined : onTranscript })
  const v = shared ?? own
  const pressedAt = useRef(0)
  const held = useRef(false)
  const swallowUp = useRef(false)
  const bargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(v.state)
  stateRef.current = v.state
  const [tapMode, setTapMode] = useState(false)
  const live = v.state === "listening" || v.state === "starting"
  useEffect(() => {
    if (!live) setTapMode(false)
  }, [live])

  // Read the answer aloud as it streams.
  const { speakStream } = v
  useEffect(() => {
    if (speak && speak.text) speakStream(speak.id, speak.text, !!speak.done)
  }, [speak?.id, speak?.text, speak?.done, speakStream]) // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const s = stateRef.current
    if (s === "transcribing") return
    if (s === "listening" || s === "starting") {
      // Second tap: send.
      swallowUp.current = true
      v.stop()
      return
    }
    pressedAt.current = performance.now()
    held.current = true
    if (s === "speaking") {
      // Stop the agent; keep holding to ask the next question.
      v.stopSpeaking()
      bargeTimer.current = setTimeout(() => {
        bargeTimer.current = null
        if (held.current) void v.start()
      }, TAP_MS)
      return
    }
    void v.start()
  }

  const up = () => {
    if (swallowUp.current) {
      swallowUp.current = false
      return
    }
    if (!held.current) return
    held.current = false
    if (bargeTimer.current) {
      // A tap while the agent spoke: it only stopped the agent.
      clearTimeout(bargeTimer.current)
      bargeTimer.current = null
      return
    }
    // A tap keeps listening until the next tap; a hold sends on release.
    if (performance.now() - pressedAt.current >= TAP_MS) v.stop()
    else setTapMode(true)
  }

  const key = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === "Escape" && (v.state === "listening" || v.state === "starting")) {
      e.preventDefault()
      v.cancel()
      return
    }
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault()
      if (v.state === "listening" || v.state === "starting") v.stop()
      else if (v.state === "speaking") v.stopSpeaking()
      else if (v.state === "idle") void v.start()
    }
  }

  const s = v.state
  const idleLabel = "Talk to the agent: hold to talk, or tap to start and stop"
  const label = live ? "Listening. Release or tap to send" : s === "speaking" ? "The agent is speaking. Tap to stop" : s === "transcribing" ? "Writing down what you said" : idleLabel
  const word = v.error ?? (live && tapMode ? "Listening. Tap to send" : WORDS[s])
  const unavailable = !v.supported

  return (
    <span className={`voice${className ? ` ${className}` : ""}`} data-state={s}>
      <button
        type="button"
        ref={v.meterRef}
        className="voice-button"
        data-state={s}
        aria-label={unavailable ? "Voice needs a microphone and a current Chrome" : label}
        aria-pressed={live}
        title={unavailable ? "Voice needs a microphone and a current Chrome" : live ? undefined : "Hold to talk"}
        disabled={disabled || unavailable}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="voice-ring" aria-hidden />
        {s === "speaking" ? <AudioLines /> : <Mic />}
      </button>
      {showState && (
        <span className={`voice-word${v.error ? " voice-error" : ""}`} role="status" aria-live="polite">
          {word ?? ""}
        </span>
      )}
    </span>
  )
}

// lucide "mic" and "audio-lines" (ISC licence), at Bahn's 1.75 stroke like _ui/icons.tsx.
function Mic() {
  return (
    <svg className="voice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </svg>
  )
}

function AudioLines() {
  return (
    <svg className="voice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 10v3" />
      <path d="M6 6v11" />
      <path d="M10 3v18" />
      <path d="M14 8v7" />
      <path d="M18 5v13" />
      <path d="M22 10v3" />
    </svg>
  )
}
