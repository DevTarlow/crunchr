import { useMemo } from 'react'
import { synthesize } from '../audio/synthesis'
import type { Preset, RenderedSound, SynthParams } from '../audio/types'

/** Render the whole one-shot whenever the meaningful sound state changes. */
export function useRenderedSound(preset: Preset, params: SynthParams, seed: number): RenderedSound {
  return useMemo(() => synthesize(preset.model, params, seed), [preset.model, params, seed])
}
