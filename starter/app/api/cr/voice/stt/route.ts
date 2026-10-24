import { transcribe, VoiceError } from "@/lib/voice/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/cr/voice/stt
 * Body: the recorded audio as is (Content-Type audio/webm, audio/mp4, audio/wav ...),
 * or multipart/form-data with `file` (and optional `language`, "auto" to detect).
 * -> Transcript { text, language, mode, ms }. The ElevenLabs key stays on the server.
 */
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? ""
    let audio: Blob
    let language: string | null | undefined
    if (type.startsWith("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      if (!(file instanceof Blob)) return Response.json({ error: "Send the audio as `file`." }, { status: 400 })
      audio = file
      const lang = form.get("language")
      if (typeof lang === "string" && lang) language = lang === "auto" ? null : lang
    } else {
      audio = new Blob([await request.arrayBuffer()], { type: type || "audio/webm" })
      const lang = new URL(request.url).searchParams.get("language")
      if (lang) language = lang === "auto" ? null : lang
    }
    return Response.json(await transcribe(audio, { language }))
  } catch (e) {
    const status = e instanceof VoiceError ? e.status : 500
    return Response.json({ error: e instanceof Error ? e.message : "Speech to text failed." }, { status })
  }
}
