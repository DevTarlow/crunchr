import type { ExportFormat, SoundVariation, SynthParams } from './types'
import { clamp, sanitizeHumanize, sanitizeParams } from './params'
import { bipolar, createRng, deriveSeed, type Rng } from './random'

/**
 * Humanize deliberately treats continuous material properties differently from
 * texture controls: a 20% setting should feel like a fresh take, not a different
 * material. See README for the exact mapping.
 */
export function buildVariations(
  baseParams: SynthParams,
  humanize: number,
  baseSeed: number,
  count = 10,
): SoundVariation[] {
  const base = sanitizeParams(baseParams)
  const amount = sanitizeHumanize(humanize) / 100

  return Array.from({ length: Math.max(1, Math.round(count)) }, (_, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1
    const rng = createRng(deriveSeed(baseSeed, 'variation', index))
    const durationFactor = 1 + bipolar(rng) * amount * 0.6
    const pitchFactor = 1 + bipolar(rng) * amount * 0.4
    const qFactor = 1 + bipolar(rng) * amount * 0.6
    const punchShift = bipolar(rng) * amount * 28
    const gritShift = bipolar(rng) * amount * 28
    const decayShift = bipolar(rng) * amount * 28

    return {
      index,
      seed: deriveSeed(baseSeed, 'take', index),
      params: sanitizeParams({
        durationMs: base.durationMs * durationFactor,
        pitchHz: base.pitchHz * pitchFactor,
        punch: base.punch + punchShift,
        resonance: base.resonance * qFactor,
        grit: base.grit + gritShift,
        decay: base.decay + decayShift,
      }),
    }
  })
}

/**
 * The Mutate button moves each displayed value by up to ±10% of its current
 * value. Random is relative to the current sound, so small values stay small.
 */
export function mutateParameters(
  params: SynthParams,
  humanize: number,
  rng: Rng,
): { params: SynthParams; humanize: number } {
  const factor = () => 1 + bipolar(rng) * 0.1
  return {
    params: sanitizeParams({
      durationMs: params.durationMs * factor(),
      pitchHz: params.pitchHz * factor(),
      punch: params.punch * factor(),
      resonance: params.resonance * factor(),
      grit: params.grit * factor(),
      decay: params.decay * factor(),
    }),
    humanize: sanitizeHumanize(humanize * factor()),
  }
}

/** Bounded jitter used by Surprise Me so it explores without leaving the material. */
export function jitterParameters(params: SynthParams, amount = 0.15, rng: Rng): SynthParams {
  const factor = () => 1 + bipolar(rng) * amount
  return sanitizeParams({
    durationMs: params.durationMs * factor(),
    pitchHz: params.pitchHz * factor(),
    punch: clamp(params.punch * factor(), 0, 100),
    resonance: params.resonance * factor(),
    grit: clamp(params.grit * factor(), 0, 100),
    decay: clamp(params.decay * factor(), 0, 100),
  })
}

export function safeSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
  return slug || 'sound'
}

export function variationFilename(
  presetSlug: string,
  index: number,
  format: ExportFormat,
): string {
  return `crunchr_${safeSlug(presetSlug)}_v${String(index).padStart(2, '0')}.${format}`
}

export function singleFilename(presetSlug: string, format: ExportFormat): string {
  return `crunchr_${safeSlug(presetSlug)}.${format}`
}

export function batchZipFilename(presetSlug: string, format: ExportFormat): string {
  return `crunchr_${safeSlug(presetSlug)}_variants_${format}.zip`
}
