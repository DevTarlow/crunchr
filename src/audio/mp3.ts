import { createEncoder, type WasmMediaEncoder } from 'wasm-media-encoders'
import wasmBase64 from 'virtual:crunchr-mp3-wasm'
import { MP3_BITRATE, SAMPLE_RATE } from './types'
import type { AudioBufferLike } from './wav'

export const MP3_MIME = 'audio/mpeg'

/** MPEG-1 Layer III frame size used as the encoder's input block. */
const FRAME_SAMPLES = 1152
const MP3_SAMPLE_RATES = new Set([
  8_000, 11_025, 12_000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000,
])

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

let encoderPromise: Promise<WasmMediaEncoder<'audio/mpeg'>> | null = null
let encodeQueue: Promise<unknown> = Promise.resolve()

function getEncoder(): Promise<WasmMediaEncoder<'audio/mpeg'>> {
  if (!encoderPromise) {
    const created = createEncoder('audio/mpeg', decodeBase64(wasmBase64))
    encoderPromise = created.catch((error: unknown) => {
      encoderPromise = null
      throw error
    })
  }
  return encoderPromise
}

/** Compile the WASM encoder ahead of the first MP3 export. */
export function warmMp3Encoder(): Promise<void> {
  return getEncoder().then(() => undefined)
}

function validateChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
): { channelCount: 1 | 2; frameCount: number; rate: number } {
  if (channels.length < 1 || channels.length > 2) {
    throw new RangeError('MP3 export supports one or two channels.')
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('A positive sample rate is required.')
  }

  const rate = Math.round(sampleRate)
  if (!MP3_SAMPLE_RATES.has(rate)) {
    throw new RangeError('MP3 export requires a standard MPEG sample rate.')
  }

  const frameCount = channels[0]?.length ?? 0
  if (frameCount < 1) {
    throw new RangeError('MP3 export needs at least one sample frame.')
  }
  if (!channels.every((channel) => channel.length === frameCount)) {
    throw new RangeError('All MP3 channels must contain the same number of frames.')
  }

  return { channelCount: channels.length === 1 ? 1 : 2, frameCount, rate }
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const part of parts) length += part.length
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

async function encodeNow(
  channels: readonly Float32Array[],
  sampleRate: number,
): Promise<Uint8Array> {
  const { channelCount, frameCount, rate } = validateChannels(channels, sampleRate)
  const encoder = await getEncoder()

  try {
    encoder.configure({ sampleRate: rate, channels: channelCount, bitrate: MP3_BITRATE })
    const parts: Uint8Array[] = []

    for (let offset = 0; offset < frameCount; offset += FRAME_SAMPLES) {
      const left = channels[0].subarray(offset, offset + FRAME_SAMPLES)
      const right =
        channelCount === 2 ? channels[1].subarray(offset, offset + FRAME_SAMPLES) : null
      // The encoder owns the returned view and overwrites it on the next call,
      // so copy every block before encoding the next one.
      const chunk = right ? encoder.encode([left, right]) : encoder.encode([left])
      if (chunk.length > 0) parts.push(chunk.slice())
    }

    const tail = encoder.finalize()
    if (tail.length > 0) parts.push(tail.slice())

    if (parts.length === 0) {
      throw new Error('The MP3 encoder returned no audio.')
    }
    return concatenate(parts)
  } catch (error) {
    // A failed configure/encode may leave the WASM instance unusable.
    encoderPromise = null
    throw error
  }
}

/**
 * Encode float PCM as MPEG-1 Layer III at 44.1 kHz / 192 kbps. Calls are queued
 * because the WASM encoder is a single mutable instance.
 */
export function encodeMp3(
  channels: readonly Float32Array[],
  sampleRate = SAMPLE_RATE,
): Promise<Uint8Array> {
  const run = encodeQueue.then(() => encodeNow(channels, sampleRate))
  encodeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** AudioBuffer-shaped wrapper, mirroring `audioBufferToWav`. */
export function audioBufferToMp3(audioBuffer: AudioBufferLike): Promise<Uint8Array> {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel))
  }
  return encodeMp3(channels, audioBuffer.sampleRate)
}
