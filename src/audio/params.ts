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

/** Batch preview and export sizes. The ZIP always contains this many files. */
export const BATCH_PREVIEW_COUNT = 10
export const BATCH_GAP_DEFAULT = 120
export const BATCH_GAP_MAX = 600
export const BATCH_GAP_STEP = 20

export const PARAM_RANGES: readonly ParamRange[] = [
  {
    key: 'durationMs',
    label: 'Length',
    helper: 'How long the sound lasts',
    ...PARAM_LIMITS.durationMs,
    step: 1,
    unit: 'ms',
    log: true,
    minLabel: 'Short',
    maxLabel: 'Long',
  },
  {
    key: 'pitchHz',
    label: 'Pitch',
    helper: 'How high or low it sounds',
    ...PARAM_LIMITS.pitchHz,
    step: 1,
    unit: 'Hz',
    log: true,
    minLabel: 'Low',
    maxLabel: 'High',
  },
  {
    key: 'punch',
    label: 'Punch',
    helper: 'How hard the start hits',
    ...PARAM_LIMITS.punch,
    step: 1,
    unit: '%',
    log: false,
    minLabel: 'Soft',
    maxLabel: 'Hard',
  },
  {
    key: 'resonance',
    label: 'Body',
    helper: 'How much the sound rings',
    ...PARAM_LIMITS.resonance,
    step: 0.1,
    unit: '',
    log: false,
    minLabel: 'Flat',
    maxLabel: 'Ringing',
  },
  {
    key: 'grit',
    label: 'Roughness',
    helper: 'Smooth or rough',
    ...PARAM_LIMITS.grit,
    step: 1,
    unit: '%',
    log: false,
    minLabel: 'Smooth',
    maxLabel: 'Rough',
  },
  {
    key: 'decay',
    label: 'Fade',
    helper: 'How fast the tail fades',
    ...PARAM_LIMITS.decay,
    step: 1,
    unit: '%',
    log: false,
    minLabel: 'Slow',
    maxLabel: 'Quick',
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

/**
 * Clamp a single control. The slider uses continuous positions while a range
 * input is being dragged or stepped, so rounding is optional: rendering still
 * goes through sanitizeParams(), but keeping the raw position lets keyboard
 * arrows accumulate at short durations instead of snapping back to the nearest
 * whole millisecond.
 */
export function sanitizeParam(key: ParamKey, value: number, round = true): number {
  const limits = PARAM_LIMITS[key]
  if (!Number.isFinite(value)) return limits.min
  const clamped = clamp(value, limits.min, limits.max)
  if (!round) return clamped
  const step = key === 'resonance' ? 0.1 : 1
  return roundTo(clamped, step)
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
