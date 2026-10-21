import { describe, expect, it } from 'vitest'
import {
  batchZipFilename,
  buildVariations,
  mutateParameters,
  singleFilename,
  variationFilename,
} from './variations'
import { createRng } from './random'
import { sanitizeParams } from './params'
import type { SynthParams } from './types'

const BASE: SynthParams = {
  durationMs: 240,
  pitchHz: 900,
  punch: 65,
  resonance: 6.5,
  grit: 55,
  decay: 40,
}

describe('humanized batch variations', () => {
  it('produces ten deterministic, independently seeded takes', () => {
    const first = buildVariations(BASE, 20, 0x12345678)
    const second = buildVariations(BASE, 20, 0x12345678)
    expect(first).toHaveLength(10)
    expect(first).toEqual(second)
    expect(new Set(first.map((variation) => variation.seed)).size).toBe(10)
    expect(first.map((variation) => variation.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(variationFilename('mechanical_click', 1, 'wav')).toBe(
      'crunchr_mechanical_click_v01.wav',
    )
    expect(variationFilename('mechanical_click', 10, 'mp3')).toBe(
      'crunchr_mechanical_click_v10.mp3',
    )
    expect(singleFilename('coin_clink', 'wav')).toBe('crunchr_coin_clink.wav')
    expect(singleFilename('coin_clink', 'mp3')).toBe('crunchr_coin_clink.mp3')
    expect(batchZipFilename('coin_clink', 'wav')).toBe(
      'crunchr_coin_clink_variants_wav.zip',
    )
    expect(batchZipFilename('coin_clink', 'mp3')).toBe(
      'crunchr_coin_clink_variants_mp3.zip',
    )
  })

  it('keeps every drifted parameter legal and within the humanize envelope', () => {
    const humanize = 37
    const variations = buildVariations(BASE, humanize, 42)
    const durationLimit = 0.6 * (humanize / 100)
    const pitchLimit = 0.4 * (humanize / 100)
    const qLimit = 0.6 * (humanize / 100)
    const pointsLimit = 28 * (humanize / 100)

    for (const variation of variations) {
      expect(variation.params.durationMs).toBeGreaterThanOrEqual(10)
      expect(variation.params.durationMs).toBeLessThanOrEqual(800)
      expect(variation.params.pitchHz).toBeGreaterThanOrEqual(40)
      expect(variation.params.pitchHz).toBeLessThanOrEqual(6000)
      expect(variation.params.punch).toBeGreaterThanOrEqual(0)
      expect(variation.params.punch).toBeLessThanOrEqual(100)
      expect(variation.params.resonance).toBeGreaterThanOrEqual(0.5)
      expect(variation.params.resonance).toBeLessThanOrEqual(24)
      // Rounding to whole milliseconds/Hz and one decimal Q means the sampled
      // value can differ by at most the slider's smallest step.
      expect(
        Math.abs(variation.params.durationMs / BASE.durationMs - 1),
      ).toBeLessThanOrEqual(durationLimit + 0.005)
      expect(Math.abs(variation.params.pitchHz / BASE.pitchHz - 1)).toBeLessThanOrEqual(
        pitchLimit + 0.005,
      )
      expect(Math.abs(variation.params.resonance / BASE.resonance - 1)).toBeLessThanOrEqual(
        qLimit + 0.02,
      )
      expect(Math.abs(variation.params.punch - BASE.punch)).toBeLessThanOrEqual(pointsLimit + 1)
      expect(Math.abs(variation.params.grit - BASE.grit)).toBeLessThanOrEqual(pointsLimit + 1)
      expect(Math.abs(variation.params.decay - BASE.decay)).toBeLessThanOrEqual(pointsLimit + 1)
    }
  })

  it('has no parameter drift at 0% humanize but still re-seeds noise', () => {
    const variations = buildVariations(BASE, 0, 31415)
    for (const variation of variations) {
      expect(variation.params).toEqual(sanitizeParams(BASE))
    }
    expect(new Set(variations.map((variation) => variation.seed)).size).toBe(10)
  })

  it('clamps humanize and count to useful values', () => {
    expect(buildVariations(BASE, 400, 1)).toHaveLength(10)
    expect(buildVariations(BASE, -5, 1)).toHaveLength(10)
    expect(buildVariations(BASE, 20, 1, 3)).toHaveLength(3)
  })
})

describe('session mutations', () => {
  it('moves each current value by no more than 10% and clamps to range', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const mutated = mutateParameters(BASE, 20, createRng(seed))
      expect(mutated.params.durationMs).toBeGreaterThanOrEqual(10)
      expect(mutated.params.durationMs).toBeLessThanOrEqual(800)
      expect(Math.abs(mutated.params.pitchHz / BASE.pitchHz - 1)).toBeLessThanOrEqual(0.1001)
      expect(Math.abs(mutated.humanize / 20 - 1)).toBeLessThanOrEqual(0.1001)
    }
  })

  it('does not let humanize escape 0–50', () => {
    const low = mutateParameters(BASE, 0, createRng(7))
    const high = mutateParameters(BASE, 50, createRng(7))
    expect(low.humanize).toBeGreaterThanOrEqual(0)
    expect(high.humanize).toBeLessThanOrEqual(50)
  })
})
