import { describe, expect, it } from 'vitest'
import { getPresetById } from './presets'
import { peakOf, rmsOf, synthesize } from './synthesis'
import type { RenderedSound, SynthParams } from './types'

/**
 * Timbre regression checks for the four retuned presets. These are deliberately
 * coarse: they assert the broad gesture (transient-led, noise-led, no drone)
 * rather than locking an exact waveform, so the models can still be tuned.
 */

const REFINED_PRESET_IDS = [
  'mechanical-click',
  'card-snap',
  'concrete-step',
  'flesh-squish',
] as const

const MAGIC_PRESET_IDS = [
  'arcane-zap',
  'magic-shimmer',
  'power-up',
  'spell-whoosh',
] as const

const MOVEMENT_PRESET_IDS = ['jump-takeoff', 'heavy-landing', 'hit-impact'] as const

const TUNED_PRESET_IDS = [
  ...REFINED_PRESET_IDS,
  ...MAGIC_PRESET_IDS,
  ...MOVEMENT_PRESET_IDS,
] as const

function fft(real: Float64Array, imag: Float64Array): void {
  const size = real.length
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[real[i], real[j]] = [real[j], real[i]]
      ;[imag[i], imag[j]] = [imag[j], imag[i]]
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (let start = 0; start < size; start += length) {
      let cosStep = 1
      let sinStep = 0
      for (let offset = 0; offset < length / 2; offset += 1) {
        const evenReal = real[start + offset]
        const evenImag = imag[start + offset]
        const oddReal =
          real[start + offset + length / 2] * cosStep -
          imag[start + offset + length / 2] * sinStep
        const oddImag =
          real[start + offset + length / 2] * sinStep +
          imag[start + offset + length / 2] * cosStep
        real[start + offset] = evenReal + oddReal
        imag[start + offset] = evenImag + oddImag
        real[start + offset + length / 2] = evenReal - oddReal
        imag[start + offset + length / 2] = evenImag - oddImag
        const nextCos = cosStep * cos - sinStep * sin
        sinStep = cosStep * sin + sinStep * cos
        cosStep = nextCos
      }
    }
  }
}

interface FrameStats {
  flatness: number
  maxShare: number
}

function frameStats(
  sound: RenderedSound,
  startSample: number,
  size: number,
  minHz: number,
  maxHz: number,
): FrameStats {
  const samples = sound.channels[0]
  const real = new Float64Array(size)
  const imag = new Float64Array(size)
  for (let i = 0; i < size; i += 1) {
    const index = startSample + i
    const value = index >= 0 && index < samples.length ? samples[index] : 0
    real[i] = value * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)))
  }
  fft(real, imag)

  let powerSum = 0
  let maxPower = 0
  let logSum = 0
  let count = 0
  for (let bin = 1; bin < size / 2; bin += 1) {
    const frequency = (bin * sound.sampleRate) / size
    if (frequency < minHz || frequency > maxHz) continue
    const power = real[bin] * real[bin] + imag[bin] * imag[bin] + 1e-30
    powerSum += power
    if (power > maxPower) maxPower = power
    logSum += Math.log(power)
    count += 1
  }
  return {
    flatness: Math.exp(logSum / count) / (powerSum / count),
    maxShare: maxPower / powerSum,
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function tailEnergyShare(sound: RenderedSound, fromFraction: number): number {
  return windowEnergyShare(sound, fromFraction, 1)
}

function windowEnergyShare(sound: RenderedSound, fromFraction: number, toFraction: number): number {
  const start = Math.floor(sound.channels[0].length * fromFraction)
  const end = Math.floor(sound.channels[0].length * toFraction)
  let total = 0
  let windowed = 0
  for (let i = 0; i < sound.channels[0].length; i += 1) {
    const energy =
      sound.channels[0][i] * sound.channels[0][i] +
      sound.channels[1][i] * sound.channels[1][i]
    total += energy
    if (i >= start && i < end) windowed += energy
  }
  return windowed / total
}

function bandEnergyShare(sound: RenderedSound, minHz: number, maxHz: number): number {
  const size = 2048
  let inBand = 0
  let total = 0
  for (let start = 0; start + size <= sound.channels[0].length; start += size) {
    const real = new Float64Array(size)
    const imag = new Float64Array(size)
    for (let i = 0; i < size; i += 1) {
      real[i] =
        sound.channels[0][start + i] *
        (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)))
    }
    fft(real, imag)
    for (let bin = 1; bin < size / 2; bin += 1) {
      const frequency = (bin * sound.sampleRate) / size
      const power = real[bin] * real[bin] + imag[bin] * imag[bin]
      total += power
      if (frequency >= minHz && frequency <= maxHz) inBand += power
    }
  }
  return inBand / total
}

function framesBetween(
  sound: RenderedSound,
  fromFraction: number,
  toFraction: number,
  minHz = 300,
  maxHz = 8000,
): FrameStats[] {
  const size = 1024
  const start = Math.floor(sound.channels[0].length * fromFraction)
  const end = Math.floor(sound.channels[0].length * toFraction)
  const frames: FrameStats[] = []
  for (let offset = start; offset + size <= end; offset += size / 2) {
    frames.push(frameStats(sound, offset, size, minHz, maxHz))
  }
  return frames
}

/**
 * The strongest FFT bin in a time window. This is a direct way to prove a
 * deliberate pitch gesture (a downward zap or an upward arpeggio) without
 * pinning the exact waveform.
 */
function dominantFrequency(
  sound: RenderedSound,
  fromFraction: number,
  toFraction: number,
  minHz = 80,
  maxHz = 12_000,
): number {
  const size = 4096
  const start = Math.floor(sound.channels[0].length * fromFraction)
  const end = Math.floor(sound.channels[0].length * toFraction)
  const real = new Float64Array(size)
  const imag = new Float64Array(size)
  for (let i = 0; i < size; i += 1) {
    const index = start + i
    const value =
      index < end && index < sound.channels[0].length ? sound.channels[0][index] : 0
    real[i] = value * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)))
  }
  fft(real, imag)

  let bestBin = 1
  let bestPower = 0
  for (let bin = 1; bin < size / 2; bin += 1) {
    const frequency = (bin * sound.sampleRate) / size
    if (frequency < minHz || frequency > maxHz) continue
    const power = real[bin] * real[bin] + imag[bin] * imag[bin]
    if (power > bestPower) {
      bestPower = power
      bestBin = bin
    }
  }
  return (bestBin * sound.sampleRate) / size
}

function checksum(sound: RenderedSound): number {
  let sum = 0
  for (const channel of sound.channels) {
    for (let i = 0; i < channel.length; i += 7) sum += channel[i] * (i + 1)
  }
  return sum
}

describe('retuned preset timbres', () => {
  it('gives Mechanical Click an audible two-stage body without a high ring', () => {
    const preset = getPresetById('mechanical-click')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const late = framesBetween(sound, 0.3, 0.6, 800, 8000)

    // The switch body and housing tail must be audible for longer than the
    // original ~20 ms tick, but the sound must still die before the file ends.
    expect(windowEnergyShare(sound, 0.2, 0.6)).toBeGreaterThan(0.01)
    expect(tailEnergyShare(sound, 0.85)).toBeLessThan(0.03)
    expect(late.length).toBeGreaterThan(2)
    expect(median(late.map((frame) => frame.maxShare))).toBeLessThan(0.4)
    expect(median(late.map((frame) => frame.flatness))).toBeGreaterThan(0.02)

    // The reference click lives in the high-mid range. Keep the preset out of
    // the low 200-500 Hz region that made the earlier version read as a drum.
    expect(bandEnergyShare(sound, 0, 200)).toBeLessThan(0.05)
    expect(bandEnergyShare(sound, 200, 500)).toBeLessThan(0.15)
    expect(bandEnergyShare(sound, 500, 2000)).toBeGreaterThan(0.1)
    expect(bandEnergyShare(sound, 2000, 6000)).toBeGreaterThan(0.4)
  })

  it('gives Card / Plastic Snap a flex-snap-settle gesture instead of a chirp', () => {
    const preset = getPresetById('card-snap')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = framesBetween(sound, 0.05, 0.35)

    // The card must keep moving after the crack, and the flex/snap must remain
    // noise-led rather than turning back into a pitched sweep.
    expect(windowEnergyShare(sound, 0.2, 0.8)).toBeGreaterThan(0.01)
    expect(tailEnergyShare(sound, 0.85)).toBeLessThan(0.03)
    expect(early.length).toBeGreaterThan(1)
    expect(median(early.map((frame) => frame.flatness))).toBeGreaterThan(0.05)
  })

  it('gives Stone / Concrete a noise-led gritty tail instead of a pitched ring', () => {
    const preset = getPresetById('concrete-step')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const late = framesBetween(sound, 0.4, 0.9)

    expect(late.length).toBeGreaterThan(2)
    expect(median(late.map((frame) => frame.maxShare))).toBeLessThan(0.25)
    expect(median(late.map((frame) => frame.flatness))).toBeGreaterThan(0.05)
  })

  it('makes Flesh Squish a wet midrange rather than a low drone', () => {
    const preset = getPresetById('flesh-squish')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)

    expect(bandEnergyShare(sound, 500, 2000)).toBeGreaterThan(0.5)
    expect(bandEnergyShare(sound, 0, 200)).toBeLessThan(0.2)
  })
})

describe('magic timbres', () => {
  it('arcs Arcane Zap downward and dies quickly', () => {
    const preset = getPresetById('arcane-zap')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = dominantFrequency(sound, 0.01, 0.18)
    const late = dominantFrequency(sound, 0.45, 0.8)

    expect(early).toBeGreaterThan(late * 1.5)
    expect(bandEnergyShare(sound, 2000, 9000)).toBeGreaterThan(0.3)
    expect(tailEnergyShare(sound, 0.85)).toBeLessThan(0.02)
  })

  it('makes Magic Shimmer a rising, glassy cloud', () => {
    const preset = getPresetById('magic-shimmer')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = dominantFrequency(sound, 0.02, 0.25)
    const late = dominantFrequency(sound, 0.5, 0.9)

    expect(late).toBeGreaterThan(early * 1.5)
    expect(bandEnergyShare(sound, 2000, 9000)).toBeGreaterThan(0.5)
    expect(tailEnergyShare(sound, 0.85)).toBeGreaterThan(0.01)
  })

  it('makes Power-Up climb from the root to the octave', () => {
    const preset = getPresetById('power-up')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = dominantFrequency(sound, 0.01, 0.14)
    const late = dominantFrequency(sound, 0.58, 0.92)

    expect(early).toBeGreaterThan(350)
    expect(early).toBeLessThan(550)
    expect(late).toBeGreaterThan(early * 1.5)
    expect(windowEnergyShare(sound, 0.55, 1)).toBeGreaterThan(0.05)
  })

  it('makes Spell Whoosh a noise-led upward sweep with no ring', () => {
    const preset = getPresetById('spell-whoosh')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = dominantFrequency(sound, 0.05, 0.25)
    const late = dominantFrequency(sound, 0.55, 0.9)
    const frames = framesBetween(sound, 0.2, 0.8, 300, 8000)

    expect(late).toBeGreaterThan(early * 1.4)
    expect(median(frames.map((frame) => frame.flatness))).toBeGreaterThan(0.05)
    expect(bandEnergyShare(sound, 2000, 9000)).toBeGreaterThan(0.15)
    expect(tailEnergyShare(sound, 0.9)).toBeLessThan(0.02)
  })
})

describe('movement timbres', () => {
  it('makes Jump rise and clear out quickly', () => {
    const preset = getPresetById('jump-takeoff')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = dominantFrequency(sound, 0.02, 0.18)
    const late = dominantFrequency(sound, 0.55, 0.95)

    expect(late).toBeGreaterThan(early * 1.5)
    expect(bandEnergyShare(sound, 200, 9000)).toBeGreaterThan(0.6)
    expect(bandEnergyShare(sound, 6000, 12_000)).toBeLessThan(0.05)
    expect(tailEnergyShare(sound, 0.85)).toBeLessThan(0.02)
  })

  it('makes Landing low and heavy without a long ring', () => {
    const preset = getPresetById('heavy-landing')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = dominantFrequency(sound, 0.01, 0.2)

    expect(early).toBeLessThan(300)
    expect(bandEnergyShare(sound, 0, 200)).toBeGreaterThan(0.15)
    expect(tailEnergyShare(sound, 0.75)).toBeLessThan(0.1)
  })

  it('makes Hit a short, dry body impact', () => {
    const preset = getPresetById('hit-impact')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)

    expect(windowEnergyShare(sound, 0, 0.5)).toBeGreaterThan(0.8)
    expect(tailEnergyShare(sound, 0.7)).toBeLessThan(0.05)
  })
})

describe('tuned preset robustness', () => {
  it('renders the tuned presets cleanly across many seeds', () => {
    for (const id of TUNED_PRESET_IDS) {
      const preset = getPresetById(id)
      for (let seed = 0; seed < 8; seed += 1) {
        const sound = synthesize(preset.model, preset.defaults, seed * 7919 + 1)
        expect(sound.channels[0]).toHaveLength(
          Math.round((preset.defaults.durationMs / 1000) * sound.sampleRate),
        )
        expect(peakOf(sound.channels)).toBeLessThanOrEqual(0.880001)
        expect(peakOf(sound.channels)).toBeGreaterThan(0.7)
        expect(rmsOf(sound.channels)).toBeGreaterThan(0.00001)
        expect(Math.abs(sound.channels[0][sound.channels[0].length - 1])).toBeLessThan(0.02)
        expect(Math.abs(sound.channels[1][sound.channels[1].length - 1])).toBeLessThan(0.02)
      }
    }
  })

  it('keeps the click and snap gestures audible past their initial tick across seeds', () => {
    for (let seed = 0; seed < 8; seed += 1) {
      const mechanicalPreset = getPresetById('mechanical-click')
      const mechanical = synthesize(mechanicalPreset.model, mechanicalPreset.defaults, seed * 7919 + 1)
      expect(windowEnergyShare(mechanical, 0.2, 0.6)).toBeGreaterThan(0.005)

      const cardPreset = getPresetById('card-snap')
      const card = synthesize(cardPreset.model, cardPreset.defaults, seed * 7919 + 1)
      expect(windowEnergyShare(card, 0.2, 0.8)).toBeGreaterThan(0.005)
    }
  })

  it('keeps every control live on the tuned presets', () => {
    const controls: readonly [keyof SynthParams, number, number][] = [
      ['pitchHz', 40, 6000],
      ['punch', 0, 100],
      ['resonance', 0.5, 24],
      ['grit', 0, 100],
      ['decay', 0, 100],
    ]

    for (const id of TUNED_PRESET_IDS) {
      const preset = getPresetById(id)
      for (const [key, low, high] of controls) {
        const lowSound = synthesize(preset.model, { ...preset.defaults, [key]: low }, 99)
        const highSound = synthesize(preset.model, { ...preset.defaults, [key]: high }, 99)
        expect(Math.abs(checksum(lowSound) - checksum(highSound))).toBeGreaterThan(1e-4)
      }

      const shortSound = synthesize(preset.model, { ...preset.defaults, durationMs: 80 }, 99)
      const longSound = synthesize(preset.model, { ...preset.defaults, durationMs: 800 }, 99)
      expect(shortSound.channels[0]).toHaveLength(3_528)
      expect(longSound.channels[0]).toHaveLength(35_280)
    }
  })
})
