import { voiceSpent, voiceStatus } from "@/lib/voice/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/voice -> VoiceStatus (mode, models, voice) plus what this process has spent. No key in it. */
export function GET() {
  return Response.json({ ...voiceStatus(), spent: voiceSpent() })
}
