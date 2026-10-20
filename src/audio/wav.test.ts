import { describe, expect, it } from 'vitest'
import { audioBufferToWav, encodeWav } from './wav'
import { SAMPLE_RATE } from './types'

function readString(view: DataView, offset: number, length: number): string {
  let result = ''
  for (let i = 0; i < length; i += 1) result += String.fromCharCode(view.getUint8(offset + i))
  return result
}

describe('encodeWav', () => {
  it('writes a valid mono 16-bit PCM RIFF header and samples', () => {
    const samples = new Float32Array([-1, -0.5, 0, 0.5, 1])
    const buffer = encodeWav([samples], SAMPLE_RATE)
    const view = new DataView(buffer)

    expect(readString(view, 0, 4)).toBe('RIFF')
    expect(readString(view, 8, 4)).toBe('WAVE')
    expect(readString(view, 12, 4)).toBe('fmt ')
    expect(readString(view, 36, 4)).toBe('data')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(10)
    expect(view.byteLength).toBe(44 + 10)
    expect(view.getInt16(44, true)).toBe(-32768)
    expect(view.getInt16(46, true)).toBe(-16384)
    expect(view.getInt16(48, true)).toBe(0)
    expect(view.getInt16(50, true)).toBe(16384)
    expect(view.getInt16(52, true)).toBe(32767)
  })

  it('interleaves stereo samples and reports the correct sizes', () => {
    const left = new Float32Array([0.25, -0.25])
    const right = new Float32Array([0.5, -0.5])
    const buffer = encodeWav([left, right], 44_100)
    const view = new DataView(buffer)

    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(28, true)).toBe(44_100 * 4)
    expect(view.getUint16(32, true)).toBe(4)
    expect(view.getUint32(40, true)).toBe(8)
    expect(view.byteLength).toBe(52)
    expect(view.getInt16(44, true)).toBeGreaterThan(8000)
    expect(view.getInt16(46, true)).toBeGreaterThan(16000)
    expect(view.getInt16(48, true)).toBeLessThan(-8000)
    expect(view.getInt16(50, true)).toBeLessThan(-16000)
  })

  it('clips sample values and tolerates non-finite input', () => {
    const buffer = encodeWav([new Float32Array([1.5, -1.5, Number.NaN])], 44_100)
    const view = new DataView(buffer)
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32768)
    expect(view.getInt16(48, true)).toBe(0)
  })

  it('rejects unsupported channel counts and mismatched lengths', () => {
    expect(() =>
      encodeWav([new Float32Array(2), new Float32Array(2), new Float32Array(2)]),
    ).toThrow(RangeError)
    expect(() => encodeWav([new Float32Array(2), new Float32Array(3)])).toThrow(RangeError)
    expect(() => encodeWav([])).toThrow(RangeError)
  })
})

describe('audioBufferToWav', () => {
  it('encodes an AudioBuffer-like object through the required standalone wrapper', () => {
    const left = new Float32Array([0.1, 0.2])
    const right = new Float32Array([-0.1, -0.2])
    const buffer = audioBufferToWav({
      numberOfChannels: 2,
      sampleRate: 48_000,
      length: 2,
      getChannelData: (channel) => (channel === 0 ? left : right),
    })
    const view = new DataView(buffer)
    expect(readString(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(48_000)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(40, true)).toBe(8)
  })
})
