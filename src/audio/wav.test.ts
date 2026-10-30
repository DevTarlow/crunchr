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

  it('writes a canonical 3,748-byte header for a 21 ms buffer', () => {
    const frames = 926
    const buffer = encodeWav(
      [new Float32Array(frames).fill(0.25), new Float32Array(frames).fill(-0.25)],
      44_100,
    )
    const view = new DataView(buffer)
    const header = Array.from(new Uint8Array(buffer).subarray(0, 44), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')

    // The encoder stays correct for a 21 ms buffer even though the UI now
    // floors Length at 80 ms. This locks the container math independently of
    // the control range: 3,748 bytes, 3,740-byte RIFF chunk, 3,704 bytes of
    // data and no trailing pad byte.
    expect(buffer.byteLength).toBe(3_748)
    expect(view.getUint32(4, true)).toBe(3_740)
    expect(view.getUint32(40, true)).toBe(3_704)
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint32(28, true)).toBe(176_400)
    expect(view.getUint16(32, true)).toBe(4)
    expect(header).toBe(
      '524946469c0e000057415645666d7420100000000100020044ac000010b102000400100064617461780e0000',
    )
  })

  it('keeps every clip frame-aligned with matching chunk sizes', () => {
    for (const frames of [1, 441, 926, 927, 3_528, 35_280]) {
      for (const channelCount of [1, 2]) {
        const channels = Array.from(
          { length: channelCount },
          () => new Float32Array(frames),
        )
        const buffer = encodeWav(channels, 44_100)
        const view = new DataView(buffer)
        const blockAlign = channelCount * 2
        const dataBytes = frames * blockAlign

        expect(buffer.byteLength).toBe(44 + dataBytes)
        expect(view.getUint32(4, true)).toBe(buffer.byteLength - 8)
        expect(view.getUint32(40, true)).toBe(dataBytes)
        expect(view.getUint16(32, true)).toBe(blockAlign)
        expect(view.getUint32(28, true)).toBe(44_100 * blockAlign)
        expect(dataBytes % blockAlign).toBe(0)
        expect(buffer.byteLength % 2).toBe(0)
      }
    }
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
