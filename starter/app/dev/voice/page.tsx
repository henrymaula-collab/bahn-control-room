import type { Metadata } from "next"
import { voiceStatus } from "@/lib/voice/server"
import { VoiceLab } from "./voice-lab"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Voice" }

/** /dev/voice: try talking to the agent alone (speech in, speech out), with measured timings. */
export default function VoicePage() {
  return <VoiceLab status={voiceStatus()} />
}
