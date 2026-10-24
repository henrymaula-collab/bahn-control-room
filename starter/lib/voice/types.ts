// Shapes of the voice routes (speech in and out for "talk it through").
// ElevenLabs does the speech; Claude stays the brain (the chat API).

export type VoiceMode = "elevenlabs" | "mock"

/** GET /api/cr/voice */
export interface VoiceStatus {
  mode: VoiceMode
  sttModel: string
  ttsModel: string
  voice: string // the voice's name, for the dev page
  sampleRate: number // of the PCM the speech route streams
  language: string | null // the language the transcript is held to, null = detected
}

/** POST /api/cr/voice/stt  body: the recorded audio (audio/webm, audio/mp4, audio/wav ...) or multipart with `file`. */
export interface Transcript {
  text: string
  language: string | null
  mode: VoiceMode
  ms: number // time the speech service took
}

/** POST /api/cr/voice/tts  body { text, format?: "pcm" | "mp3" | "wav", model? } answers with streamed audio. */
export interface SpeechRequest {
  text: string
  format?: "pcm" | "mp3" | "wav"
  model?: string
}
