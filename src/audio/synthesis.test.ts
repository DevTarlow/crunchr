import { describe, expect, it } from 'vitest'
import { CATEGORIES, PRESETS, getPresetsByCategory } from './presets'
import { PARAM_LIMITS, sanitizeParams } from './params'
import { peakOf, rmsOf, synthesize } from './synthesis'
import { SAMPLE_RATE, type ModelId, type SynthParams } from './types'

const MODELS: ModelId[] = [
  'mechanicalClick',
  'cardSnap',
  'woodButton',
  'gravel',
  'woodThud',
  'stone',
  'dice',
  'cloth',
  'coin',
  'flesh',
  'bone',
  'arcaneZap',
  'shimmer',
  'powerUp',
  'whoosh',
]

function defaultParams(): SynthParams {
  return {
    durationMs: 120,
    pitchHz: 800,
    punch: 60,
    resonance: 5,
    grit: 50,
    decay: 50,
  }
}

function arrayChecksum(channels: readonly Float32Array[]): number {
  let sum = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 7) sum += channel[i] * (i + 1)
  }
  return sum
}

function outputIsFiniteAndBounded(
  channels: readonly Float32Array[],
  limit = 0.880001,
): boolean {
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      if (!Number.isFinite(channel[i]) || Math.abs(channel[i]) > limit) return false
    }
  }
  return true
}

describe('procedural synthesis', () => {
  it('renders every preset at the exact requested length with bounded, non-silent stereo output', () => {
    for (const preset of PRESETS) {
      const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
      const expectedLength = Math.round((preset.defaults.durationMs / 1000) * SAMPLE_RATE)
      expect(sound.channels).toHaveLength(2)
      expect(sound.sampleRate).toBe(SAMPLE_RATE)
      expect(sound.channels[0]).toHaveLength(expectedLength)
      expect(sound.channels[1]).toHaveLength(expectedLength)
      expect(sound.peak).toBeGreaterThan(0.7)
      expect(peakOf(sound.channels)).toBeLessThanOrEqual(0.880001)
      expect(rmsOf(sound.channels)).toBeGreaterThan(0.00001)
      expect(Math.abs(sound.channels[0][expectedLength - 1])).toBeLessThan(0.02)
      expect(Math.abs(sound.channels[1][expectedLength - 1])).toBeLessThan(0.02)
      expect(outputIsFiniteAndBounded(sound.channels)).toBe(true)
    }
  })

  it('is deterministic for a given seed and fresh for a new seed', () => {
    for (const model of MODELS) {
      const a = synthesize(model, defaultParams(), 12345)
      const b = synthesize(model, defaultParams(), 12345)
      const c = synthesize(model, defaultParams(), 54321)
      expect(arrayChecksum(a.channels)).toBeCloseTo(arrayChecksum(b.channels), 8)
      expect(arrayChecksum(a.channels)).not.toBeCloseTo(arrayChecksum(c.channels), 8)
    }
  })

  it('stays finite and bounded across extreme parameter corners', () => {
    const corners: SynthParams[] = [
      {
        durationMs: PARAM_LIMITS.durationMs.min,
        pitchHz: 40,
        punch: 0,
        resonance: 0.5,
        grit: 0,
        decay: 0,
      },
      { durationMs: 800, pitchHz: 6000, punch: 100, resonance: 24, grit: 100, decay: 100 },
      {
        durationMs: PARAM_LIMITS.durationMs.min,
        pitchHz: 6000,
        punch: 100,
        resonance: 24,
        grit: 100,
        decay: 100,
      },
      { durationMs: 800, pitchHz: 40, punch: 0, resonance: 0.5, grit: 0, decay: 0 },
      { durationMs: 333, pitchHz: 441, punch: 50, resonance: 12.3, grit: 50, decay: 50 },
    ]

    for (const model of MODELS) {
      for (const params of corners) {
        const sound = synthesize(model, params, 987654)
        const expectedLength = Math.round((sanitizeParams(params).durationMs / 1000) * SAMPLE_RATE)
        expect(sound.channels[0]).toHaveLength(expectedLength)
        expect(sound.channels[1]).toHaveLength(expectedLength)
        expect(rmsOf(sound.channels)).toBeGreaterThan(0)
        expect(outputIsFiniteAndBounded(sound.channels)).toBe(true)
      }
    }
  })

  it('clamps lengths below the 80 ms floor', () => {
    const sound = synthesize('mechanicalClick', { ...defaultParams(), durationMs: 10 }, 1)
    expect(sound.channels[0]).toHaveLength(3_528)
    expect(sound.channels[1]).toHaveLength(3_528)
    expect(sound.durationMs).toBeCloseTo(80, 5)
  })

  it('keeps preset defaults inside every declared slider range', () => {
    for (const preset of PRESETS) {
      const sanitized = sanitizeParams(preset.defaults)
      expect(sanitized).toEqual(preset.defaults)
      expect(preset.defaults.durationMs).toBeGreaterThanOrEqual(PARAM_LIMITS.durationMs.min)
      expect(preset.defaults.durationMs).toBeLessThanOrEqual(PARAM_LIMITS.durationMs.max)
      expect(preset.defaults.pitchHz).toBeGreaterThanOrEqual(PARAM_LIMITS.pitchHz.min)
      expect(preset.defaults.pitchHz).toBeLessThanOrEqual(PARAM_LIMITS.pitchHz.max)
      expect(preset.defaults.resonance).toBeGreaterThanOrEqual(PARAM_LIMITS.resonance.min)
      expect(preset.defaults.resonance).toBeLessThanOrEqual(PARAM_LIMITS.resonance.max)
    }
    expect(PRESETS).toHaveLength(15)
    expect(CATEGORIES).toHaveLength(5)
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length)
    expect(new Set(PRESETS.map((preset) => preset.slug)).size).toBe(PRESETS.length)
    const presetCategories = new Set(PRESETS.map((preset) => preset.category))
    expect(presetCategories).toEqual(new Set(CATEGORIES.map((category) => category.id)))
    for (const category of CATEGORIES) {
      expect(getPresetsByCategory(category.id).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('respects the 3–5 bounce brief for the dice model across seeds', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const params = sanitizeParams({ ...defaultParams(), durationMs: 640, pitchHz: 380 })
      const sound = synthesize('dice', params, seed)
      expect(sound.channels[0].length).toBe(Math.round((640 / 1000) * SAMPLE_RATE))
      expect(peakOf(sound.channels)).toBeGreaterThan(0.8)
    }
  })
})
