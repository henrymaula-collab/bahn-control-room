"use client"

// Placeholder for the voice track (branch v4-voice): same names and props as its
// <VoiceButton onTranscript speak /> and useVoice(), so the merge swaps this file for
// the real one and the chat does not change. Until then the button shows, disabled.
//   onTranscript(text): called with what the person said; the chat sends it with via "voice".
//   speak(text): plays the agent's answer; the chat calls it when an answer to a
//   spoken question is done (the real hook may speak sentence by sentence instead).

import { Icon } from "./icons"

export interface VoiceButtonProps {
  onTranscript: (text: string) => void
  speak?: (text: string) => void
  disabled?: boolean
}

export function useVoice(): { speak: (text: string) => void } {
  return { speak: () => {} }
}

export function VoiceButton(_props: VoiceButtonProps) {
  return (
    <button type="button" className="voice" disabled aria-label="Talk instead of typing (not available yet)" title="Voice is not available yet">
      <Icon name="mic" size={18} />
    </button>
  )
}
