import { describe, expect, it } from 'vitest'
import { addNoise, createBus, type NoiseOptions } from './dsp'
import { SAMPLE_RATE } from './types'

function renderNoise(overrides: Partial<NoiseOptions> = {}): Float32Array {
  const bus = createBus(Math.round(SAMPLE_RATE * 0.05), SAMPLE_RATE)
  addNoise(bus, {
    startSec: 0,
    durationSec: 0.05,
    cutoffHz: 1200,
    filter: 'bandpass',
    q: 4,
    gain: 0.5,
    attackSec: 0.0005,
    decay: 0.5,
    pan: 0,
    seed: 1234,
    ...overrides,
  })
  return bus.left
}

describe('swept noise events', () => {
  it('is deterministic for a seed and leaves the static path unchanged', () => {
    const staticA = renderNoise()
    const staticB = renderNoise()
    const sameSweep = renderNoise({ endCutoffHz: 1200, endQ: 4 })

    expect(staticA).toEqual(staticB)
    expect(sameSweep).toEqual(staticA)
  })

  it('moves the filter when a sweep endpoint differs', () => {
    const staticSound = renderNoise()
    const sweptSound = renderNoise({ endCutoffHz: 280, endQ: 1.2 })

    let differences = 0
    for (let i = 0; i < staticSound.length; i += 1) {
      if (staticSound[i] !== sweptSound[i]) differences += 1
    }
    expect(differences).toBeGreaterThan(staticSound.length / 4)
  })

  it('stays finite through an extreme sweep and a short event', () => {
    const extreme = renderNoise({
      durationSec: 0.8,
      startSec: 0,
      cutoffHz: 10,
      endCutoffHz: 20_000,
      q: 0.08,
      endQ: 40,
      gain: 0.9,
      decay: 0.9,
    })
    const short = renderNoise({
      durationSec: 0.004,
      cutoffHz: 3000,
      endCutoffHz: 200,
      q: 20,
      endQ: 0.5,
    })

    expect(extreme.every((sample) => Number.isFinite(sample))).toBe(true)
    expect(short.every((sample) => Number.isFinite(sample))).toBe(true)
    expect(extreme.some((sample) => sample !== 0)).toBe(true)
    expect(short.some((sample) => sample !== 0)).toBe(true)
  })

  it('sweeps low-pass and high-pass filters without producing non-finite samples', () => {
    for (const filter of ['lowpass', 'highpass'] as const) {
      const samples = renderNoise({
        filter,
        cutoffHz: filter === 'lowpass' ? 6000 : 300,
        endCutoffHz: filter === 'lowpass' ? 300 : 6000,
        q: 2,
        endQ: 8,
      })
      expect(samples.every((sample) => Number.isFinite(sample))).toBe(true)
    }
  })
})
