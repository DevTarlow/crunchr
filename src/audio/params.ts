import type { ParamKey, ParamRange, Preset, SynthParams } from './types'

export const PARAM_LIMITS = {
  durationMs: { min: 10, max: 800 },
  pitchHz: { min: 40, max: 6000 },
  punch: { min: 0, max: 100 },
  resonance: { min: 0.5, max: 24 },
  grit: { min: 0, max: 100 },
  decay: { min: 0, max: 100 },
} as const

export const HUMANIZE_MIN = 0
export const HUMANIZE_MAX = 50
export const DEFAULT_HUMANIZE = 20

export const PARAM_RANGES: readonly ParamRange[] = [
  {
    key: 'durationMs',
    label: 'Duration',
    helper: 'Total one-shot length',
    ...PARAM_LIMITS.durationMs,
    step: 1,
    log: true,
    minLabel: '10 ms',
    maxLabel: '800 ms',
  },
  {
    key: 'pitchHz',
    label: 'Pitch / Base Freq',
    helper: 'Material resonance or filter centre',
    ...PARAM_LIMITS.pitchHz,
    step: 1,
    log: true,
    minLabel: '40 Hz',
    maxLabel: '6 kHz',
  },
  {
    key: 'punch',
    label: 'Transient Punch',
    helper: 'Attack snap and initial impact',
    ...PARAM_LIMITS.punch,
    step: 1,
    log: false,
    minLabel: 'Soft',
    maxLabel: 'Hard',
  },
  {
    key: 'resonance',
    label: 'Resonance / Body',
    helper: 'Filter Q and material ring',
    ...PARAM_LIMITS.resonance,
    step: 0.1,
    log: false,
    minLabel: 'Damped',
    maxLabel: 'Ringy',
  },
  {
    key: 'grit',
    label: 'Grit / Texture',
    helper: 'Pure tone ↔ granular noise',
    ...PARAM_LIMITS.grit,
    step: 1,
    log: false,
    minLabel: 'Pure',
    maxLabel: 'Grain',
  },
  {
    key: 'decay',
    label: 'Decay Curve',
    helper: 'Linear slope ↔ snappy exponential',
    ...PARAM_LIMITS.decay,
    step: 1,
    log: false,
    minLabel: 'Linear',
    maxLabel: 'Expo',
  },
]

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundTo(value: number, step: number): number {
  const decimals = Math.max(0, (String(step).split('.')[1] ?? '').length)
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(decimals))
}

function sanitizeNumber(value: number, min: number, max: number, step: number, fallback: number): number {
  return Number.isFinite(value) ? roundTo(clamp(value, min, max), step) : fallback
}

/** Round and clamp a full parameter object. Used at every public input boundary. */
export function sanitizeParams(params: SynthParams): SynthParams {
  return {
    durationMs: sanitizeNumber(params.durationMs, 10, 800, 1, 100),
    pitchHz: sanitizeNumber(params.pitchHz, 40, 6000, 1, 440),
    punch: sanitizeNumber(params.punch, 0, 100, 1, 50),
    resonance: sanitizeNumber(params.resonance, 0.5, 24, 0.1, 4),
    grit: sanitizeNumber(params.grit, 0, 100, 1, 50),
    decay: sanitizeNumber(params.decay, 0, 100, 1, 50),
  }
}

export function sanitizeParam(key: ParamKey, value: number): number {
  const limits = PARAM_LIMITS[key]
  const step = key === 'resonance' ? 0.1 : 1
  return sanitizeNumber(value, limits.min, limits.max, step, limits.min)
}

export function sanitizeHumanize(value: number): number {
  return sanitizeNumber(value, HUMANIZE_MIN, HUMANIZE_MAX, 1, DEFAULT_HUMANIZE)
}

export function paramsEqual(a: SynthParams, b: SynthParams): boolean {
  return (
    a.durationMs === b.durationMs &&
    a.pitchHz === b.pitchHz &&
    a.punch === b.punch &&
    a.resonance === b.resonance &&
    a.grit === b.grit &&
    a.decay === b.decay
  )
}

export function isModifiedPreset(params: SynthParams, preset: Preset): boolean {
  return !paramsEqual(sanitizeParams(params), preset.defaults)
}

/**
 * Map a real parameter value to a normalised slider position. Log controls are
 * used for duration and pitch so the useful low end is not crammed into the
 * first few pixels of the rail.
 */
export function valueToPosition(value: number, min: number, max: number, log: boolean): number {
  const safe = clamp(value, min, max)
  if (!log) return ((safe - min) / (max - min)) * 1000
  return (Math.log(safe / min) / Math.log(max / min)) * 1000
}

export function positionToValue(position: number, min: number, max: number, log: boolean): number {
  const p = clamp(position / 1000, 0, 1)
  if (!log) return min + p * (max - min)
  return min * Math.pow(max / min, p)
}
