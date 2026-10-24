import { synthesize, VoiceError } from "@/lib/voice/server"
import type { SpeechRequest } from "@/lib/voice/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/cr/voice/tts  { text, format?: "pcm" | "mp3" | "wav", model? }
 * -> streamed audio. pcm (default): raw 16-bit mono at the rate in the
 * content type (audio/L16;rate=22050), played by useVoice() as it arrives.
 * mp3/wav: for a plain <audio> player. Mock mode streams silence of a natural length.
 */
export async function POST(request: Request) {
  let input: Partial<SpeechRequest> = {}
  try {
    input = (await request.json()) as Partial<SpeechRequest>
  } catch {
    return Response.json({ error: "Send JSON: { text }." }, { status: 400 })
  }
  try {
    const format = input.format === "mp3" || input.format === "wav" ? input.format : "pcm"
    const speech = await synthesize({ text: String(input.text ?? ""), format, model: input.model }, request.signal)
    const headers: Record<string, string> = {
      "Content-Type": speech.contentType,
      "Cache-Control": "no-store",
      "X-Voice-Mode": speech.mode,
      "X-Voice-Model": speech.model,
    }
    if (speech.firstByteMs !== undefined) headers["Server-Timing"] = `tts;desc="first byte";dur=${speech.firstByteMs}`
    return new Response(speech.body, { headers })
  } catch (e) {
    if (request.signal.aborted) return new Response(null, { status: 499 })
    const status = e instanceof VoiceError ? e.status : 500
    return Response.json({ error: e instanceof Error ? e.message : "Text to speech failed." }, { status })
  }
}
