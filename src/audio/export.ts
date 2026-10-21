import JSZip from 'jszip'
import type { ExportFormat, Preset, RenderedSound, SynthParams } from './types'
import { audioBufferToWav } from './wav'
import { encodeMp3, MP3_MIME } from './mp3'
import { synthesize } from './synthesis'
import {
  batchZipFilename,
  buildVariations,
  singleFilename,
  variationFilename,
} from './variations'

export interface BatchArchiveResult {
  bytes: Uint8Array
  filename: string
  files: string[]
}

export interface ExportFile {
  blob: Blob
  filename: string
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

export function renderedToMp3(sound: RenderedSound): Promise<Uint8Array> {
  const bufferLike = {
    numberOfChannels: sound.channels.length,
    sampleRate: sound.sampleRate,
    length: sound.channels[0].length,
    getChannelData: (channel: number) => sound.channels[channel],
  }
  return encodeMp3(
    Array.from({ length: bufferLike.numberOfChannels }, (_, channel) =>
      bufferLike.getChannelData(channel),
    ),
    bufferLike.sampleRate,
  )
}

async function renderedFile(
  sound: RenderedSound,
  filename: string,
  format: ExportFormat,
): Promise<ExportFile> {
  if (format === 'wav') {
    return { blob: new Blob([renderedToWav(sound)], { type: 'audio/wav' }), filename }
  }
  const bytes = await renderedToMp3(sound)
  const exactBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return {
    blob: new Blob([exactBuffer], { type: MP3_MIME }),
    filename,
  }
}

export function singleFileFor(
  preset: Preset,
  sound: RenderedSound,
  format: ExportFormat = 'wav',
): Promise<ExportFile> {
  return renderedFile(sound, singleFilename(preset.slug, format), format)
}

export function versionFileFor(
  presetSlug: string,
  index: number,
  sound: RenderedSound,
  format: ExportFormat = 'wav',
): Promise<ExportFile> {
  return renderedFile(sound, variationFilename(presetSlug, index, format), format)
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
  format?: ExportFormat
  count?: number
  onProgress?: BatchProgress
}): Promise<BatchArchiveResult> {
  const format = options.format ?? 'wav'
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
    const bytes = format === 'wav' ? new Uint8Array(renderedToWav(sound)) : await renderedToMp3(sound)
    const filename = variationFilename(options.preset.slug, variation.index, format)
    zip.file(filename, bytes)
    files.push(filename)
    options.onProgress?.(i + 1, variations.length)
  }

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    // MP3 is already compressed; storing it is faster and yields the same size.
    compression: format === 'wav' ? 'DEFLATE' : 'STORE',
    ...(format === 'wav' ? { compressionOptions: { level: 6 } } : {}),
  })

  return {
    bytes,
    filename: batchZipFilename(options.preset.slug, format),
    files,
  }
}

/**
 * Safe for any modern browser; the anchor stays available long enough for
 * slower mobile downloads to start, and the object URL is revoked afterwards.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 10_000)
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const exactBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  downloadBlob(new Blob([exactBuffer], { type: mime }), filename)
}
