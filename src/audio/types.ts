export const SAMPLE_RATE = 44_100
export const WAV_BIT_DEPTH = 16

export type CategoryId = 'ui' | 'footsteps' | 'foley' | 'impacts'

export type ModelId =
  | 'mechanicalClick'
  | 'cardSnap'
  | 'woodButton'
  | 'gravel'
  | 'woodThud'
  | 'stone'
  | 'dice'
  | 'cloth'
  | 'coin'
  | 'flesh'
  | 'bone'

/** The six live sound-shaping controls. Humanize is a batch-only control. */
export interface SynthParams {
  durationMs: number
  pitchHz: number
  punch: number
  resonance: number
  grit: number
  decay: number
}

export interface Preset {
  id: string
  name: string
  slug: string
  category: CategoryId
  model: ModelId
  description: string
  tags: readonly string[]
  defaults: SynthParams
}

export interface RenderedSound {
  channels: readonly [Float32Array, Float32Array]
  sampleRate: number
  durationMs: number
  peak: number
}

export interface SoundVariation {
  index: number
  seed: number
  params: SynthParams
}

export type EngineStatus = 'standby' | 'armed' | 'unsupported'

export type ParamKey = keyof SynthParams

export interface ParamRange {
  key: ParamKey
  label: string
  helper: string
  min: number
  max: number
  step: number
  log: boolean
  minLabel: string
  maxLabel: string
}
