import type { ModelId, RenderedSound, SynthParams } from './types'
import { SAMPLE_RATE } from './types'
import { clamp, sanitizeParams } from './params'
import {
  addNoise,
  addSine,
  attackSecondsFromPunch,
  Biquad,
  createBus,
  decayShape,
  finalizeBus,
  makePinkNoise,
  panGains,
} from './dsp'
import { createRng, deriveSeed, hashSeed, randomBetween, randomInt } from './random'

/**
 * Procedural material models.
 *
 * Each model writes into a stereo float bus using seeded primitives from dsp.ts.
 * No sample files are read and no browser audio APIs are required to render, so
 * the exact same function powers the live audition and every exported WAV.
 */

interface ModelContext {
  model: ModelId
  bus: ReturnType<typeof createBus>
  params: SynthParams
  seed: number
  durationSec: number
  rng: () => number
  nextSeed: () => number
  attack: number
  punch: number
  grit: number
  decayCurve: number
  q: number
  pitch: number
}

function fitDuration(startSec: number, desiredSec: number, totalSec: number): number {
  return Math.max(0.0005, Math.min(desiredSec, totalSec - startSec))
}

function makeContext(model: ModelId, params: SynthParams, seed: number, length: number): ModelContext {
  const bus = createBus(length, SAMPLE_RATE)
  const rng = createRng(hashSeed(seed, model, params.durationMs, params.pitchHz))
  let eventIndex = 0
  return {
    model,
    bus,
    params,
    seed,
    durationSec: bus.durationSec,
    rng,
    nextSeed: () => deriveSeed(seed, model, eventIndex++),
    attack: attackSecondsFromPunch(params.punch),
    punch: clamp(params.punch / 100, 0, 1),
    grit: clamp(params.grit / 100, 0, 1),
    decayCurve: clamp(params.decay / 100, 0, 1),
    q: clamp(params.resonance, 0.5, 24),
    pitch: clamp(params.pitchHz, 40, 6000),
  }
}

function mechanicalClick(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const transientDur = clamp(0.0012 + (1 - punch) * 0.0012, 0.0006, 0.0024)

  // Hard switch contact: a tiny bright noise tick and a sub-2 ms click.
  addNoise(bus, {
    startSec: 0,
    durationSec: transientDur,
    cutoffHz: clamp(pitch * 1.3, 800, 10_000),
    filter: 'highpass',
    q: 0.7,
    gain: 0.9 + punch * 0.5,
    attackSec: 0.00008,
    decay: 0.96,
    pan: randomBetween(ctx.rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.0032, dur),
    freqHz: pitch * 1.15,
    endFreqHz: pitch * 0.8,
    gain: 0.34 + punch * 0.3,
    attackSec: 0.00012,
    decay: 0.74,
    phase: ctx.rng(),
  })

  // Switch-housing resonance. The Q control directly changes how much the
  // casing rings after the contact.
  addSine(bus, {
    startSec: 0.0003,
    durationSec: Math.max(0.002, dur * 0.94),
    freqHz: pitch,
    endFreqHz: pitch * 0.994,
    gain: 0.36,
    attackSec: Math.max(0.0003, attack * 0.7),
    decay: 0.25 + decayCurve * 0.6,
    phase: 0.08,
  })
  addNoise(bus, {
    startSec: 0.00035,
    durationSec: Math.max(0.002, dur * 0.7),
    cutoffHz: clamp(pitch * 1.02, 100, 10_000),
    filter: 'bandpass',
    q: clamp(q * 1.2, 0.7, 30),
    gain: 0.25 + grit * 0.6,
    attackSec: 0.00035,
    decay: 0.35 + decayCurve * 0.5,
    pan: -0.04,
    seed: ctx.nextSeed(),
  })

  // A second, quieter housing mode keeps the click from feeling synthetic.
  addSine(bus, {
    startSec: 0.0008,
    durationSec: Math.max(0.001, dur * 0.42),
    freqHz: pitch * 1.61,
    gain: 0.15 + grit * 0.13,
    attackSec: 0.0004,
    decay: 0.7,
    phase: 0.55,
  })

  if (grit > 0.35 && dur > 0.01) {
    addNoise(bus, {
      startSec: Math.min(0.0042, dur * 0.18),
      durationSec: fitDuration(0.0042, 0.008, dur),
      cutoffHz: randomBetween(ctx.rng, 1800, 6200),
      filter: 'bandpass',
      q: randomBetween(ctx.rng, 4, 12),
      gain: grit * 0.22,
      attackSec: 0.0002,
      decay: 0.8,
      pan: randomBetween(ctx.rng, -0.35, 0.35),
      seed: ctx.nextSeed(),
    })
  }
}

function cardSnap(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const chirpDuration = clamp(dur * 0.42, 0.005, Math.max(0.005, dur * 0.75))
  const snapDuration = clamp(dur * 0.23, 0.002, 0.035)

  // The plastic body starts stretched and snaps down in pitch.
  addSine(bus, {
    startSec: 0,
    durationSec: chirpDuration,
    freqHz: pitch * 2.15,
    endFreqHz: pitch * 0.56,
    gain: 0.55 + punch * 0.25,
    attackSec: attack * 0.6,
    decay: 0.2 + decayCurve * 0.55,
    phase: 0.17,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: snapDuration,
    cutoffHz: clamp(pitch * 0.78, 180, 11_000),
    filter: 'highpass',
    q: 0.75,
    gain: 0.9 + punch * 0.65,
    attackSec: 0.00009,
    decay: 0.92,
    pan: randomBetween(ctx.rng, -0.12, 0.12),
    seed: ctx.nextSeed(),
  })

  // Filtered cavity adds a hollow flex under the snap.
  addNoise(bus, {
    startSec: 0.0007,
    durationSec: Math.max(0.004, dur * 0.6),
    cutoffHz: clamp(pitch, 120, 10_000),
    filter: 'bandpass',
    q: clamp(q * 1.1, 0.6, 20),
    gain: 0.18 + grit * 0.34,
    attackSec: 0.0006,
    decay: 0.3 + decayCurve * 0.5,
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: 0.001,
    durationSec: Math.max(0.003, dur * 0.35),
    freqHz: pitch * 0.7,
    endFreqHz: pitch * 0.62,
    gain: 0.14,
    attackSec: 0.0005,
    decay: 0.55,
    pan: 0.08,
    phase: 0.61,
  })

  if (dur > 0.06) {
    const lateStart = dur * randomBetween(ctx.rng, 0.18, 0.34)
    addNoise(bus, {
      startSec: lateStart,
      durationSec: fitDuration(lateStart, randomBetween(ctx.rng, 0.004, 0.014), dur),
      cutoffHz: randomBetween(ctx.rng, 2800, 8000),
      filter: 'highpass',
      q: 0.9,
      gain: grit * 0.12,
      attackSec: 0.0002,
      decay: 0.9,
      pan: randomBetween(ctx.rng, -0.3, 0.3),
      seed: ctx.nextSeed(),
    })
  }
}

function woodButton(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const ringDuration = Math.max(0.008, dur * (0.7 + qNorm * 0.26))
  const baseDecay = 0.26 + decayCurve * 0.58

  // Fundamental wooden ping plus two inharmonic modes. The high modes are what
  // make the same pitch read as timber rather than a sine beep.
  addSine(bus, {
    startSec: 0,
    durationSec: ringDuration,
    freqHz: pitch,
    endFreqHz: pitch * 0.985,
    gain: 0.88,
    attackSec: Math.max(0.00045, attack * 1.1),
    decay: baseDecay,
    phase: 0.13,
  })
  addSine(bus, {
    startSec: 0.0005,
    durationSec: Math.max(0.005, ringDuration * 0.55),
    freqHz: pitch * 2.76,
    gain: 0.3 + qNorm * 0.22,
    attackSec: 0.0007,
    decay: clamp(baseDecay + 0.12, 0, 1),
    phase: 0.42,
    pan: 0.05,
  })
  addSine(bus, {
    startSec: 0.001,
    durationSec: Math.max(0.003, ringDuration * 0.26),
    freqHz: pitch * 5.18,
    gain: 0.1 + qNorm * 0.14,
    attackSec: 0.0005,
    decay: clamp(baseDecay + 0.24, 0, 1),
    phase: 0.81,
    pan: -0.08,
  })

  // Click of the cap meeting the timber.
  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.0035 + punch * 0.002, 0.002, 0.007),
    cutoffHz: clamp(pitch * 8 + 450, 900, 9000),
    filter: 'bandpass',
    q: 1.1,
    gain: 0.32 + punch * 0.36,
    attackSec: 0.00015,
    decay: 0.88,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.001,
    durationSec: Math.max(0.008, Math.min(0.075, dur * 0.45)),
    cutoffHz: clamp(pitch * 3.1, 160, 5000),
    filter: 'lowpass',
    q: 0.7 + clamp(q * 0.08, 0, 1.2),
    gain: 0.09 + grit * 0.16,
    attackSec: 0.0007,
    decay: 0.58,
    seed: ctx.nextSeed(),
  })
}

function gravelCrunch(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, q } = ctx
  const grainCount = Math.min(dur < 0.05 ? 5 : 24, Math.max(3, Math.round(8 + grit * 13 + ctx.rng() * 4)))
  const spread = dur * 0.84
  const times = [0]
  for (let i = 1; i < grainCount; i += 1) {
    times.push(spread * Math.pow(ctx.rng(), 1.35) + ctx.rng() * 0.003)
  }
  times.sort((a, b) => a - b)

  // Heel/ball-of-foot contact under the grain cloud.
  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.006 + punch * 0.014, 0.004, 0.022),
    cutoffHz: clamp(pitch * 0.55, 180, 8000),
    filter: 'highpass',
    q: 0.7,
    gain: 0.65 + punch * 0.5,
    attackSec: 0.00025,
    decay: 0.95,
    pan: -0.04,
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.085, dur),
    freqHz: clamp(pitch * 0.16, 40, 220),
    endFreqHz: clamp(pitch * 0.1, 35, 180),
    gain: 0.16 + punch * 0.24,
    attackSec: 0.0006,
    decay: 0.7,
    phase: 0.21,
  })

  for (let i = 0; i < times.length; i += 1) {
    const start = Math.min(times[i], dur - 0.0008)
    if (start < 0) continue
    const early = 1 - i / Math.max(1, times.length)
    const duration = fitDuration(
      start,
      randomBetween(ctx.rng, 0.0018, 0.009 + grit * 0.008) * (0.75 + early * 0.6),
      dur,
    )
    const grainPitch = pitch * randomBetween(ctx.rng, 0.46, 1.85)
    const amplitude = (0.35 + ctx.rng() * 0.65) * (0.7 + early * 0.55) * (i === 0 ? 1.3 : 1)
    addNoise(bus, {
      startSec: start,
      durationSec: duration,
      cutoffHz: clamp(grainPitch, 70, 10_000),
      filter: ctx.rng() > 0.16 ? 'bandpass' : 'lowpass',
      q: clamp(q * randomBetween(ctx.rng, 0.6, 1.9) + 0.4, 0.6, 26),
      gain: amplitude * (0.5 + grit * 0.55),
      attackSec: randomBetween(ctx.rng, 0.00012, 0.00065),
      decay: randomBetween(ctx.rng, 0.45, 0.95),
      pan: randomBetween(ctx.rng, -0.55, 0.55),
      seed: ctx.nextSeed(),
    })
  }

  // Tiny chips skipping across the surface after the main crush.
  const skips = randomInt(ctx.rng, 1, 4)
  for (let i = 0; i < skips; i += 1) {
    const start = dur * randomBetween(ctx.rng, 0.22, 0.92)
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(ctx.rng, 0.001, 0.005), dur),
      cutoffHz: clamp(pitch * randomBetween(ctx.rng, 1.8, 4.5), 300, 12_000),
      filter: 'bandpass',
      q: randomBetween(ctx.rng, 2, 10),
      gain: 0.06 + grit * 0.09,
      attackSec: 0.00012,
      decay: 0.9,
      pan: randomBetween(ctx.rng, -0.7, 0.7),
      seed: ctx.nextSeed(),
    })
  }
}

function woodThud(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const bodyDur = Math.max(0.02, dur * 0.93)
  const lowStart = Math.min(260, Math.max(45, pitch * 1.8))

  // Low body with a downward pitch bend and a short FM shudder.
  addSine(bus, {
    startSec: 0,
    durationSec: bodyDur,
    freqHz: clamp(pitch * 1.8, 55, 340),
    endFreqHz: clamp(pitch * 0.72, 35, 250),
    gain: 0.82,
    attackSec: Math.max(0.0008, attack * 1.5),
    decay: 0.25 + decayCurve * 0.62,
    phase: 0.13,
    fmHz: randomBetween(ctx.rng, 26, 52),
    fmDepthHz: clamp(pitch * 0.28, 8, 80),
    fmDecaySec: randomBetween(ctx.rng, 0.035, 0.075),
  })
  addSine(bus, {
    startSec: 0.003,
    durationSec: Math.max(0.01, bodyDur * 0.7),
    freqHz: clamp(pitch * 0.52, 28, 160),
    gain: 0.24,
    attackSec: 0.0015,
    decay: 0.5,
    phase: 0.58,
  })

  // A short mid knock gives the low thud enough presence to survive phone and
  // laptop speakers while the sub layer carries the weight.
  addSine(bus, {
    startSec: 0.0004,
    durationSec: Math.max(0.012, Math.min(0.18, bodyDur * 0.42)),
    freqHz: clamp(pitch * 4.2, 180, 2200),
    endFreqHz: clamp(pitch * 3.8, 160, 2000),
    gain: 0.16 + punch * 0.08,
    attackSec: 0.0006,
    decay: 0.62,
    pan: 0.03,
    phase: 0.36,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.02 + punch * 0.018, 0.012, 0.048),
    cutoffHz: clamp(lowStart * 4.2, 250, 4500),
    filter: 'lowpass',
    q: clamp(0.7 + q * 0.12, 0.7, 2.6),
    gain: 0.36 + punch * 0.35,
    attackSec: 0.0002,
    decay: 0.9,
    pan: -0.05,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.001,
    durationSec: Math.max(0.01, bodyDur * 0.55),
    cutoffHz: clamp(lowStart * 1.6, 120, 2200),
    filter: 'bandpass',
    q: clamp(q * 0.9, 0.5, 14),
    gain: 0.14 + grit * 0.24,
    attackSec: 0.0007,
    decay: 0.62,
    seed: ctx.nextSeed(),
  })

  if (grit > 0.08 && dur > 0.08) {
    // A dry, narrow creak made of a few very short high-Q noise slivers.
    const creakCount = randomInt(ctx.rng, 3, 6)
    for (let i = 0; i < creakCount; i += 1) {
      const start = dur * randomBetween(ctx.rng, 0.27, 0.79)
      addNoise(bus, {
        startSec: start,
        durationSec: fitDuration(start, randomBetween(ctx.rng, 0.015, 0.05), dur),
        cutoffHz: clamp(pitch * randomBetween(ctx.rng, 5.5, 9.5), 500, 5000),
        filter: 'bandpass',
        q: clamp(q * 2.3 + ctx.rng() * 5, 2, 26),
        gain: (0.018 + grit * 0.045) * (1 - i / (creakCount + 2)),
        attackSec: 0.004,
        decay: 0.42,
        pan: randomBetween(ctx.rng, -0.45, 0.45),
        seed: ctx.nextSeed(),
      })
    }
  }
}

function stone(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)

  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.003 + punch * 0.008, 0.002, 0.014),
    cutoffHz: clamp(pitch * 0.74, 220, 12_000),
    filter: 'highpass',
    q: 0.85,
    gain: 0.95 + punch * 0.55,
    attackSec: 0.00006,
    decay: 0.97,
    pan: randomBetween(ctx.rng, -0.05, 0.05),
    seed: ctx.nextSeed(),
  })

  // Bright concrete modes plus a quieter, delayed copy creates a very short
  // room-ish smear without needing a convolution sample.
  const ratios = [1, 1.62, 2.31, 3.17, 4.42]
  const gains = [0.52, 0.34, 0.23, 0.15, 0.08]
  const ringDuration = Math.min(dur * 0.92, 0.65)
  for (let i = 0; i < ratios.length; i += 1) {
    const partialPitch = clamp(pitch * ratios[i] * randomBetween(ctx.rng, 0.997, 1.003), 30, 15_000)
    const partialGain = gains[i] * (0.65 + qNorm * 0.35)
    addSine(bus, {
      startSec: 0.0003,
      durationSec: Math.max(0.004, ringDuration * (1 - i * 0.13)),
      freqHz: partialPitch,
      endFreqHz: partialPitch * 0.998,
      gain: partialGain,
      attackSec: Math.max(0.0003, attack * 0.8),
      decay: clamp(0.22 + decayCurve * 0.55, 0, 1),
      phase: ctx.rng(),
      pan: randomBetween(ctx.rng, -0.22, 0.22),
    })
  }
  for (let echo = 0; echo < 2; echo += 1) {
    const echoStart = 0.009 + echo * 0.018
    if (echoStart >= dur) continue
    for (let i = 0; i < 3; i += 1) {
      addSine(bus, {
        startSec: echoStart,
        durationSec: fitDuration(echoStart, Math.max(0.003, ringDuration * 0.24), dur),
        freqHz: clamp(pitch * ratios[i] * (1 + (echo + 1) * 0.004), 30, 15_000),
        gain: (0.08 - echo * 0.025) * (0.6 + qNorm * 0.4),
        attackSec: 0.0007,
        decay: 0.72,
        phase: ctx.rng(),
        pan: randomBetween(ctx.rng, -0.35, 0.35),
      })
    }
  }

  addNoise(bus, {
    startSec: 0.001,
    durationSec: Math.max(0.004, Math.min(ringDuration, dur * 0.55)),
    cutoffHz: clamp(pitch * 1.15, 120, 12_000),
    filter: 'bandpass',
    q: clamp(q * 1.25, 0.6, 28),
    gain: 0.17 + grit * 0.3,
    attackSec: 0.0004,
    decay: 0.5 + decayCurve * 0.3,
    pan: 0.06,
    seed: ctx.nextSeed(),
  })

  const debris = randomInt(ctx.rng, 2, 8)
  for (let i = 0; i < debris; i += 1) {
    const start = dur * randomBetween(ctx.rng, 0.03, 0.9)
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(ctx.rng, 0.001, 0.006), dur),
      cutoffHz: clamp(pitch * randomBetween(ctx.rng, 0.8, 3.8), 200, 12_000),
      filter: 'bandpass',
      q: randomBetween(ctx.rng, 2, 12),
      gain: (0.04 + grit * 0.1) * (1 - i / (debris + 2)),
      attackSec: 0.00015,
      decay: 0.88,
      pan: randomBetween(ctx.rng, -0.7, 0.7),
      seed: ctx.nextSeed(),
    })
  }
}

function dice(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const bounceCount = randomInt(ctx.rng, 3, 5)
  const gapWeights: number[] = []
  for (let i = 1; i < bounceCount; i += 1) {
    gapWeights.push(randomBetween(ctx.rng, 0.7, 1.3) * Math.pow(0.61, i - 1))
  }
  const totalWeight = gapWeights.reduce((sum, value) => sum + value, 0) || 1
  const offsets = [0]
  const availableSpread = dur * 0.78
  let cursor = 0
  for (const weight of gapWeights) {
    cursor += (weight / totalWeight) * availableSpread
    offsets.push(cursor)
  }

  offsets.forEach((start, i) => {
    if (start >= dur) return
    const velocity = Math.pow(0.77, i) * randomBetween(ctx.rng, 0.85, 1.08)
    const pan = (i % 2 === 0 ? -1 : 1) * randomBetween(ctx.rng, 0.08, 0.32)
    const bodyPitch = pitch * randomBetween(ctx.rng, 0.82, 1.15)
    const clickDur = clamp(0.002 + punch * 0.005, 0.002, 0.008)
    const bodyDur = Math.min(randomBetween(ctx.rng, 0.08, 0.2), Math.max(0.01, dur - start))

    addNoise(bus, {
      startSec: start,
      durationSec: clickDur,
      cutoffHz: clamp(bodyPitch * randomBetween(ctx.rng, 2.4, 5.4), 450, 12_000),
      filter: 'highpass',
      q: 0.9,
      gain: (0.55 + punch * 0.35) * velocity,
      attackSec: 0.0001,
      decay: 0.95,
      pan,
      seed: ctx.nextSeed(),
    })
    addSine(bus, {
      startSec: start,
      durationSec: bodyDur,
      freqHz: bodyPitch,
      endFreqHz: bodyPitch * 0.92,
      gain: (0.55 + q / 24 * 0.25) * velocity,
      attackSec: Math.max(0.0005, attack * 1.2),
      decay: clamp(0.2 + decayCurve * 0.5, 0, 1),
      phase: ctx.rng(),
      pan: pan * 0.6,
    })
    addNoise(bus, {
      startSec: start,
      durationSec: clamp(0.008, 0.004, 0.015),
      cutoffHz: clamp(bodyPitch * 6, 600, 9000),
      filter: 'bandpass',
      q: clamp(q * 1.4, 0.7, 25),
      gain: (0.22 + grit * 0.2) * velocity,
      attackSec: 0.0002,
      decay: 0.82,
      pan: pan * 0.7,
      seed: ctx.nextSeed(),
    })

    if (grit > 0.35 && i < offsets.length - 1) {
      const tickStart = start + Math.max(0.004, clickDur * 1.8)
      addNoise(bus, {
        startSec: tickStart,
        durationSec: fitDuration(tickStart, 0.003, dur),
        cutoffHz: randomBetween(ctx.rng, 1800, 6500),
        filter: 'bandpass',
        q: randomBetween(ctx.rng, 2, 8),
        gain: grit * 0.075 * velocity,
        attackSec: 0.00015,
        decay: 0.9,
        pan: randomBetween(ctx.rng, -0.4, 0.4),
        seed: ctx.nextSeed(),
      })
    }
  })

  // A tiny settling rattle after the last visible bounce.
  const settleStart = Math.min(dur * 0.9, offsets[offsets.length - 1] + Math.max(0.03, dur * 0.08))
  if (settleStart < dur) {
    addNoise(bus, {
      startSec: settleStart,
      durationSec: fitDuration(settleStart, randomBetween(ctx.rng, 0.01, 0.032), dur),
      cutoffHz: clamp(pitch * 4, 450, 8000),
      filter: 'bandpass',
      q: 2.4,
      gain: (0.05 + grit * 0.08) * Math.pow(0.77, bounceCount),
      attackSec: 0.004,
      decay: 0.62,
      pan: 0.15,
      seed: ctx.nextSeed(),
    })
  }
}

function cloth(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q } = ctx
  const length = bus.left.length
  const cutoff = clamp(pitch * 0.78, 160, 6200)
  const lowpassL = new Biquad('lowpass', cutoff, clamp(q, 0.5, 3), SAMPLE_RATE)
  const lowpassR = new Biquad('lowpass', cutoff, clamp(q, 0.5, 3), SAMPLE_RATE)
  const focusL = new Biquad('bandpass', clamp(cutoff * 1.24, 180, 8200), 0.7, SAMPLE_RATE)
  const focusR = new Biquad('bandpass', clamp(cutoff * 1.24, 180, 8200), 0.7, SAMPLE_RATE)
  const rumbleL = new Biquad('highpass', 85, 0.65, SAMPLE_RATE)
  const rumbleR = new Biquad('highpass', 85, 0.65, SAMPLE_RATE)
  const pinkL = makePinkNoise(deriveSeed(ctx.seed, 'cloth-left'))
  const pinkR = makePinkNoise(deriveSeed(ctx.seed, 'cloth-right'))
  const attackSec = clamp(0.007 + (1 - punch) * 0.04, 0.006, Math.max(0.006, dur * 0.4))
  const attackFraction = attackSec / dur
  const modulationSpeed = randomBetween(ctx.rng, 2.1, 4.8)
  const phaseL = ctx.rng() * Math.PI * 2
  const phaseR = ctx.rng() * Math.PI * 2
  const secondaryL = randomBetween(ctx.rng, 5.8, 9.5)
  const secondaryR = randomBetween(ctx.rng, 5.8, 9.5)
  const dCurve = clamp(0.17 + decayCurve * 0.36, 0, 0.7)
  const [panL, panR] = panGains(-0.14)
  const grainCount = Math.max(2, Math.round(2 + grit * 6 + ctx.rng() * 2))

  for (let i = 0; i < length; i += 1) {
    const progress = i / Math.max(1, length - 1)
    const attack = Math.min(1, progress / attackFraction)
    const overall = decayShape(progress, dCurve)
    const swellL =
      0.22 +
      0.5 * Math.pow(0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * modulationSpeed + phaseL), 2) +
      0.28 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * secondaryL + phaseL * 0.7))
    const swellR =
      0.22 +
      0.5 * Math.pow(0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * modulationSpeed + phaseR), 2) +
      0.28 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * secondaryR + phaseR * 0.7))
    const envelope = attack * overall
    const left = rumbleL.process(pinkL())
    const right = rumbleR.process(pinkR())
    const focusedL = focusL.process(left) * 0.18
    const focusedR = focusR.process(right) * 0.18
    bus.left[i] += (lowpassL.process(left) + focusedL) * envelope * swellL * panL
    bus.right[i] += (lowpassR.process(right) + focusedR) * envelope * swellR * panR
  }

  // The initial flap that starts a cloth move, then irregular dry folds.
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.max(0.004, dur * clamp(0.08 + punch * 0.08, 0.05, 0.2)),
    cutoffHz: clamp(pitch * 1.2, 200, 6000),
    filter: 'bandpass',
    q: clamp(q * 0.8, 0.6, 3),
    gain: 0.22 + punch * 0.46,
    attackSec: 0.0015,
    decay: 0.5,
    pan: randomBetween(ctx.rng, -0.2, 0.2),
    seed: ctx.nextSeed(),
  })
  for (let i = 0; i < grainCount; i += 1) {
    const start = dur * randomBetween(ctx.rng, 0.04, 0.94)
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(ctx.rng, 0.006, 0.035), dur),
      cutoffHz: clamp(pitch * randomBetween(ctx.rng, 0.7, 2.1), 150, 7500),
      filter: 'bandpass',
      q: randomBetween(ctx.rng, 0.8, 3.8),
      gain: (0.035 + grit * 0.065) * randomBetween(ctx.rng, 0.5, 1.1),
      attackSec: randomBetween(ctx.rng, 0.002, 0.012),
      decay: randomBetween(ctx.rng, 0.28, 0.62),
      pan: randomBetween(ctx.rng, -0.75, 0.75),
      seed: ctx.nextSeed(),
      pink: i % 2 === 0,
    })
  }
}

function coin(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const ratios = [1, 1.552, 2.38, 3.09]
  const levels = [0.86, 0.62, 0.23, 0.12]
  const dCurve = clamp(0.08 + decayCurve * 0.45, 0, 1)
  const ringDuration = Math.max(0.02, dur * (0.76 + qNorm * 0.2))

  ratios.forEach((ratio, i) => {
    const frequency = clamp(pitch * ratio * randomBetween(ctx.rng, 0.9985, 1.0015), 40, 16_000)
    addSine(bus, {
      startSec: 0.0002 + i * 0.00012,
      durationSec: Math.max(0.004, ringDuration * (1 - i * 0.12)),
      freqHz: frequency,
      endFreqHz: frequency * randomBetween(ctx.rng, 0.996, 0.9995),
      gain: levels[i] * (0.82 + qNorm * 0.18),
      attackSec: Math.max(0.0002, attack * 0.8),
      decay: dCurve,
      phase: ctx.rng(),
      pan: randomBetween(ctx.rng, -0.16, 0.16),
    })
  })

  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.0018 + punch * 0.004, 0.0015, 0.006),
    cutoffHz: clamp(pitch * 1.4, 1000, 14_000),
    filter: 'highpass',
    q: 0.8,
    gain: 0.52 + punch * 0.4,
    attackSec: 0.00006,
    decay: 0.96,
    pan: randomBetween(ctx.rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.0004,
    durationSec: Math.max(0.005, Math.min(dur * 0.22, 0.08)),
    cutoffHz: clamp(pitch * 1.75, 800, 14_000),
    filter: 'bandpass',
    q: clamp(q * 1.2, 0.8, 30),
    gain: 0.1 + grit * 0.16,
    attackSec: 0.0003,
    decay: 0.75,
    seed: ctx.nextSeed(),
  })

  if (dur > 0.07) {
    const secondStart = clamp(dur * randomBetween(ctx.rng, 0.03, 0.07), 0.007, dur * 0.18)
    addSine(bus, {
      startSec: secondStart,
      durationSec: fitDuration(secondStart, Math.max(0.01, ringDuration * 0.35), dur),
      freqHz: clamp(pitch * randomBetween(ctx.rng, 0.988, 1.014), 40, 16_000),
      gain: (0.12 + punch * 0.14) * (0.8 + qNorm * 0.2),
      attackSec: 0.0005,
      decay: clamp(dCurve + 0.05, 0, 1),
      phase: ctx.rng(),
      pan: randomBetween(ctx.rng, -0.3, 0.3),
    })
    addNoise(bus, {
      startSec: secondStart,
      durationSec: fitDuration(secondStart, 0.003, dur),
      cutoffHz: clamp(pitch * 1.3, 1000, 14_000),
      filter: 'highpass',
      q: 0.9,
      gain: 0.12,
      attackSec: 0.0001,
      decay: 0.9,
      pan: randomBetween(ctx.rng, -0.3, 0.3),
      seed: ctx.nextSeed(),
    })
  }
}

function flesh(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack } = ctx
  const squelchDuration = Math.max(0.02, dur * 0.88)
  const startPitch = clamp(pitch * randomBetween(ctx.rng, 1.25, 1.55), 40, 5000)
  const endPitch = clamp(pitch * randomBetween(ctx.rng, 0.45, 0.65), 28, 4000)
  const fmHz = randomBetween(ctx.rng, 16, 34)

  // Pitch-bent FM core: the wet "voice" of the squish.
  addSine(bus, {
    startSec: 0,
    durationSec: squelchDuration,
    freqHz: startPitch,
    endFreqHz: endPitch,
    gain: 0.72,
    attackSec: Math.max(0.0008, attack * 1.4),
    decay: 0.3 + decayCurve * 0.55,
    phase: 0.2,
    fmHz,
    fmDepthHz: clamp(startPitch * randomBetween(ctx.rng, 0.28, 0.65), 10, 700),
    fmDecaySec: randomBetween(ctx.rng, 0.07, 0.19),
  })
  addSine(bus, {
    startSec: 0.003,
    durationSec: Math.max(0.01, squelchDuration * 0.55),
    freqHz: clamp(endPitch * 0.52, 26, 1100),
    gain: 0.2,
    attackSec: 0.004,
    decay: 0.55,
    phase: 0.7,
  })

  addNoise(bus, {
    startSec: 0,
    durationSec: Math.max(0.01, dur * 0.82),
    cutoffHz: clamp(startPitch * randomBetween(ctx.rng, 1.3, 2.6), 120, 9000),
    filter: 'bandpass',
    q: clamp(1.2 + q * 0.55, 0.8, 18),
    gain: 0.26 + grit * 0.42,
    attackSec: 0.004,
    decay: 0.44 + decayCurve * 0.34,
    pan: 0.12,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.055, dur * 0.3),
    cutoffHz: clamp(pitch * 3.4, 250, 10_000),
    filter: 'highpass',
    q: 0.72,
    gain: 0.22 + punch * 0.4,
    attackSec: 0.0003,
    decay: 0.9,
    pan: -0.1,
    seed: ctx.nextSeed(),
  })

  // A second smaller bubble/squelch keeps the gesture moving.
  const secondStart = dur * randomBetween(ctx.rng, 0.22, 0.42)
  if (secondStart < dur) {
    addSine(bus, {
      startSec: secondStart,
      durationSec: fitDuration(secondStart, Math.max(0.01, dur * 0.24), dur),
      freqHz: clamp(pitch * randomBetween(ctx.rng, 1.3, 1.8), 40, 4000),
      endFreqHz: clamp(pitch * randomBetween(ctx.rng, 0.72, 0.9), 30, 3000),
      gain: 0.16 + grit * 0.16,
      attackSec: 0.003,
      decay: 0.65,
      pan: randomBetween(ctx.rng, -0.35, 0.35),
      fmHz: randomBetween(ctx.rng, 22, 45),
      fmDepthHz: 20,
      fmDecaySec: 0.08,
      phase: 0.41,
    })
  }
}

function bone(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q } = ctx
  const length = bus.left.length
  const highpassCutoff = clamp(pitch * 0.7, 160, 6500)
  const highpassL = new Biquad('highpass', highpassCutoff, 0.7, SAMPLE_RATE)
  const highpassR = new Biquad('highpass', highpassCutoff * 0.92, 0.7, SAMPLE_RATE)
  const lowpassL = new Biquad('lowpass', 8500, 0.7, SAMPLE_RATE)
  const lowpassR = new Biquad('lowpass', 7600, 0.7, SAMPLE_RATE)
  const pinkL = makePinkNoise(deriveSeed(ctx.seed, 'bone-left'))
  const pinkR = makePinkNoise(deriveSeed(ctx.seed, 'bone-right'))

  const jumpCount = clamp(Math.round(4 + grit * 4), 4, 8)
  const jumpTimes: number[] = []
  const gates: number[] = []
  for (let i = 0; i < jumpCount; i += 1) {
    jumpTimes.push(dur * randomBetween(ctx.rng, 0.04, 0.9))
    gates.push(randomBetween(ctx.rng, 0.18, 1))
  }
  jumpTimes.sort((a, b) => a - b)
  const attackSec = clamp(0.004 + (1 - punch) * 0.018, 0.003, Math.max(0.004, dur * 0.28))
  const decayCurveValue = clamp(0.25 + decayCurve * 0.5, 0, 0.9)
  let jumpIndex = 0
  let currentGate = 0.55 + punch * 0.4

  for (let i = 0; i < length; i += 1) {
    const progress = i / Math.max(1, length - 1)
    const localTime = i / SAMPLE_RATE
    while (jumpIndex < jumpTimes.length && localTime >= jumpTimes[jumpIndex]) {
      currentGate = gates[jumpIndex]
      jumpIndex += 1
    }
    const attack = Math.min(1, progress / Math.max(1e-5, attackSec / dur))
    const overall = decayShape(progress, decayCurveValue)
    const noiseL = lowpassL.process(highpassL.process(pinkL()))
    const noiseR = lowpassR.process(highpassR.process(pinkR()))
    const envelope = attack * overall * currentGate
    bus.left[i] += noiseL * envelope
    bus.right[i] += noiseR * envelope
  }

  // Dry high-pass snap and several distinct fracture events on top of the bed.
  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.0025 + punch * 0.008, 0.002, 0.011),
    cutoffHz: clamp(pitch * 1.25, 300, 12_000),
    filter: 'highpass',
    q: 0.9,
    gain: 0.9 + punch * 0.5,
    attackSec: 0.00006,
    decay: 0.97,
    pan: randomBetween(ctx.rng, -0.12, 0.12),
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.07, dur),
    freqHz: clamp(pitch * 0.28, 32, 300),
    endFreqHz: clamp(pitch * 0.18, 28, 220),
    gain: 0.24 + punch * 0.2,
    attackSec: 0.0008,
    decay: 0.72,
    pan: 0,
    phase: 0.3,
  })

  const crackCount = Math.min(jumpTimes.length, 7)
  for (let i = 0; i < crackCount; i += 1) {
    const start = jumpTimes[i]
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(ctx.rng, 0.002, 0.012), dur),
      cutoffHz: clamp(pitch * randomBetween(ctx.rng, 0.9, 2.8), 200, 13_000),
      filter: 'highpass',
      q: randomBetween(ctx.rng, 0.7, 2.2),
      gain: (0.4 + grit * 0.45) * randomBetween(ctx.rng, 0.55, 1),
      attackSec: 0.00008,
      decay: 0.95,
      pan: randomBetween(ctx.rng, -0.55, 0.55),
      seed: ctx.nextSeed(),
    })
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(ctx.rng, 0.006, 0.026), dur),
      cutoffHz: clamp(pitch * randomBetween(ctx.rng, 1.5, 4.2), 300, 9000),
      filter: 'bandpass',
      q: clamp(q * randomBetween(ctx.rng, 1.2, 2.5), 0.7, 24),
      gain: 0.09 + grit * 0.11,
      attackSec: 0.0004,
      decay: 0.85,
      pan: randomBetween(ctx.rng, -0.35, 0.35),
      seed: ctx.nextSeed(),
    })
  }
}

const MODELS: Record<ModelId, (ctx: ModelContext) => void> = {
  mechanicalClick,
  cardSnap,
  woodButton,
  gravel: gravelCrunch,
  woodThud,
  stone,
  dice,
  cloth,
  coin,
  flesh,
  bone,
}

/**
 * Render one procedural sound. The function is intentionally pure and entirely
 * synchronous so the UI can display and export the exact buffer it auditions.
 */
export function synthesize(model: ModelId, inputParams: SynthParams, seed: number): RenderedSound {
  const params = sanitizeParams(inputParams)
  const length = Math.max(1, Math.round((params.durationMs / 1000) * SAMPLE_RATE))
  const ctx = makeContext(model, params, seed, length)
  MODELS[model](ctx)
  const peak = finalizeBus(ctx.bus)
  return {
    channels: [ctx.bus.left, ctx.bus.right],
    sampleRate: SAMPLE_RATE,
    durationMs: (length / SAMPLE_RATE) * 1000,
    peak,
  }
}

/** Small helper used by tests and metadata panel code. */
export function peakOf(channels: readonly Float32Array[]): number {
  let peak = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      const abs = Math.abs(channel[i])
      if (abs > peak) peak = abs
    }
  }
  return peak
}

export function rmsOf(channels: readonly Float32Array[]): number {
  let sum = 0
  let count = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      sum += channel[i] * channel[i]
      count += 1
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0
}
