import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildBatchArchive, renderedToWav } from './export'
import { getPresetById } from './presets'
import { buildVariations } from './variations'
import { synthesize } from './synthesis'
import { SAMPLE_RATE } from './types'

function ascii(view: DataView, offset: number, length: number): string {
  let result = ''
  for (let i = 0; i < length; i += 1) result += String.fromCharCode(view.getUint8(offset + i))
  return result
}

describe('batch ZIP export', () => {
  it('wraps ten valid 44.1 kHz stereo WAV files with the requested filename', async () => {
    const preset = getPresetById('mechanical-click')
    const progress: number[] = []
    const result = await buildBatchArchive({
      preset,
      params: preset.defaults,
      humanize: 25,
      seed: 0xabcdef,
      onProgress: (completed) => progress.push(completed),
    })

    expect(result.filename).toBe('crunchr_mechanical_click_variants.zip')
    expect(result.files).toHaveLength(10)
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result.bytes).toBeInstanceOf(Uint8Array)
    expect(result.bytes[0]).toBe(0x50)
    expect(result.bytes[1]).toBe(0x4b)

    const archive = await JSZip.loadAsync(result.bytes)
    const entries = Object.keys(archive.files).filter((name) => !archive.files[name].dir)
    expect(entries).toEqual(result.files)
    expect(entries).toHaveLength(10)

    for (const filename of entries) {
      expect(filename).toMatch(/^crunchr_mechanical_click_v\d{2}\.wav$/)
      const bytes = await archive.files[filename].async('uint8array')
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      expect(ascii(view, 0, 4)).toBe('RIFF')
      expect(ascii(view, 8, 4)).toBe('WAVE')
      expect(view.getUint16(20, true)).toBe(1)
      expect(view.getUint16(22, true)).toBe(2)
      expect(view.getUint32(24, true)).toBe(SAMPLE_RATE)
      expect(view.getUint16(34, true)).toBe(16)
      expect(view.getUint32(40, true)).toBe(view.byteLength - 44)
    }
  }, 20_000)

  it('produces humanized variations that are not all byte-identical', async () => {
    const preset = getPresetById('coin-clink')
    const result = await buildBatchArchive({
      preset,
      params: preset.defaults,
      humanize: 25,
      seed: 0x4444,
    })
    const archive = await JSZip.loadAsync(result.bytes)
    const first = await archive.files[result.files[0]].async('uint8array')
    const second = await archive.files[result.files[1]].async('uint8array')
    const last = await archive.files[result.files[9]].async('uint8array')
    expect(first.byteLength).toBeGreaterThan(44)
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false)
    expect(Buffer.from(first).equals(Buffer.from(last))).toBe(false)
  }, 20_000)

  it('renders the current take through the public WAV wrapper', () => {
    const preset = getPresetById('dice-roll')
    const sound = synthesize(preset.model, preset.defaults, 99)
    const wav = renderedToWav(sound)
    const view = new DataView(wav)
    expect(view.getUint32(24, true)).toBe(44_100)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(40, true)).toBe(wav.byteLength - 44)
    expect(wav.byteLength).toBe(44 + sound.channels[0].length * 2 * 2)
  })

  it('builds deterministic humanized parameter sets for the archive', () => {
    const variations = buildVariations(getPresetById('bone-crunch').defaults, 20, 17)
    expect(variations).toHaveLength(10)
    expect(variations[0].params).not.toEqual(variations[9].params)
  })
})
