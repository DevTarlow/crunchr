import { SAMPLE_RATE, WAV_BIT_DEPTH } from './types'

/**
 * Minimal structural view of an AudioBuffer. Keeping the encoder independent of
 * the concrete browser class makes it testable in Node and usable with the
 * renderer's Float32 channels directly.
 */
export interface AudioBufferLike {
  numberOfChannels: number
  sampleRate: number
  length: number
  getChannelData(channel: number): Float32Array
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

/**
 * Encode one or two channels of Float32 PCM as a standards-compliant 16-bit
 * little-endian RIFF/WAVE file. No dependencies and no browser APIs are used.
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate = SAMPLE_RATE): ArrayBuffer {
  if (channels.length < 1 || channels.length > 2) {
    throw new RangeError('WAV export supports one or two channels.')
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('A positive sample rate is required.')
  }

  const frameCount = channels[0]?.length ?? 0
  if (!channels.every((channel) => channel.length === frameCount)) {
    throw new RangeError('All WAV channels must contain the same number of frames.')
  }

  const channelCount = channels.length
  const blockAlign = channelCount * (WAV_BIT_DEPTH / 8)
  // 16-bit frames make the block size even (2 bytes mono, 4 bytes stereo), so
  // the data chunk is always a whole number of frames and RIFF never needs a
  // trailing pad byte, even for a clip below the UI's 80 ms minimum.
  const dataByteLength = frameCount * blockAlign
  const buffer = new ArrayBuffer(44 + dataByteLength)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataByteLength, true)
  writeAscii(view, 8, 'WAVE')

  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // format 1 = uncompressed PCM
  view.setUint16(22, channelCount, true)
  view.setUint32(24, Math.round(sampleRate), true)
  view.setUint32(28, Math.round(sampleRate) * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, WAV_BIT_DEPTH, true)

  writeAscii(view, 36, 'data')
  view.setUint32(40, dataByteLength, true)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = channels[channel][frame]
      const clamped = Number.isFinite(source) ? Math.min(1, Math.max(-1, source)) : 0
      // Negative values use 32768 so -1 maps exactly to the 16-bit minimum.
      const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(sample))), true)
      offset += 2
    }
  }

  return buffer
}

/**
 * Required standalone browser-friendly entry point. Accepts an AudioBuffer (or
 * any structural equivalent) and returns a complete 16-bit PCM WAV ArrayBuffer.
 */
export function audioBufferToWav(audioBuffer: AudioBufferLike): ArrayBuffer {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel))
  }
  return encodeWav(channels, audioBuffer.sampleRate)
}
