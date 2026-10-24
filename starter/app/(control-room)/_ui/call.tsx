"use client"

import { useEffect, useRef, useState } from "react"
import type { Call } from "@/lib/control-room/types"
import { Icon } from "./icons"

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** The agent's call: play the recording, read the transcript, with a translation under every line. */
export function CallBlock({ call, placeName, meta }: { call: Call; placeName: string; meta: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [missing, setMissing] = useState(!call.audioUrl)
  const [pos, setPos] = useState(0)
  const [dur, setDur] = useState<number | null>(null)

  useEffect(() => {
    const a = audio.current
    if (!a) return
    const onTime = () => setPos(a.currentTime)
    const onMeta = () => setDur(Number.isFinite(a.duration) ? a.duration : null)
    const onEnd = () => setPlaying(false)
    const onErr = () => setMissing(true)
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("loadedmetadata", onMeta)
    a.addEventListener("ended", onEnd)
    a.addEventListener("error", onErr)
    return () => {
      a.removeEventListener("timeupdate", onTime)
      a.removeEventListener("loadedmetadata", onMeta)
      a.removeEventListener("ended", onEnd)
      a.removeEventListener("error", onErr)
    }
  }, [])

  const toggle = async () => {
    const a = audio.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      try {
        await a.play()
        setPlaying(true)
      } catch {
        setMissing(true)
      }
    }
  }

  return (
    <div>
      <div className="call-head">
        {!missing ? (
          <button type="button" className="btn btn-secondary btn-small play" onClick={toggle} aria-pressed={playing}>
            <Icon name={playing ? "pause" : "play"} size={14} />
            {playing ? "Pause" : "Play the call"}
            {dur !== null && <span className="num">{playing || pos > 0 ? `${fmt(pos)} of ${fmt(dur)}` : fmt(dur)}</span>}
          </button>
        ) : null}
        <span className="call-meta">
          {meta}
          {missing && call.audioUrl ? " The recording is not ready yet." : ""}
        </span>
      </div>
      {call.audioUrl && <audio ref={audio} src={call.audioUrl} preload="metadata" />}
      {call.turns.length > 0 && (
        <ol className="transcript">
          {call.turns.map((t, i) => (
            <li key={i} className={`turn${t.speaker === "agent" ? " is-agent" : ""}`}>
              <span className="who">{t.speaker === "agent" ? "Readiness agent" : placeName}</span>
              <div>
                <p className="said" lang={call.language}>
                  {t.text}
                </p>
                {t.translation && <p className="translated">Translated: {t.translation}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
