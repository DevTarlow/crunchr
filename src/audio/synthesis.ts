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
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const preFreq = clamp(pitch * 1.7, 3200, 9000)
  const mainFreq = clamp(pitch, 1200, 5000)
  const midFreq = clamp(pitch * 0.5, 600, 2000)
  const resonanceFreq = clamp(pitch * 0.98, 1200, 5000)
  const tailFreq = clamp(pitch * 1.5, 2200, 6500)
  const preDur = clamp(0.001 + (1 - punch) * 0.001, 0.0008, 0.0025)
  const mainDur = clamp(0.0015 + (1 - punch) * 0.0015, 0.001, 0.003)
  const resonanceDur = clamp(0.012 + qNorm * 0.02 - decayCurve * 0.005, 0.01, 0.035)
  const mainStart = 0.012
  const tailStart = mainStart + 0.006
  const tailDur = clamp(0.075 - decayCurve * 0.02, 0.05, 0.09)
  const bodyAttack = clamp(attack * 0.4, 0.0002, 0.002)

  // The small precursor tick starts the gesture. The main contact lands a few
  // milliseconds later, so the sound has a mechanical two-part action instead
  // of one drum-like downbeat.
  addNoise(bus, {
    startSec: 0,
    durationSec: preDur,
    cutoffHz: preFreq,
    filter: 'bandpass',
    q: 0.9,
    gain: 0.7 + punch * 0.3,
    attackSec: 0.00006,
    decay: 0.96,
    pan: randomBetween(rng, -0.05, 0.05),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.0005, dur * 0.01),
    cutoffHz: 7000,
    filter: 'highpass',
    q: 0.7,
    gain: 0.14,
    attackSec: 0.00005,
    decay: 0.98,
    pan: randomBetween(rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })

  // Main contact: mostly high-mid crack. There is only a very short low impulse
  // here; a long low body is what made the previous version read as a drum.
  addNoise(bus, {
    startSec: mainStart,
    durationSec: fitDuration(mainStart, mainDur, dur),
    cutoffHz: mainFreq,
    filter: 'bandpass',
    q: 1,
    gain: 2.1 + punch * 0.4,
    attackSec: 0.00006,
    decay: 0.97,
    pan: randomBetween(rng, -0.04, 0.04),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: mainStart,
    durationSec: fitDuration(mainStart, Math.min(0.0006, dur * 0.01), dur),
    cutoffHz: 6000,
    filter: 'highpass',
    q: 0.7,
    gain: 0.28 + punch * 0.12,
    attackSec: 0.00005,
    decay: 0.98,
    pan: randomBetween(rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: mainStart + 0.00015,
    durationSec: fitDuration(mainStart + 0.00015, Math.min(0.005, dur * 0.04), dur),
    cutoffHz: midFreq,
    filter: 'bandpass',
    q: 1.1,
    gain: 1.2 + punch * 0.25,
    attackSec: 0.00008,
    decay: 0.92,
    pan: randomBetween(rng, -0.12, 0.12),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: mainStart + 0.00035,
    durationSec: fitDuration(mainStart + 0.00035, Math.min(0.022, dur * 0.14), dur),
    cutoffHz: clamp(pitch * 0.4, 700, 1800),
    filter: 'bandpass',
    q: clamp(1.5 + q * 0.08, 1.5, 3),
    gain: 0.55 + grit * 0.1,
    attackSec: 0.0006,
    decay: 0.6,
    pan: -0.02,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: mainStart + 0.0004,
    durationSec: fitDuration(mainStart + 0.0004, Math.min(0.012, dur * 0.08), dur),
    cutoffHz: clamp(pitch * 0.65, 900, 2600),
    filter: 'bandpass',
    q: 1.2,
    gain: 0.35,
    attackSec: 0.0005,
    decay: 0.8,
    pan: randomBetween(rng, -0.15, 0.15),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: mainStart,
    durationSec: fitDuration(mainStart, Math.min(0.002, dur * 0.015), dur),
    cutoffHz: 180,
    filter: 'lowpass',
    q: 0.8,
    gain: 0.035 + punch * 0.02,
    attackSec: 0.0001,
    decay: 0.96,
    seed: ctx.nextSeed(),
  })

  // A short damped mid resonance gives the click its pitch and plastic identity
  // without holding a tone for the length of the clip.
  addNoise(bus, {
    startSec: mainStart + 0.0003,
    durationSec: fitDuration(mainStart + 0.0003, resonanceDur, dur),
    cutoffHz: resonanceFreq,
    filter: 'bandpass',
    q: clamp(2.5 + q * 0.15, 2.5, 5),
    gain: 0.9 + grit * 0.1,
    attackSec: bodyAttack,
    decay: 0.65,
    pan: 0.03,
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: mainStart + 0.0004,
    durationSec: fitDuration(mainStart + 0.0004, resonanceDur * 0.7, dur),
    freqHz: resonanceFreq,
    endFreqHz: resonanceFreq * 0.98,
    gain: 0.15,
    attackSec: 0.0002,
    decay: 0.82,
    phase: 0.7,
    pan: 0.02,
  })

  // High-mid tail: noise, not a low body. This is what makes the click feel
  // like a mechanism rather than a snare hit.
  addNoise(bus, {
    startSec: tailStart,
    durationSec: fitDuration(tailStart, tailDur, dur),
    cutoffHz: tailFreq,
    filter: 'bandpass',
    q: 1.3,
    gain: 0.05 + grit * 0.04,
    attackSec: 0.002,
    decay: 0.55,
    pan: randomBetween(rng, -0.1, 0.1),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: tailStart,
    durationSec: fitDuration(tailStart, tailDur * 1.35, dur),
    cutoffHz: clamp(tailFreq * 1.5, 3200, 9000),
    filter: 'bandpass',
    q: 1.1,
    gain: 0.025 + grit * 0.02,
    attackSec: 0.003,
    decay: 0.55,
    pan: randomBetween(rng, -0.2, 0.2),
    seed: ctx.nextSeed(),
  })

  // A tiny late contact tick mirrors the small secondary bump in a real switch
  // and gives the ear one more mechanical detail after the main click.
  const lateTick = Math.min(mainStart + randomBetween(rng, 0.05, 0.07), dur - 0.006)
  if (lateTick > tailStart) {
    addNoise(bus, {
      startSec: lateTick,
      durationSec: fitDuration(lateTick, 0.0022, dur),
      cutoffHz: clamp(pitch * 2.2, 4500, 10_000),
      filter: 'bandpass',
      q: 1.1,
      gain: 0.07 + grit * 0.045,
      attackSec: 0.0001,
      decay: 0.9,
      pan: randomBetween(rng, -0.2, 0.2),
      seed: ctx.nextSeed(),
    })
  }

  if (grit > 0.08 && dur > 0.02) {
    const tickCount = randomInt(rng, 1, 3)
    for (let i = 0; i < tickCount; i += 1) {
      const start = randomBetween(rng, 0.004, Math.min(0.045, dur * 0.28))
      addNoise(bus, {
        startSec: start,
        durationSec: fitDuration(start, randomBetween(rng, 0.001, 0.003), dur),
        cutoffHz: randomBetween(rng, 3000, 8000),
        filter: 'bandpass',
        q: randomBetween(rng, 2, 8),
        gain: (0.02 + grit * 0.04) * (1 - i / (tickCount + 1)),
        attackSec: 0.00012,
        decay: 0.94,
        pan: randomBetween(rng, -0.4, 0.4),
        seed: ctx.nextSeed(),
      })
    }
  }
}

function cardSnap(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const snapTime = clamp(dur * 0.09, 0.012, 0.024)
  const snapDur = clamp(0.0015 + (1 - punch) * 0.0015, 0.001, 0.003)
  const flexFreq = clamp(pitch * 0.6, 500, 2000)
  const snapFreq = clamp(pitch * 1.2, 1500, 4000)
  const midFreq = clamp(pitch * 0.75, 800, 2600)
  const plasticFreq = clamp(pitch * 0.55, 600, 1600)
  const lowFreq = clamp(pitch * 0.22, 180, 700)
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const plasticDur = clamp(0.04 + qNorm * 0.035 - decayCurve * 0.01, 0.03, 0.08)
  const flutterStart = snapTime + 0.02
  const flutterEnd = Math.min(dur * 0.78, 0.17)
  const modeAttack = clamp(attack * 0.3, 0.0001, 0.002)

  // A short rising flex creak before the snap tells the ear that the card is
  // being bent. It is made from little filtered-noise grains, not a pitch sweep.
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.0008, dur * 0.01),
    cutoffHz: 3500,
    filter: 'highpass',
    q: 0.7,
    gain: 0.06,
    attackSec: 0.00005,
    decay: 0.96,
    pan: randomBetween(rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })
  const creakCount = randomInt(rng, 3, 5)
  for (let i = 0; i < creakCount; i += 1) {
    const fraction = 0.15 + (i / Math.max(1, creakCount - 1)) * 0.7
    const start = Math.max(0, snapTime * fraction - randomBetween(rng, 0.001, 0.004))
    const cutoff = clamp(flexFreq * (0.7 + fraction * 1.1), 500, 2600)
    addNoise(bus, {
      startSec: start,
      durationSec: Math.min(randomBetween(rng, 0.005, 0.012), Math.max(0.003, snapTime - start + 0.004)),
      cutoffHz: cutoff,
      filter: 'bandpass',
      q: randomBetween(rng, 2, 5),
      gain: (0.2 + grit * 0.1) * (0.7 + fraction * 0.8),
      attackSec: 0.002,
      decay: 0.55,
      pan: randomBetween(rng, -0.35, 0.35),
      seed: ctx.nextSeed(),
    })
  }

  // The snap itself: a bright band-limited crack plus mid and low body.
  addNoise(bus, {
    startSec: snapTime,
    durationSec: fitDuration(snapTime, snapDur, dur),
    cutoffHz: snapFreq,
    filter: 'bandpass',
    q: 1.2,
    gain: 1.5 + punch * 0.3,
    attackSec: 0.00006,
    decay: 0.97,
    pan: randomBetween(rng, -0.05, 0.05),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: snapTime,
    durationSec: fitDuration(snapTime, Math.min(0.0006, dur * 0.01), dur),
    cutoffHz: clamp(pitch * 3, 5500, 12_000),
    filter: 'highpass',
    q: 0.7,
    gain: 0.16 + punch * 0.08,
    attackSec: 0.00005,
    decay: 0.98,
    pan: randomBetween(rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: snapTime + 0.0003,
    durationSec: fitDuration(snapTime + 0.0003, Math.min(0.003, dur * 0.025), dur),
    cutoffHz: midFreq,
    filter: 'bandpass',
    q: 1,
    gain: 0.65 + punch * 0.2,
    attackSec: 0.00008,
    decay: 0.92,
    pan: randomBetween(rng, -0.15, 0.15),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: snapTime + 0.0004,
    durationSec: fitDuration(snapTime + 0.0004, Math.min(0.004, dur * 0.03), dur),
    cutoffHz: clamp(pitch * 0.35, 300, 1200),
    filter: 'bandpass',
    q: 1.2,
    gain: 0.35 + punch * 0.12,
    attackSec: 0.0001,
    decay: 0.9,
    pan: 0.04,
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: snapTime,
    durationSec: fitDuration(snapTime, 0.022, dur),
    freqHz: lowFreq,
    endFreqHz: lowFreq * 0.92,
    gain: 0.26 + punch * 0.08,
    attackSec: modeAttack,
    decay: 0.78,
    phase: 0.2,
  })

  // A damped plastic body holds the sound together after the crack. It is
  // deliberately low-mid so it reads as a card, not as a high ping.
  addNoise(bus, {
    startSec: snapTime + 0.0005,
    durationSec: fitDuration(snapTime + 0.0005, plasticDur, dur),
    cutoffHz: plasticFreq,
    filter: 'bandpass',
    q: clamp(2.2 + q * 0.15, 2.2, 4.5),
    gain: 0.45 + grit * 0.08,
    attackSec: 0.001,
    decay: 0.55,
    pan: 0.05,
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: snapTime + 0.0006,
    durationSec: fitDuration(snapTime + 0.0006, plasticDur * 0.8, dur),
    freqHz: plasticFreq,
    endFreqHz: plasticFreq * 0.96,
    gain: 0.15,
    attackSec: 0.0015,
    decay: 0.65,
    phase: 0.7,
    pan: -0.03,
  })

  // The card flutters and settles. Irregular little flaps after the snap are
  // what make it read as a thin, flexible card rather than a generic click.
  if (flutterStart < flutterEnd) {
    addNoise(bus, {
      startSec: flutterStart,
      durationSec: fitDuration(flutterStart, Math.min(flutterEnd - flutterStart, 0.12), dur),
      cutoffHz: 1800,
      filter: 'bandpass',
      q: 0.8,
      gain: 0.12 + grit * 0.05,
      attackSec: 0.01,
      decay: 0.4,
      pan: 0.06,
      seed: ctx.nextSeed(),
      pink: true,
    })
    const flutterCount = randomInt(rng, 5, 9)
    const flutterTimes: number[] = []
    for (let i = 0; i < flutterCount; i += 1) {
      flutterTimes.push(randomBetween(rng, flutterStart, flutterEnd))
    }
    flutterTimes.sort((a, b) => a - b)
    for (let i = 0; i < flutterTimes.length; i += 1) {
      const start = flutterTimes[i]
      const cutoff = randomBetween(rng, 1200, 4500)
      const taper = 1 - (i / (flutterTimes.length + 1)) * 0.8
      addNoise(bus, {
        startSec: start,
        durationSec: fitDuration(start, randomBetween(rng, 0.004, 0.012), dur),
        cutoffHz: cutoff,
        filter: 'bandpass',
        q: randomBetween(rng, 1, 4),
        gain: (0.14 + grit * 0.12) * taper,
        attackSec: randomBetween(rng, 0.0004, 0.002),
        decay: randomBetween(rng, 0.45, 0.8),
        pan: randomBetween(rng, -0.6, 0.6),
        seed: ctx.nextSeed(),
      })
    }
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
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const bodyFreq = clamp(60 + pitch * 0.03, 60, 140)
  const knockFreq = clamp(pitch * 0.24, 220, 600)
  const bodyDur = clamp(0.045 - decayCurve * 0.02, 0.018, 0.05)
  const bodyAttack = clamp(attack * 0.6, 0.0004, 0.004)
  const knockAttack = clamp(attack * 0.5, 0.0003, 0.003)
  const scuffDecay = clamp(0.18 + decayCurve * 0.18, 0.18, 0.36)

  // The sole hits the concrete: a broadband slap plus a slightly darker crack.
  addNoise(bus, {
    startSec: 0,
    durationSec: clamp(0.004 + punch * 0.008, 0.003, 0.014),
    cutoffHz: clamp(pitch * 0.9, 900, 6000),
    filter: 'highpass',
    q: 0.8,
    gain: 0.85 + punch * 0.3,
    attackSec: 0.00008,
    decay: 0.96,
    pan: randomBetween(rng, -0.06, 0.06),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.0004,
    durationSec: Math.min(0.02, dur * 0.1),
    cutoffHz: clamp(pitch * 0.65, 500, 2800),
    filter: 'bandpass',
    q: 1.1,
    gain: 0.6 + punch * 0.2,
    attackSec: 0.0002,
    decay: 0.9,
    pan: randomBetween(rng, -0.1, 0.1),
    seed: ctx.nextSeed(),
  })

  // Weight comes from a short low thump, not a pitched harmonic stack.
  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(bodyDur, dur),
    freqHz: bodyFreq,
    endFreqHz: bodyFreq * 0.72,
    gain: 0.2 + punch * 0.1,
    attackSec: bodyAttack,
    decay: 0.78,
    phase: 0.2,
  })
  addSine(bus, {
    startSec: 0.0003,
    durationSec: Math.min(0.016, dur * 0.12),
    freqHz: knockFreq,
    endFreqHz: knockFreq * 0.94,
    gain: 0.17 + punch * 0.08,
    attackSec: knockAttack,
    decay: 0.88,
    phase: 0.4,
    pan: 0.03,
  })

  // A sliding band of pink noise reads as grit being ground under the sole.
  addNoise(bus, {
    startSec: 0.001,
    durationSec: Math.min(0.17, dur * 0.7),
    cutoffHz: clamp(pitch * 1.5, 900, 5000),
    endCutoffHz: clamp(pitch * 0.55, 350, 2200),
    filter: 'bandpass',
    q: 2.6,
    endQ: 1.5,
    gain: 0.55 + grit * 0.12,
    attackSec: 0.004,
    decay: scuffDecay,
    pan: -0.08,
    seed: ctx.nextSeed(),
    pink: true,
  })

  const grainCount = Math.round(26 + grit * 26)
  for (let i = 0; i < grainCount; i += 1) {
    const start = randomBetween(rng, 0.004, Math.max(0.005, dur * 0.84))
    const duration = randomBetween(rng, 0.002, 0.011) * (1 - (i / (grainCount + 4)) * 0.45)
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, duration, dur),
      cutoffHz: randomBetween(rng, 700, 5800),
      filter: rng() > 0.12 ? 'bandpass' : 'highpass',
      q: clamp(0.8 + q * 0.13, 0.8, 3.2),
      gain:
        (0.055 + grit * 0.16) *
        randomBetween(rng, 0.5, 1) *
        (1 - (i / (grainCount + 2)) * 0.5),
      attackSec: randomBetween(rng, 0.00012, 0.0008),
      decay: randomBetween(rng, 0.5, 0.95),
      pan: randomBetween(rng, -0.65, 0.65),
      seed: ctx.nextSeed(),
    })
  }

  // A single short reflection suggests the hard surface without a bell-like tail.
  const reflectStart = 0.012
  if (reflectStart < dur) {
    addNoise(bus, {
      startSec: reflectStart,
      durationSec: fitDuration(reflectStart, 0.008, dur),
      cutoffHz: clamp(pitch * 1.1, 700, 4500),
      filter: 'lowpass',
      q: 0.8,
      gain: 0.13 + grit * 0.05,
      attackSec: 0.0005,
      decay: 0.8,
      pan: randomBetween(rng, 0.2, 0.6),
      seed: ctx.nextSeed(),
    })
  }

  const debris = randomInt(rng, 3, 8)
  for (let i = 0; i < debris; i += 1) {
    const start = randomBetween(rng, dur * 0.25, dur * 0.95)
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(rng, 0.001, 0.004), dur),
      cutoffHz: randomBetween(rng, 1800, 7000),
      filter: 'bandpass',
      q: randomBetween(rng, 2, 8),
      gain: (0.025 + grit * 0.05) * (1 - i / (debris + 2)),
      attackSec: 0.00012,
      decay: 0.9,
      pan: randomBetween(rng, -0.7, 0.7),
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
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const center = clamp(pitch, 80, 400)
  const impactFreq = clamp(center * 0.5, 45, 130)
  const qMain = clamp(3.5 + q * 0.3, 3, 7.5)
  const mainAttack = clamp(attack * 2.4, 0.006, 0.02)
  const mainDecay = clamp(0.16 + decayCurve * 0.16, 0.16, 0.32)
  const mainDur = Math.min(dur * (0.55 + decayCurve * 0.15), 0.24)
  const secondDecay = clamp(0.28 + decayCurve * 0.16, 0.28, 0.44)

  // A small low impact anchors the squelch. It is short and quiet; all the wet
  // character comes from the moving filters below.
  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.035, dur * 0.14),
    freqHz: impactFreq,
    endFreqHz: clamp(center * 0.35, 32, 100),
    gain: 0.14 + punch * 0.06,
    attackSec: clamp(attack * 1.2, 0.0008, 0.008),
    decay: 0.85,
    phase: 0.2,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.008, dur * 0.03),
    cutoffHz: clamp(center * 7, 900, 6000),
    filter: 'highpass',
    q: 0.7,
    gain: 0.14 + punch * 0.25,
    attackSec: 0.0003,
    decay: 0.9,
    pan: -0.08,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.001,
    durationSec: Math.min(0.024, dur * 0.11),
    cutoffHz: clamp(center * 3.2, 450, 2400),
    filter: 'bandpass',
    q: 1.4,
    gain: 0.18 + punch * 0.15,
    attackSec: clamp(attack * 1.5, 0.001, 0.01),
    decay: 0.6,
    pan: 0.1,
    seed: ctx.nextSeed(),
  })

  // The main downward formant is the "squelch": a resonant band sliding from a
  // bright wet sound into the low body of the flesh.
  addNoise(bus, {
    startSec: 0.001,
    durationSec: mainDur,
    cutoffHz: center * 7,
    endCutoffHz: center * 0.6,
    filter: 'bandpass',
    q: qMain,
    endQ: clamp(qMain * 1.2, 4, 8),
    gain: 0.52,
    attackSec: mainAttack,
    decay: mainDecay,
    pan: 0.1,
    seed: ctx.nextSeed(),
  })
  // A second, smaller formant rises as the first one falls, keeping the gesture
  // moving like a real wet squelch.
  addNoise(bus, {
    startSec: dur * 0.18,
    durationSec: Math.min(0.55 * dur, 0.19),
    cutoffHz: center * 0.8,
    endCutoffHz: center * 4.2,
    filter: 'bandpass',
    q: clamp(4 + q * 0.3, 3.5, 9),
    endQ: clamp(3 + q * 0.25, 2, 8),
    gain: 0.35,
    attackSec: clamp(attack * 2, 0.008, 0.02),
    decay: secondDecay,
    pan: -0.12,
    seed: ctx.nextSeed(),
  })
  // Pink noise fills the low-mid body so the squelch has weight without a drone.
  addNoise(bus, {
    startSec: dur * 0.02,
    durationSec: Math.min(0.85 * dur, 0.29),
    cutoffHz: center * 3,
    endCutoffHz: center * 1.2,
    filter: 'bandpass',
    q: 2,
    endQ: 1.6,
    gain: 0.2,
    attackSec: 0.02,
    decay: clamp(0.24 + decayCurve * 0.12, 0.24, 0.36),
    pan: 0.08,
    seed: ctx.nextSeed(),
    pink: true,
  })

  // Bubbles and little suction pops break up the sweep.
  const bubbleCount = randomInt(rng, 24 + Math.round(grit * 8), 32 + Math.round(grit * 10))
  const bubbleGain = 0.75 + grit * 0.35
  for (let i = 0; i < bubbleCount; i += 1) {
    const start = randomBetween(rng, dur * 0.03, dur * 0.92)
    const frequency = randomBetween(rng, 200, 1900)
    const fade = 1 - (i / (bubbleCount + 3)) * 0.4
    if (rng() > 0.5) {
      addNoise(bus, {
        startSec: start,
        durationSec: fitDuration(start, randomBetween(rng, 0.003, 0.02), dur),
        cutoffHz: frequency,
        filter: 'bandpass',
        q: randomBetween(rng, 3, 9),
        gain: randomBetween(rng, 0.025, 0.1) * fade * bubbleGain,
        attackSec: randomBetween(rng, 0.0004, 0.002),
        decay: randomBetween(rng, 0.65, 0.95),
        pan: randomBetween(rng, -0.65, 0.65),
        seed: ctx.nextSeed(),
      })
    } else {
      addNoise(bus, {
        startSec: start,
        durationSec: fitDuration(start, randomBetween(rng, 0.005, 0.026), dur),
        cutoffHz: frequency,
        endCutoffHz: frequency * randomBetween(rng, 0.6, 1.8),
        filter: 'bandpass',
        q: randomBetween(rng, 3, 8),
        endQ: randomBetween(rng, 2, 7),
        gain: randomBetween(rng, 0.026, 0.095) * bubbleGain,
        attackSec: randomBetween(rng, 0.0006, 0.0025),
        decay: randomBetween(rng, 0.65, 0.92),
        pan: randomBetween(rng, -0.65, 0.65),
        seed: ctx.nextSeed(),
      })
    }
  }

  // A final upward suction releases the squelch instead of letting it fade flat.
  const suctionStart = dur * 0.72
  if (suctionStart < dur) {
    addNoise(bus, {
      startSec: suctionStart,
      durationSec: fitDuration(suctionStart, Math.min(0.24 * dur, 0.1), dur),
      cutoffHz: center * 1.2,
      endCutoffHz: center * 4,
      filter: 'bandpass',
      q: clamp(4 + q * 0.3, 3, 9),
      endQ: 3,
      gain: 0.16,
      attackSec: 0.01,
      decay: 0.5,
      pan: 0.15,
      seed: ctx.nextSeed(),
    })
  }
}

function arcaneZap(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const base = clamp(pitch, 120, 3200)
  const startFreq = clamp(base * 1.35, 180, 3800)
  const endFreq = clamp(base * 0.32, 55, 1200)
  const glideDur = Math.min(dur * 0.82, clamp(0.1 + (1 - decayCurve) * 0.12, 0.06, 0.24))
  const mainDecay = clamp(0.5 + decayCurve * 0.3, 0.45, 0.82)
  const mainAttack = clamp(attack * 0.9, 0.0002, 0.006)
  const partials = [
    { ratio: 1, gain: 0.88 },
    { ratio: 2.01, gain: 0.3 + qNorm * 0.12 },
    { ratio: 3.03, gain: 0.16 + qNorm * 0.1 },
    { ratio: 5.07, gain: 0.08 + qNorm * 0.07 },
  ]

  // A bright contact tick opens the arc; the harmonic stack below supplies the
  // synth-like body that a physical-material model would not have.
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.0035, dur * 0.02),
    cutoffHz: clamp(base * 3.4, 4000, 12_000),
    filter: 'highpass',
    q: 0.8,
    gain: 0.5 + punch * 0.5,
    attackSec: 0.00006,
    decay: 0.97,
    pan: randomBetween(rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })

  partials.forEach((partial, index) => {
    const start = 0.0002 + index * 0.00015
    const duration = fitDuration(start, glideDur * (1 - index * 0.06), dur)
    addSine(bus, {
      startSec: start,
      durationSec: duration,
      freqHz: startFreq * partial.ratio,
      endFreqHz: endFreq * partial.ratio,
      gain: partial.gain * (0.8 + punch * 0.25),
      attackSec: mainAttack * (1 + index * 0.4),
      decay: mainDecay,
      phase: rng(),
      pan: index === 0 ? 0 : randomBetween(rng, -0.18, 0.18),
    })
  })

  // A slightly detuned twin widens the arc without turning it into a chorus.
  addSine(bus, {
    startSec: 0.001,
    durationSec: fitDuration(0.001, glideDur * 0.9, dur),
    freqHz: startFreq * 1.007,
    endFreqHz: endFreq * 1.007,
    gain: 0.32 * (0.8 + punch * 0.25),
    attackSec: clamp(mainAttack * 1.3, 0.0002, 0.007),
    decay: clamp(mainDecay + 0.04, 0, 1),
    phase: rng(),
    pan: randomBetween(rng, -0.12, 0.12),
  })

  // A downward-filtered noise sweep adds the crackle the ear expects from a
  // spell arcing through the air.
  addNoise(bus, {
    startSec: 0.0005,
    durationSec: fitDuration(0.0005, Math.min(glideDur * 0.9, dur * 0.55), dur),
    cutoffHz: clamp(startFreq * 0.9, 800, 9000),
    endCutoffHz: clamp(endFreq * 2.2, 250, 6000),
    filter: 'bandpass',
    q: clamp(1.2 + q * 0.08, 1.2, 2.8),
    gain: 0.12 + grit * 0.18,
    attackSec: 0.0008,
    decay: 0.6,
    pan: 0.12,
    seed: ctx.nextSeed(),
    pink: true,
  })

  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.09, dur * 0.3),
    freqHz: clamp(base * 0.07, 45, 180),
    endFreqHz: clamp(base * 0.06, 38, 160),
    gain: 0.14 + punch * 0.08,
    attackSec: 0.001,
    decay: 0.75,
    phase: 0.3,
  })

  const crackleCount = randomInt(rng, 4 + Math.round(grit * 4), 7 + Math.round(grit * 6))
  for (let i = 0; i < crackleCount; i += 1) {
    const start = randomBetween(rng, 0.01, Math.min(dur * 0.62, 0.16))
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(rng, 0.0015, 0.006), dur),
      cutoffHz: randomBetween(rng, 1500, 8000),
      filter: 'bandpass',
      q: randomBetween(rng, 1.5, 6),
      gain: (0.03 + grit * 0.05) * (1 - i / (crackleCount + 2)),
      attackSec: randomBetween(rng, 0.0001, 0.0005),
      decay: 0.9,
      pan: randomBetween(rng, -0.65, 0.65),
      seed: ctx.nextSeed(),
    })
  }

  if (dur > 0.12) {
    const tailStart = Math.min(dur * 0.62, glideDur * 1.25)
    addNoise(bus, {
      startSec: tailStart,
      durationSec: fitDuration(tailStart, Math.min(0.05, dur * 0.24), dur),
      cutoffHz: clamp(base * 0.55, 500, 3000),
      filter: 'bandpass',
      q: 1.4,
      gain: 0.03 + grit * 0.03,
      attackSec: 0.006,
      decay: 0.5,
      pan: -0.1,
      seed: ctx.nextSeed(),
    })
  }
}

function magicShimmer(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const base = clamp(pitch, 80, 5000)
  const pingCount = clamp(Math.round(12 + grit * 10 + rng() * 4), 12, 28)
  const tailDecay = clamp(0.28 + decayCurve * 0.36, 0.25, 0.65)
  const pingDecay = clamp(0.55 + decayCurve * 0.32, 0.5, 0.9)
  const pingRing = 0.6 + qNorm * 0.7

  // A continuous air bed keeps the sparkle cloud from reading as isolated ticks.
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(dur * 0.95, 0.65),
    cutoffHz: clamp(base * 0.75, 200, 7000),
    endCutoffHz: clamp(base * 2.3, 500, 9000),
    filter: 'bandpass',
    q: clamp(1.5 + q * 0.08, 1.5, 3.2),
    gain: 0.055 + grit * 0.06,
    attackSec: clamp(dur * 0.18, 0.02, 0.12),
    decay: tailDecay,
    pan: 0.06,
    seed: ctx.nextSeed(),
    pink: true,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.04, dur * 0.12),
    cutoffHz: clamp(base * 1.6, 800, 10_000),
    filter: 'bandpass',
    q: 1.2,
    gain: 0.08 + punch * 0.22,
    attackSec: 0.002,
    decay: 0.5,
    pan: -0.12,
    seed: ctx.nextSeed(),
  })

  const starts: { start: number; progress: number }[] = []
  for (let i = 0; i < pingCount; i += 1) {
    const progress = i / Math.max(1, pingCount - 1)
    const jitter = randomBetween(rng, -0.03, 0.03)
    const start = clamp((0.03 + progress * 0.86 + jitter) * dur, 0, Math.max(0, dur - 0.002))
    starts.push({ start, progress })
  }
  starts.sort((a, b) => a.start - b.start)

  for (const { start, progress } of starts) {
    // The pings climb as the gesture progresses, so the cloud reads as a rising
    // shimmer rather than a static wind chime.
    const rise = 0.75 + progress * 2.1
    const frequency = clamp(base * rise * randomBetween(rng, 0.94, 1.07), 40, 16_000)
    const pingDuration = randomBetween(rng, 0.03, 0.09) * pingRing * (0.8 + qNorm * 0.4)
    const pingAttack = clamp(attack * (0.5 + qNorm * 0.8), 0.0008, 0.008)
    const gain = randomBetween(rng, 0.08, 0.2) * (1 - progress * 0.15)
    addSine(bus, {
      startSec: start,
      durationSec: fitDuration(start, pingDuration, dur),
      freqHz: frequency,
      endFreqHz: frequency * randomBetween(rng, 0.995, 1.006),
      gain,
      attackSec: pingAttack,
      decay: pingDecay,
      phase: rng(),
      pan: randomBetween(rng, -0.65, 0.65),
    })
    if (qNorm > 0.1 || rng() > 0.55) {
      addSine(bus, {
        startSec: start + 0.0005,
        durationSec: fitDuration(start + 0.0005, pingDuration * 0.7, dur),
        freqHz: clamp(frequency * 2.01, 80, 18_000),
        endFreqHz: clamp(frequency * 2.01, 80, 18_000),
        gain: gain * (0.3 + qNorm * 0.25),
        attackSec: clamp(pingAttack * 1.3, 0.0008, 0.01),
        decay: clamp(pingDecay + 0.08, 0, 1),
        phase: rng(),
        pan: randomBetween(rng, -0.5, 0.5),
      })
    }
  }

  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.3, dur * 0.55),
    freqHz: clamp(base * 0.25, 70, 700),
    endFreqHz: clamp(base * 0.24, 68, 680),
    gain: 0.06,
    attackSec: 0.01,
    decay: 0.55,
    phase: 0.2,
    pan: 0.02,
  })
}

function powerUp(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const root = clamp(pitch, 70, 2200)
  const ratios = [1, 1.25, 1.5, 2] as const
  const starts = [0, 0.16, 0.33, 0.52] as const
  const noteDecay = clamp(0.28 + decayCurve * 0.42, 0.25, 0.72)
  const harmonicGain = 0.24 + qNorm * 0.22
  const shineGain = 0.06 + qNorm * 0.08
  const lower = clamp(root * 0.32, 48, 180)
  const attackSec = clamp(attack * 1.2, 0.0006, 0.012)
  const openingGain = 0.18 + punch * 0.14

  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.09, dur * 0.25),
    freqHz: lower,
    endFreqHz: lower * 0.82,
    gain: openingGain,
    attackSec: clamp(attack * 0.8, 0.0008, 0.006),
    decay: 0.8,
    phase: 0.2,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.006, dur * 0.02),
    cutoffHz: clamp(root * 6, 900, 9000),
    filter: 'highpass',
    q: 0.8,
    gain: 0.12 + punch * 0.2,
    attackSec: 0.0001,
    decay: 0.9,
    pan: -0.04,
    seed: ctx.nextSeed(),
  })

  ratios.forEach((ratio, index) => {
    const start = dur * starts[index]
    if (start >= dur) return
    const frequency = clamp(root * ratio, 40, 12_000)
    const idealDuration = Math.min(0.45, Math.max(0.06, dur * (0.9 - index * 0.1)))
    const noteDuration = fitDuration(start, idealDuration, dur)
    const gain = (index === ratios.length - 1 ? 0.72 : 0.58) * (0.85 + punch * 0.2)
    const pan = index % 2 === 0 ? -0.07 : 0.07

    addSine(bus, {
      startSec: start,
      durationSec: noteDuration,
      freqHz: frequency,
      endFreqHz: frequency * 1.008,
      gain,
      attackSec: attackSec * (1 + index * 0.15),
      decay: noteDecay,
      phase: rng(),
      pan,
    })
    addSine(bus, {
      startSec: start + 0.0004,
      durationSec: fitDuration(start + 0.0004, noteDuration * 0.8, dur),
      freqHz: clamp(frequency * 2, 80, 16_000),
      endFreqHz: clamp(frequency * 2 * 1.004, 80, 16_000),
      gain: gain * harmonicGain,
      attackSec: clamp(attackSec * 1.4, 0.0008, 0.014),
      decay: clamp(noteDecay + 0.06, 0, 1),
      phase: rng(),
      pan: pan * 0.7,
    })
    if (qNorm > 0.1) {
      addSine(bus, {
        startSec: start + 0.0008,
        durationSec: fitDuration(start + 0.0008, noteDuration * 0.55, dur),
        freqHz: clamp(frequency * 3.01, 120, 18_000),
        endFreqHz: clamp(frequency * 3.01, 120, 18_000),
        gain: gain * harmonicGain * 0.38,
        attackSec: clamp(attackSec * 1.7, 0.001, 0.016),
        decay: clamp(noteDecay + 0.12, 0, 1),
        phase: rng(),
        pan: -pan,
      })
    }
    addSine(bus, {
      startSec: start + 0.0012,
      durationSec: fitDuration(start + 0.0012, noteDuration * 0.5, dur),
      freqHz: clamp(frequency * 4.02, 160, 18_000),
      endFreqHz: clamp(frequency * 4.02, 160, 18_000),
      gain: gain * shineGain,
      attackSec: clamp(attackSec * 2, 0.001, 0.018),
      decay: clamp(noteDecay + 0.18, 0, 1),
      phase: rng(),
      pan: pan * 0.5,
    })

    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, Math.min(0.008, noteDuration * 0.2), dur),
      cutoffHz: clamp(frequency * 5, 1200, 12_000),
      filter: 'bandpass',
      q: 1.2,
      gain: 0.07 + grit * 0.14,
      attackSec: 0.0002,
      decay: 0.9,
      pan,
      seed: ctx.nextSeed(),
    })
  })

  const tailStart = dur * 0.62
  if (tailStart < dur) {
    const sparkleCount = randomInt(rng, 3 + Math.round(grit * 3), 6 + Math.round(grit * 4))
    for (let i = 0; i < sparkleCount; i += 1) {
      const start = randomBetween(rng, tailStart, Math.max(tailStart, dur * 0.92))
      const frequency = clamp(root * randomBetween(rng, 3, 7), 500, 15_000)
      addSine(bus, {
        startSec: start,
        durationSec: fitDuration(start, randomBetween(rng, 0.02, 0.07), dur),
        freqHz: frequency,
        endFreqHz: frequency,
        gain: (0.05 + grit * 0.1) * (1 - i / (sparkleCount + 2)),
        attackSec: 0.002,
        decay: 0.8,
        phase: rng(),
        pan: randomBetween(rng, -0.6, 0.6),
      })
    }
    addNoise(bus, {
      startSec: tailStart,
      durationSec: fitDuration(tailStart, Math.min(0.2, dur * 0.35), dur),
      cutoffHz: clamp(root * 3.5, 700, 9000),
      endCutoffHz: clamp(root * 6, 1200, 14_000),
      filter: 'bandpass',
      q: 1.1,
      gain: 0.06 + grit * 0.12,
      attackSec: 0.01,
      decay: 0.45,
      pan: 0.1,
      seed: ctx.nextSeed(),
    })
  }
}

function spellWhoosh(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, rng } = ctx
  const center = clamp(pitch, 120, 4200)
  const bandQ = clamp(1.2 + q * 0.35, 1.2, 7)
  const swell = clamp(0.02 + (1 - punch) * 0.12, 0.015, Math.max(0.02, dur * 0.4))
  const decayA = clamp(0.2 + decayCurve * 0.28, 0.2, 0.5)
  const decayB = clamp(0.24 + decayCurve * 0.22, 0.24, 0.48)
  const lowFreq = clamp(center * 0.26, 45, 360)

  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.34, dur * 0.7),
    freqHz: lowFreq,
    endFreqHz: clamp(center * 0.5, 80, 800),
    gain: 0.06 + punch * 0.06,
    attackSec: swell * 1.2,
    decay: 0.55,
    phase: 0.2,
    pan: 0.04,
  })

  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(dur * 0.92, dur - 0.0005),
    cutoffHz: clamp(center * 0.55, 120, 3500),
    endCutoffHz: clamp(center * 2.3, 500, 9000),
    filter: 'bandpass',
    q: bandQ,
    endQ: clamp(bandQ * 0.85, 1, 7),
    gain: 0.55 + grit * 0.2,
    attackSec: swell,
    decay: decayA,
    pan: -0.16,
    seed: ctx.nextSeed(),
    pink: true,
  })

  // A white-noise air layer rides above the main band so the sweep still reads
  // as moving air on small speakers with little low-end response.
  addNoise(bus, {
    startSec: 0.001,
    durationSec: fitDuration(0.001, Math.min(dur * 0.82, dur - 0.001), dur),
    cutoffHz: clamp(center * 1.7, 900, 5000),
    endCutoffHz: clamp(center * 5.2, 3000, 12_000),
    filter: 'bandpass',
    q: 1.1,
    endQ: 1.5,
    gain: 0.12 + grit * 0.08,
    attackSec: swell * 0.8,
    decay: decayA,
    pan: 0.12,
    seed: ctx.nextSeed(),
  })

  const secondStart = dur * 0.12
  if (secondStart < dur) {
    addNoise(bus, {
      startSec: secondStart,
      durationSec: fitDuration(secondStart, dur * 0.72, dur),
      cutoffHz: clamp(center * 2.7, 600, 10_000),
      endCutoffHz: clamp(center * 0.8, 180, 4500),
      filter: 'bandpass',
      q: clamp(bandQ * 0.8, 1, 6),
      endQ: bandQ,
      gain: 0.3 + grit * 0.3,
      attackSec: swell * 0.8,
      decay: decayB,
      pan: 0.2,
      seed: ctx.nextSeed(),
      pink: true,
    })
  }

  const gustCount = randomInt(rng, 2 + Math.round(grit * 2), 4 + Math.round(grit * 4))
  for (let i = 0; i < gustCount; i += 1) {
    const start = randomBetween(rng, dur * 0.1, dur * 0.88)
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(rng, 0.015, 0.06), dur),
      cutoffHz: randomBetween(rng, center * 1.4, center * 4.2),
      filter: 'bandpass',
      q: randomBetween(rng, 1.5, 5),
      gain: (0.03 + grit * 0.06) * (1 - i / (gustCount + 2)),
      attackSec: randomBetween(rng, 0.002, 0.01),
      decay: randomBetween(rng, 0.4, 0.75),
      pan: randomBetween(rng, -0.7, 0.7),
      seed: ctx.nextSeed(),
      pink: true,
    })
  }

  if (punch > 0.45) {
    addNoise(bus, {
      startSec: 0,
      durationSec: Math.min(0.012, dur * 0.05),
      cutoffHz: clamp(center * 1.2, 500, 9000),
      filter: 'highpass',
      q: 0.8,
      gain: (punch - 0.45) * 1.2,
      attackSec: 0.0003,
      decay: 0.9,
      pan: 0.05,
      seed: ctx.nextSeed(),
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

function jump(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const base = clamp(pitch, 160, 2400)
  const pushFreq = clamp(base * 0.22, 45, 160)
  const airStart = clamp(base * 0.8, 240, 2800)
  const airEnd = clamp(base * 2.2, 700, 5000)
  const liftStart = clamp(base * 1.15, 180, 2600)
  const liftEnd = clamp(base * 2.1, 320, 4400)
  const pushDur = Math.min(0.1, dur * 0.4)
  const airDur = Math.min(0.24, dur * 0.85)
  const liftDur = Math.min(0.18, dur * 0.7)
  const airAttack = clamp(attack * 4, 0.01, 0.06)
  const airDecay = clamp(0.3 + decayCurve * 0.2, 0.28, 0.55)
  const liftDecay = clamp(0.42 + decayCurve * 0.25, 0.38, 0.7)

  // A short low push gives the takeoff weight. The pink-noise sweep above it is
  // deliberately soft and slow to open, so the jump reads as air, not static.
  addSine(bus, {
    startSec: 0,
    durationSec: pushDur,
    freqHz: pushFreq,
    endFreqHz: pushFreq * 0.78,
    gain: 0.16 + punch * 0.12,
    attackSec: clamp(attack * 0.9, 0.0006, 0.006),
    decay: 0.8,
    phase: 0.2,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.025, dur * 0.1),
    cutoffHz: clamp(base * 2.5, 600, 8000),
    filter: 'bandpass',
    q: 1.1,
    gain: 0.05 + punch * 0.1,
    attackSec: 0.002,
    decay: 0.5,
    pan: randomBetween(rng, -0.12, 0.12),
    seed: ctx.nextSeed(),
  })

  addNoise(bus, {
    startSec: 0.0005,
    durationSec: fitDuration(0.0005, airDur, dur),
    cutoffHz: airStart,
    endCutoffHz: airEnd,
    filter: 'bandpass',
    q: clamp(1.8 + q * 0.08, 1.8, 3.4),
    endQ: 1.2,
    gain: 0.38 + grit * 0.14,
    attackSec: airAttack,
    decay: airDecay,
    pan: -0.1,
    seed: ctx.nextSeed(),
    pink: true,
  })
  addNoise(bus, {
    startSec: 0.003,
    durationSec: fitDuration(0.003, airDur * 0.75, dur),
    cutoffHz: clamp(airStart * 1.2, 400, 4000),
    endCutoffHz: clamp(airEnd * 1.05, 900, 7000),
    filter: 'bandpass',
    q: 0.9,
    gain: 0.05 + grit * 0.04,
    attackSec: airAttack * 0.8,
    decay: clamp(airDecay + 0.04, 0, 1),
    pan: 0.14,
    seed: ctx.nextSeed(),
    pink: true,
  })

  // A quiet lifted tone makes the takeoff read as a jump rather than a plain
  // whoosh, while Body controls how much it rings.
  addSine(bus, {
    startSec: 0.004,
    durationSec: fitDuration(0.004, liftDur, dur),
    freqHz: liftStart,
    endFreqHz: liftEnd,
    gain: 0.17 + qNorm * 0.08,
    attackSec: clamp(airAttack * 0.7, 0.008, 0.04),
    decay: liftDecay,
    phase: 0.6,
    pan: 0.05,
  })
}

function land(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const base = clamp(pitch, 70, 300)
  const lowStart = clamp(base * 1.4, 60, 220)
  const lowEnd = lowStart * 0.42
  const bodyDur = Math.min(0.16, dur * 0.55)
  const bodyDecay = clamp(0.45 + decayCurve * 0.3, 0.4, 0.75)
  const dustDecay = clamp(0.3 + decayCurve * 0.3, 0.28, 0.6)

  // A weighty low drop is the landing. The sub layer and dust keep it from
  // reading as a wooden footstep.
  addSine(bus, {
    startSec: 0,
    durationSec: bodyDur,
    freqHz: lowStart,
    endFreqHz: lowEnd,
    gain: 0.24 + punch * 0.1,
    attackSec: clamp(attack * 0.9, 0.0005, 0.005),
    decay: bodyDecay,
    phase: 0.2,
  })
  addSine(bus, {
    startSec: 0.002,
    durationSec: bodyDur * 0.8,
    freqHz: clamp(lowStart * 0.55, 35, 120),
    endFreqHz: clamp(lowEnd * 0.55, 30, 100),
    gain: 0.08 + qNorm * 0.04,
    attackSec: 0.0015,
    decay: clamp(bodyDecay + 0.08, 0, 1),
    phase: 0.6,
  })
  addSine(bus, {
    startSec: 0.001,
    durationSec: Math.min(0.09, dur * 0.3),
    freqHz: clamp(base * 5, 300, 1600),
    endFreqHz: clamp(base * 4.4, 260, 1400),
    gain: 0.55 + punch * 0.15,
    attackSec: 0.0008,
    decay: 0.85,
    phase: 0.4,
    pan: 0.03,
  })
  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.014, dur * 0.05),
    cutoffHz: clamp(base * 20, 2200, 8000),
    filter: 'highpass',
    q: 0.8,
    gain: 1 + punch * 0.25,
    attackSec: 0.00008,
    decay: 0.96,
    pan: randomBetween(rng, -0.08, 0.08),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.002,
    durationSec: fitDuration(0.002, Math.min(0.14, dur * 0.46), dur),
    cutoffHz: clamp(base * 8, 700, 3000),
    endCutoffHz: clamp(base * 2.4, 300, 1100),
    filter: 'bandpass',
    q: 1.3,
    gain: 0.7 + grit * 0.15,
    attackSec: 0.001,
    decay: 0.5,
    pan: 0.04,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.004,
    durationSec: fitDuration(0.004, Math.min(0.24, dur * 0.72), dur),
    cutoffHz: clamp(base * 8, 700, 2600),
    endCutoffHz: clamp(base * 2.4, 300, 1100),
    filter: 'bandpass',
    q: clamp(1.2 + q * 0.1, 1.2, 3.6),
    endQ: 1.1,
    gain: 0.6 + grit * 0.18,
    attackSec: 0.002,
    decay: dustDecay,
    pan: -0.08,
    seed: ctx.nextSeed(),
    pink: true,
  })

  const debris = randomInt(rng, 3 + Math.round(grit * 2), 6 + Math.round(grit * 4))
  for (let i = 0; i < debris; i += 1) {
    const start = randomBetween(rng, 0.02, Math.min(0.18, dur * 0.55))
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(rng, 0.0015, 0.005), dur),
      cutoffHz: randomBetween(rng, 1500, 6000),
      filter: 'bandpass',
      q: randomBetween(rng, 1.5, 6),
      gain: (0.02 + grit * 0.045) * (1 - i / (debris + 2)),
      attackSec: randomBetween(rng, 0.0001, 0.0006),
      decay: 0.9,
      pan: randomBetween(rng, -0.6, 0.6),
      seed: ctx.nextSeed(),
    })
  }
}

function hit(ctx: ModelContext): void {
  const { bus, durationSec: dur, pitch, punch, grit, decayCurve, q, attack, rng } = ctx
  const qNorm = clamp((q - 0.5) / 23.5, 0, 1)
  const base = clamp(pitch, 220, 3000)
  const lowFreq = clamp(base * 0.18, 55, 180)
  const midFreq = clamp(base * 1.1, 400, 5000)
  const bodyDecay = clamp(0.5 + decayCurve * 0.28, 0.45, 0.78)

  addNoise(bus, {
    startSec: 0,
    durationSec: Math.min(0.008, dur * 0.04),
    cutoffHz: clamp(base * 4, 2500, 12_000),
    filter: 'highpass',
    q: 0.8,
    gain: 1.1 + punch * 0.4,
    attackSec: 0.00006,
    decay: 0.97,
    pan: randomBetween(rng, -0.06, 0.06),
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.0002,
    durationSec: Math.min(0.04, dur * 0.18),
    cutoffHz: midFreq,
    filter: 'bandpass',
    q: 1.2,
    gain: 1.2 + punch * 0.3,
    attackSec: 0.00008,
    decay: 0.95,
    pan: randomBetween(rng, -0.1, 0.1),
    seed: ctx.nextSeed(),
  })
  addSine(bus, {
    startSec: 0,
    durationSec: Math.min(0.03, dur * 0.16),
    freqHz: lowFreq,
    endFreqHz: lowFreq * 0.78,
    gain: 0.24 + punch * 0.1,
    attackSec: clamp(attack * 0.7, 0.0004, 0.004),
    decay: bodyDecay,
    phase: 0.2,
  })
  addSine(bus, {
    startSec: 0.0008,
    durationSec: Math.min(0.03, dur * 0.16),
    freqHz: clamp(base * 0.55, 120, 1600),
    endFreqHz: clamp(base * 0.53, 110, 1500),
    gain: 0.1 + qNorm * 0.06,
    attackSec: 0.0008,
    decay: clamp(bodyDecay + 0.1, 0, 1),
    phase: 0.5,
    pan: 0.03,
  })
  addNoise(bus, {
    startSec: 0.001,
    durationSec: fitDuration(0.001, Math.min(0.09, dur * 0.45), dur),
    cutoffHz: clamp(base * 1.4, 700, 5000),
    endCutoffHz: clamp(base * 0.5, 300, 1800),
    filter: 'bandpass',
    q: 1.2,
    gain: 0.5 + grit * 0.15,
    attackSec: 0.001,
    decay: 0.5,
    pan: 0.08,
    seed: ctx.nextSeed(),
  })
  addNoise(bus, {
    startSec: 0.002,
    durationSec: fitDuration(0.002, Math.min(0.12, dur * 0.55), dur),
    cutoffHz: clamp(base * 0.9, 350, 3000),
    filter: 'bandpass',
    q: 1.2,
    gain: 0.1 + grit * 0.06,
    attackSec: 0.002,
    decay: clamp(0.35 + decayCurve * 0.2, 0.3, 0.6),
    pan: 0.1,
    seed: ctx.nextSeed(),
    pink: true,
  })

  const ticks = randomInt(rng, 1 + Math.round(grit * 2), 3 + Math.round(grit * 4))
  for (let i = 0; i < ticks; i += 1) {
    const start = randomBetween(rng, 0.003, Math.min(0.04, dur * 0.25))
    addNoise(bus, {
      startSec: start,
      durationSec: fitDuration(start, randomBetween(rng, 0.001, 0.004), dur),
      cutoffHz: randomBetween(rng, 900, 7000),
      filter: 'bandpass',
      q: randomBetween(rng, 1.5, 6),
      gain: (0.02 + grit * 0.05) * (1 - i / (ticks + 2)),
      attackSec: randomBetween(rng, 0.0001, 0.0005),
      decay: 0.9,
      pan: randomBetween(rng, -0.5, 0.5),
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
  jump,
  land,
  hit,
  arcaneZap,
  shimmer: magicShimmer,
  powerUp,
  whoosh: spellWhoosh,
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
