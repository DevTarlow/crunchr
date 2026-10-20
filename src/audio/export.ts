import JSZip from 'jszip'
import type { Preset, RenderedSound, SynthParams } from './types'
import { audioBufferToWav } from './wav'
import { synthesize } from './synthesis'
import {
  batchZipFilename,
  buildVariations,
  singleWavFilename,
  variationWavFilename,
} from './variations'

export interface BatchArchiveResult {
  bytes: Uint8Array
  filename: string
  files: string[]
}

export type BatchProgress = (completed: number, total: number) => void

/**
 * Convert the renderer's stereo channels through the public AudioBuffer-shaped
 * wrapper, keeping the exact required audioBufferToWav path exercised in-app.
 */
export function renderedToWav(sound: RenderedSound): ArrayBuffer {
  const bufferLike = {
    numberOfChannels: sound.channels.length,
    sampleRate: sound.sampleRate,
    length: sound.channels[0].length,
    getChannelData: (channel: number) => sound.channels[channel],
  }
  return audioBufferToWav(bufferLike)
}

export function renderedToBlob(sound: RenderedSound): Blob {
  return new Blob([renderedToWav(sound)], { type: 'audio/wav' })
}

export function singleWavFor(preset: Preset, sound: RenderedSound): { blob: Blob; filename: string } {
  return {
    blob: renderedToBlob(sound),
    filename: singleWavFilename(preset.slug),
  }
}

/**
 * Render ten deterministic humanized takes and package them with JSZip. Browser
 * and app state never need to be touched directly by this function, which keeps
 * batch export easy to test.
 */
export async function buildBatchArchive(options: {
  preset: Preset
  params: SynthParams
  humanize: number
  seed: number
  count?: number
  onProgress?: BatchProgress
}): Promise<BatchArchiveResult> {
  const count = options.count ?? 10
  const variations = buildVariations(options.params, options.humanize, options.seed, count)
  const zip = new JSZip()
  const files: string[] = []

  for (let i = 0; i < variations.length; i += 1) {
    // Yield one macrotask per file so the progress UI and button state paint
    // even on low-end phones.
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0)
    })
    const variation = variations[i]
    const sound = synthesize(options.preset.model, variation.params, variation.seed)
    const wav = renderedToWav(sound)
    const filename = variationWavFilename(options.preset.slug, variation.index)
    zip.file(filename, wav)
    files.push(filename)
    options.onProgress?.(i + 1, variations.length)
  }

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return {
    bytes,
    filename: batchZipFilename(options.preset.slug),
    files,
  }
}

/** Safe for any modern browser; revokes the object URL after the click. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const exactBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  downloadBlob(new Blob([exactBuffer], { type: mime }), filename)
}
