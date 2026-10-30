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
  const cut = Math.floor(sound.channels[0].length * fromFraction)
  let total = 0
  let tail = 0
  for (let i = 0; i < sound.channels[0].length; i += 1) {
    const energy =
      sound.channels[0][i] * sound.channels[0][i] +
      sound.channels[1][i] * sound.channels[1][i]
    total += energy
    if (i >= cut) tail += energy
  }
  return tail / total
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

function checksum(sound: RenderedSound): number {
  let sum = 0
  for (const channel of sound.channels) {
    for (let i = 0; i < channel.length; i += 7) sum += channel[i] * (i + 1)
  }
  return sum
}

describe('retuned preset timbres', () => {
  it('keeps Mechanical Click transient-led instead of ringing through the tail', () => {
    const preset = getPresetById('mechanical-click')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)

    expect(tailEnergyShare(sound, 0.35)).toBeLessThan(0.02)
  })

  it('keeps Card / Plastic Snap noise-led instead of gliding like a laser', () => {
    const preset = getPresetById('card-snap')
    const sound = synthesize(preset.model, preset.defaults, 0xc0ffee)
    const early = framesBetween(sound, 0.05, 0.35)

    expect(early.length).toBeGreaterThan(0)
    expect(median(early.map((frame) => frame.flatness))).toBeGreaterThan(0.05)
    expect(tailEnergyShare(sound, 0.4)).toBeLessThan(0.03)
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

describe('retuned preset robustness', () => {
  it('renders the four refined presets cleanly across many seeds', () => {
    for (const id of REFINED_PRESET_IDS) {
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

  it('keeps every control live on the four refined presets', () => {
    const controls: readonly [keyof SynthParams, number, number][] = [
      ['pitchHz', 40, 6000],
      ['punch', 0, 100],
      ['resonance', 0.5, 24],
      ['grit', 0, 100],
      ['decay', 0, 100],
    ]

    for (const id of REFINED_PRESET_IDS) {
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
