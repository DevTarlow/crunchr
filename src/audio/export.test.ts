import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  buildBatchArchive,
  renderedToMp3,
  renderedToWav,
  singleFileFor,
  versionFileFor,
} from './export'
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

    expect(result.filename).toBe('crunchr_mechanical_click_variants_wav.zip')
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

describe('format-aware file export', () => {
  it('exports the 80 ms minimum as a canonical 14,156-byte WAV', async () => {
    const preset = getPresetById('dice-roll')
    const sound = synthesize(preset.model, { ...preset.defaults, durationMs: 80 }, 7)
    expect(sound.channels[0].length).toBe(3_528)

    const file = await singleFileFor(preset, sound, 'wav')
    expect(file.filename).toBe('crunchr_dice_roll.wav')
    expect(file.blob.size).toBe(14_156)

    const view = new DataView(await file.blob.arrayBuffer())
    expect(view.getUint32(4, true)).toBe(14_148)
    expect(view.getUint32(40, true)).toBe(14_112)
    expect(view.getUint16(32, true)).toBe(4)
  })

  it('names and types single WAV and MP3 files correctly', async () => {
    const preset = getPresetById('dice-roll')
    const sound = synthesize(preset.model, preset.defaults, 99)

    const wavFile = await singleFileFor(preset, sound, 'wav')
    expect(wavFile.filename).toBe('crunchr_dice_roll.wav')
    expect(wavFile.blob.type).toBe('audio/wav')

    const mp3File = await singleFileFor(preset, sound, 'mp3')
    expect(mp3File.filename).toBe('crunchr_dice_roll.mp3')
    expect(mp3File.blob.type).toBe('audio/mpeg')
    const mp3Bytes = new Uint8Array(await mp3File.blob.arrayBuffer())
    expect(mp3Bytes[0]).toBe(0xff)
    expect(mp3Bytes[1]! & 0xe0).toBe(0xe0)
  }, 20_000)

  it('wraps the current take as MP3 through the shared encoder', () => {
    const preset = getPresetById('coin-clink')
    const sound = synthesize(preset.model, preset.defaults, 7)
    return renderedToMp3(sound).then((bytes) => {
      expect(bytes.length).toBeGreaterThan(100)
      expect(bytes[0]).toBe(0xff)
    })
  })

  it('packages ten MP3s and names the archive for the format', async () => {
    const preset = getPresetById('mechanical-click')
    const progress: number[] = []
    const result = await buildBatchArchive({
      preset,
      params: preset.defaults,
      humanize: 25,
      seed: 0xbeef,
      format: 'mp3',
      onProgress: (completed) => progress.push(completed),
    })

    expect(result.filename).toBe('crunchr_mechanical_click_variants_mp3.zip')
    expect(result.files).toHaveLength(10)
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    const archive = await JSZip.loadAsync(result.bytes)
    const entries = Object.keys(archive.files).filter((name) => !archive.files[name].dir)
    expect(entries).toEqual(result.files)
    for (const filename of entries) {
      expect(filename).toMatch(/^crunchr_mechanical_click_v\d{2}\.mp3$/)
      const bytes = await archive.files[filename].async('uint8array')
      expect(bytes[0]).toBe(0xff)
      expect(bytes[1]! & 0xe0).toBe(0xe0)
    }
  }, 30_000)

  it('makes a single MP3 version byte-identical to its ZIP entry', async () => {
    const preset = getPresetById('coin-clink')
    const humanize = 25
    const seed = 0x4444
    const result = await buildBatchArchive({
      preset,
      params: preset.defaults,
      humanize,
      seed,
      format: 'mp3',
    })
    const archive = await JSZip.loadAsync(result.bytes)
    const variation = buildVariations(preset.defaults, humanize, seed)[2]
    const sound = synthesize(preset.model, variation.params, variation.seed)
    const file = await versionFileFor(preset.slug, 3, sound, 'mp3')

    expect(file.filename).toBe('crunchr_coin_clink_v03.mp3')
    const versionBytes = new Uint8Array(await file.blob.arrayBuffer())
    const zipBytes = await archive.files['crunchr_coin_clink_v03.mp3'].async('uint8array')
    expect(Buffer.from(versionBytes).equals(Buffer.from(zipBytes))).toBe(true)
  }, 30_000)
})
