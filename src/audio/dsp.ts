import type { Rng } from './random'
import { createRng } from './random'
import { clamp } from './params'

/**
 * Low-level procedural DSP primitives shared by all eleven material models.
 * Everything here is sample-accurate and independent of Web Audio so a take can
 * be rendered identically for audition and export.
 */

export interface AudioBus {
  left: Float32Array
  right: Float32Array
  sampleRate: number
  durationSec: number
}

export type BiquadMode = 'lowpass' | 'highpass' | 'bandpass'

export interface ToneOptions {
  startSec: number
  durationSec: number
  freqHz: number
  endFreqHz?: number
  gain?: number
  attackSec?: number
  /** 0 = linear tail, 1 = steep exponential tail. */
  decay?: number
  pan?: number
  phase?: number
  fmHz?: number
  fmDepthHz?: number
  fmDecaySec?: number
}

export interface NoiseOptions {
  startSec: number
  durationSec: number
  cutoffHz: number
  /**
   * Optional end of a log-frequency cutoff sweep. When supplied with a
   * different value, the filter glides from `cutoffHz` to this frequency over
   * the event. Moving resonances are what turn a static hiss into a wet squelch
   * or a sliding scuff.
   */
  endCutoffHz?: number
  filter?: BiquadMode
  q?: number
  /** Optional end of a linear Q sweep. Omit to hold Q constant. */
  endQ?: number
  gain?: number
  attackSec?: number
  decay?: number
  pan?: number
  seed: number
  pink?: boolean
}

export function createBus(length: number, sampleRate: number): AudioBus {
  return {
    left: new Float32Array(length),
    right: new Float32Array(length),
    sampleRate,
    durationSec: length / sampleRate,
  }
}

/** Equal-power pan gains. Centre keeps a natural -3 dB per channel. */
export function panGains(pan: number): readonly [number, number] {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

/** Mulberry32-backed white noise with a stable seed. */
export function makeWhiteNoise(seed: number): Rng {
  const rng = createRng(seed)
  return () => rng() * 2 - 1
}

/**
 * Paul Kellet's economical pink-noise filter. The returned signal is roughly
 * normalized to the same peak region as the white source.
 */
export function makePinkNoise(seed: number): Rng {
  const rng = createRng(seed)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  return () => {
    const white = rng() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
    b6 = white * 0.115926
    return pink * 0.11
  }
}

/**
 * A tiny RBJ-cookbook biquad. Filters are stateful per layer so consecutive
 * grains never share filter memory and cannot create sticky DC or runaway
 * resonance.
 */
export class Biquad {
  private b0 = 1
  private b1 = 0
  private b2 = 0
  private a1 = 0
  private a2 = 0
  private z1 = 0
  private z2 = 0

  constructor(mode: BiquadMode, frequency: number, q: number, sampleRate: number) {
    this.setParams(mode, frequency, q, sampleRate)
  }

  /**
   * Recompute the coefficients without clearing the delay line. Keeping the
   * filter state is what lets a swept noise event glide instead of clicking on
   * every coefficient update.
   */
  setParams(mode: BiquadMode, frequency: number, q: number, sampleRate: number): void {
    const nyquist = sampleRate * 0.5
    const freq = clamp(Number.isFinite(frequency) ? frequency : 1000, 10, nyquist * 0.92)
    const quality = clamp(Number.isFinite(q) ? q : 1, 0.08, 40)
    const omega = (2 * Math.PI * freq) / sampleRate
    const sin = Math.sin(omega)
    const cos = Math.cos(omega)
    const alpha = sin / (2 * quality)

    let b0 = 0
    let b1 = 0
    let b2 = 0
    let a0 = 1
    let a1 = 0
    let a2 = 0

    if (mode === 'lowpass') {
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = (1 - cos) / 2
      a0 = 1 + alpha
      a1 = -2 * cos
      a2 = 1 - alpha
    } else if (mode === 'highpass') {
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = (1 + cos) / 2
      a0 = 1 + alpha
      a1 = -2 * cos
      a2 = 1 - alpha
    } else {
      // Constant 0 dB peak band-pass response.
      b0 = alpha
      b1 = 0
      b2 = -alpha
      a0 = 1 + alpha
      a1 = -2 * cos
      a2 = 1 - alpha
    }

    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = a1 / a0
    this.a2 = a2 / a0
  }

  process(input: number): number {
    const output = this.b0 * input + this.z1
    this.z1 = this.b1 * input - this.a1 * output + this.z2
    this.z2 = this.b2 * input - this.a2 * output
    if (!Number.isFinite(output)) {
      this.z1 = 0
      this.z2 = 0
      return 0
    }
    return output
  }
}

/**
 * A shape that moves continuously from a straight linear fade to a steep
 * exponential fade. Both endpoints reach exactly zero at progress 1 so model
 * tails never leave a digital click at the buffer boundary.
 */
export function decayShape(progress: number, curve: number): number {
  const p = clamp(progress, 0, 1)
  const amount = clamp(curve, 0, 1)
  const k = 0.8 + Math.pow(amount, 1.35) * 12
  const exponential = (Math.exp(-k * p) - Math.exp(-k)) / (1 - Math.exp(-k))
  return (1 - amount) * (1 - p) + amount * exponential
}

export function attackSecondsFromPunch(punch0to100: number, softest = 0.012, hardest = 0.00035): number {
  const p = clamp(punch0to100, 0, 100) / 100
  return softest * Math.pow(hardest / softest, p)
}

/**
 * Envelope for one scheduled event. `progress` is relative to that event's
 * intended duration, not the full sound.
 */
export function eventEnvelope(progress: number, attackFraction: number, decayCurve: number): number {
  if (progress <= 0 || progress >= 1) return 0
  const attack = clamp(attackFraction, 0.00005, 0.8)
  const attackGain = progress < attack ? progress / attack : 1
  const tailProgress = progress < attack ? 0 : (progress - attack) / (1 - attack)
  return attackGain * decayShape(tailProgress, decayCurve)
}

/** Add a phase-continuous sine layer with optional glide and FM wobble. */
export function addSine(bus: AudioBus, options: ToneOptions): void {
  const { left, right, sampleRate, durationSec } = bus
  const startSample = Math.max(0, Math.round(options.startSec * sampleRate))
  if (startSample >= left.length) return
  const requestedSamples = Math.max(1, Math.round(options.durationSec * sampleRate))
  const samples = Math.min(requestedSamples, left.length - startSample)
  if (samples <= 0) return
  const safeDuration = Math.max(1 / sampleRate, Math.min(options.durationSec, durationSec))

  const startFreq = clamp(Number.isFinite(options.freqHz) ? options.freqHz : 220, 10, sampleRate * 0.45)
  const endFreq = clamp(
    Number.isFinite(options.endFreqHz ?? NaN) ? (options.endFreqHz as number) : startFreq,
    10,
    sampleRate * 0.45,
  )
  const gain = Number.isFinite(options.gain ?? 1) ? (options.gain ?? 1) : 1
  const attackFraction = Math.max(1 / samples, (options.attackSec ?? 0.001) / safeDuration)
  const decayCurve = clamp(options.decay ?? 0.45, 0, 1)
  const [leftPan, rightPan] = panGains(options.pan ?? 0)
  const fmHz = Math.max(0, options.fmHz ?? 0)
  const fmDepth = Math.max(0, options.fmDepthHz ?? 0)
  const fmDecay = Math.max(0.0005, options.fmDecaySec ?? 0.05)

  let phase = (options.phase ?? 0) * Math.PI * 2
  let modPhase = 0
  const freqRatio = endFreq / startFreq

  for (let n = 0; n < samples; n += 1) {
    const progress = n / requestedSamples
    const localT = n / sampleRate
    const envelope = eventEnvelope(progress, attackFraction, decayCurve)
    const glidedFreq = startFreq * Math.pow(freqRatio, progress)
    const wobble =
      fmDepth > 0
        ? Math.sin(modPhase) * fmDepth * Math.exp(-localT / fmDecay)
        : 0
    const instantaneousFreq = clamp(glidedFreq + wobble, 5, sampleRate * 0.47)
    phase += (Math.PI * 2 * instantaneousFreq) / sampleRate
    modPhase += (Math.PI * 2 * fmHz) / sampleRate
    const sample = Math.sin(phase) * envelope * gain
    left[startSample + n] += sample * leftPan
    right[startSample + n] += sample * rightPan
  }
}

/**
 * Add one seeded, filtered noise layer. This is the workhorse for clicks,
 * grains, cloth beds and stone debris.
 */
export function addNoise(bus: AudioBus, options: NoiseOptions): void {
  const { left, right, sampleRate } = bus
  const startSample = Math.max(0, Math.round(options.startSec * sampleRate))
  if (startSample >= left.length) return
  const requestedSamples = Math.max(1, Math.round(options.durationSec * sampleRate))
  const samples = Math.min(requestedSamples, left.length - startSample)
  if (samples <= 0) return
  const safeDuration = Math.max(1 / sampleRate, options.durationSec)
  const attackFraction = Math.max(1 / samples, (options.attackSec ?? 0.0005) / safeDuration)
  const decayCurve = clamp(options.decay ?? 0.65, 0, 1)
  const [leftPan, rightPan] = panGains(options.pan ?? 0)
  const mode = options.filter ?? 'bandpass'
  const requestedCutoff = Number.isFinite(options.cutoffHz) ? options.cutoffHz : 1000
  const startCutoff = clamp(requestedCutoff, 10, sampleRate * 0.46)
  const requestedQ = options.q ?? 1
  const startQ = clamp(Number.isFinite(requestedQ) ? requestedQ : 1, 0.08, 40)
  const requestedEndCutoff = options.endCutoffHz
  const endCutoff = clamp(
    requestedEndCutoff !== undefined && Number.isFinite(requestedEndCutoff)
      ? requestedEndCutoff
      : startCutoff,
    10,
    sampleRate * 0.46,
  )
  const requestedEndQ = options.endQ
  const endQ = clamp(
    requestedEndQ !== undefined && Number.isFinite(requestedEndQ) ? requestedEndQ : startQ,
    0.08,
    40,
  )
  const swept = endCutoff !== startCutoff || endQ !== startQ
  const filter = new Biquad(mode, startCutoff, startQ, sampleRate)
  const noise = options.pink
    ? makePinkNoise(options.seed)
    : makeWhiteNoise(options.seed)
  const gain = Number.isFinite(options.gain ?? 1) ? (options.gain ?? 1) : 1

  for (let n = 0; n < samples; n += 1) {
    // Coefficient updates every 32 samples (~0.7 ms) are smooth under noise and
    // cheap enough to keep the renderer synchronous.
    if (swept && n > 0 && n % 32 === 0) {
      const sweepProgress = n / requestedSamples
      filter.setParams(
        mode,
        startCutoff * Math.pow(endCutoff / startCutoff, sweepProgress),
        startQ * Math.pow(endQ / startQ, sweepProgress),
        sampleRate,
      )
    }
    const progress = n / requestedSamples
    const envelope = eventEnvelope(progress, attackFraction, decayCurve)
    const raw = filter.process(noise())
    const sample = raw * envelope * gain
    left[startSample + n] += sample * leftPan
    right[startSample + n] += sample * rightPan
  }
}

/**
 * Apply a one-pole DC blocker, a click-safe final fade and peak normalization.
 * Returns the final peak (approximately the target unless the buffer was silent).
 */
export function finalizeBus(bus: AudioBus, targetPeak = 0.88): number {
  const { left, right, sampleRate } = bus
  const dcPole = Math.exp((-2 * Math.PI * 20) / sampleRate)
  const fadeSamples = Math.min(left.length, Math.round(sampleRate * 0.0015))

  let leftPrevIn = 0
  let rightPrevIn = 0
  let leftPrevOut = 0
  let rightPrevOut = 0
  let peak = 0

  for (let i = 0; i < left.length; i += 1) {
    const leftIn = Number.isFinite(left[i]) ? left[i] : 0
    const rightIn = Number.isFinite(right[i]) ? right[i] : 0
    let l = leftIn - leftPrevIn + dcPole * leftPrevOut
    let r = rightIn - rightPrevIn + dcPole * rightPrevOut
    leftPrevIn = leftIn
    rightPrevIn = rightIn
    leftPrevOut = l
    rightPrevOut = r

    if (i >= left.length - fadeSamples) {
      const fade = (left.length - i) / fadeSamples
      l *= fade
      r *= fade
    }

    left[i] = l
    right[i] = r
    const abs = Math.max(Math.abs(l), Math.abs(r))
    if (abs > peak) peak = abs
  }

  if (peak < 1e-8) {
    left.fill(0)
    right.fill(0)
    return 0
  }

  const gain = targetPeak / peak
  for (let i = 0; i < left.length; i += 1) {
    left[i] = clamp(left[i] * gain, -1, 1)
    right[i] = clamp(right[i] * gain, -1, 1)
  }
  return targetPeak
}
