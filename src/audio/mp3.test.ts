import { describe, expect, it } from 'vitest'
import { audioBufferToMp3, encodeMp3, warmMp3Encoder } from './mp3'
import { MP3_BITRATE, SAMPLE_RATE } from './types'

function stereoTestSignal(frameCount = SAMPLE_RATE / 4): Float32Array[] {
  const left = new Float32Array(frameCount)
  const right = new Float32Array(frameCount)
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * frame) / SAMPLE_RATE) * 0.5
    left[frame] = sample
    right[frame] = sample * 0.75
  }
  return [left, right]
}

function parseMp3(buffer: Uint8Array) {
  expect(buffer.length).toBeGreaterThan(100)
  expect(buffer[0]).toBe(0xff)
  expect(buffer[1]! & 0xe0).toBe(0xe0)

  const version = (buffer[1]! >> 3) & 0x03
  const layer = (buffer[1]! >> 1) & 0x03
  const bitrateIndex = (buffer[2]! >> 4) & 0x0f
  const sampleRateIndex = (buffer[2]! >> 2) & 0x03
  const channelMode = (buffer[3]! >> 6) & 0x03

  // MPEG-1, Layer III, 192 kbps, 44.1 kHz, stereo or joint stereo.
  expect(version).toBe(0x03)
  expect(layer).toBe(0x01)
  expect(bitrateIndex).toBe(0x0b)
  expect(sampleRateIndex).toBe(0x00)
  expect([0x00, 0x01]).toContain(channelMode)

  let frames = 0
  let offset = 0
  while (offset + 4 <= buffer.length) {
    expect(buffer[offset]).toBe(0xff)
    expect(buffer[offset + 1]! & 0xe0).toBe(0xe0)
    const padding = (buffer[offset + 2]! >> 1) & 0x01
    const frameLength = Math.floor((144 * MP3_BITRATE * 1000) / SAMPLE_RATE) + padding
    expect(frameLength).toBeGreaterThan(100)
    frames += 1
    offset += frameLength
  }

  expect(offset).toBe(buffer.length)
  expect(frames).toBeGreaterThan(1)
  return { frames }
}

describe('encodeMp3', () => {
  it('writes valid MPEG-1 Layer III stereo frames at 44.1 kHz / 192 kbps', async () => {
    const bytes = await encodeMp3(stereoTestSignal())
    const { frames } = parseMp3(bytes)
    expect(frames).toBeGreaterThan(3)
  }, 20_000)

  it('is deterministic for identical input', async () => {
    const [left, right] = stereoTestSignal(SAMPLE_RATE / 10)
    const first = await encodeMp3([left, right])
    const second = await encodeMp3([left, right])
    expect(Array.from(first)).toEqual(Array.from(second))
  }, 20_000)

  it('serializes concurrent encodes without corrupting either result', async () => {
    const [leftA, rightA] = stereoTestSignal(SAMPLE_RATE / 12)
    const [leftB, rightB] = stereoTestSignal(SAMPLE_RATE / 16)
    const sequentialA = await encodeMp3([leftA, rightA])
    const sequentialB = await encodeMp3([leftB, rightB])

    const [concurrentA, concurrentB] = await Promise.all([
      encodeMp3([leftA, rightA]),
      encodeMp3([leftB, rightB]),
    ])

    expect(Array.from(concurrentA)).toEqual(Array.from(sequentialA))
    expect(Array.from(concurrentB)).toEqual(Array.from(sequentialB))
    parseMp3(concurrentA)
    parseMp3(concurrentB)
  }, 20_000)

  it('keeps earlier output intact when the encoder is used again', async () => {
    const first = await encodeMp3(stereoTestSignal(SAMPLE_RATE / 20))
    const firstSnapshot = Array.from(first)
    await encodeMp3(stereoTestSignal(SAMPLE_RATE / 30))
    expect(Array.from(first)).toEqual(firstSnapshot)
  }, 20_000)

  it('wraps an AudioBuffer-like object and warms the encoder', async () => {
    await expect(warmMp3Encoder()).resolves.toBeUndefined()
    const [left, right] = stereoTestSignal(SAMPLE_RATE / 20)
    const bytes = await audioBufferToMp3({
      numberOfChannels: 2,
      sampleRate: SAMPLE_RATE,
      length: left.length,
      getChannelData: (channel) => (channel === 0 ? left : right),
    })
    parseMp3(bytes)
  }, 20_000)

  it('rejects unsupported channel layouts and sample rates', async () => {
    const [left, right] = stereoTestSignal(64)
    await expect(encodeMp3([left, right, new Float32Array(64)])).rejects.toBeInstanceOf(
      RangeError,
    )
    await expect(encodeMp3([left, new Float32Array(63)])).rejects.toBeInstanceOf(RangeError)
    await expect(encodeMp3([new Float32Array(0)])).rejects.toBeInstanceOf(RangeError)
    await expect(encodeMp3([left, right], 12_345)).rejects.toBeInstanceOf(RangeError)
  })
})
