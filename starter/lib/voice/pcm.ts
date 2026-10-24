// Raw 16-bit PCM (little-endian, mono) as it streams from the speech route.
// Network chunks can end in the middle of a sample, so the decoder carries the
// odd byte over to the next chunk. Pure, shared by the browser hook and tests.

export const SAMPLE_RATE = 22050

export class Pcm16Decoder {
  private carry: number | null = null

  /** Samples in -1..1 from the next chunk of bytes. */
  push(bytes: Uint8Array): Float32Array {
    let data = bytes
    if (this.carry !== null) {
      const joined = new Uint8Array(bytes.length + 1)
      joined[0] = this.carry
      joined.set(bytes, 1)
      data = joined
      this.carry = null
    }
    const whole = data.length - (data.length % 2)
    if (whole < data.length) this.carry = data[data.length - 1]!
    const out = new Float32Array(whole / 2)
    const view = new DataView(data.buffer, data.byteOffset, whole)
    for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768
    return out
  }
}

/** Seconds of speech the silent stand-in plays for a text: about 15 characters a second, at least 0.6 s. */
export function silentSeconds(text: string): number {
  return Math.max(0.6, Math.min(30, text.length / 15))
}

/** A WAV header plus silence, for players that need a container (mock mode, format=wav). */
export function silentWav(seconds: number, sampleRate = SAMPLE_RATE): Uint8Array {
  const samples = Math.round(seconds * sampleRate)
  const dataBytes = samples * 2
  const buf = new Uint8Array(44 + dataBytes)
  const v = new DataView(buf.buffer)
  const ascii = (at: number, s: string) => { for (let i = 0; i < s.length; i++) buf[at + i] = s.charCodeAt(i) }
  ascii(0, "RIFF"); v.setUint32(4, 36 + dataBytes, true); ascii(8, "WAVE")
  ascii(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ascii(36, "data"); v.setUint32(40, dataBytes, true)
  return buf
}
