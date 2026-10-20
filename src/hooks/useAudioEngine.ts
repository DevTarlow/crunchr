import { useCallback, useEffect, useRef, useState } from 'react'
import { CrunchrAudioEngine } from '../audio/engine'
import type { EngineStatus, RenderedSound } from '../audio/types'

/**
 * Owns the browser audio engine for the lifetime of the app and exposes the
 * analyser without forcing React to re-render at 60 fps.
 */
export function useAudioEngine() {
  const engineRef = useRef<CrunchrAudioEngine | null>(null)
  const [status, setStatus] = useState<EngineStatus>('standby')
  const [isPlaying, setIsPlaying] = useState(false)

  const getEngine = useCallback((): CrunchrAudioEngine => {
    if (!engineRef.current) {
      const engine = new CrunchrAudioEngine()
      engine.onStatus = setStatus
      engineRef.current = engine
    }
    return engineRef.current
  }, [])

  const play = useCallback(
    async (sound: RenderedSound): Promise<void> => {
      const engine = getEngine()
      setIsPlaying(false)
      await engine.play(sound, () => {
        setIsPlaying(false)
      })
      setIsPlaying(true)
    },
    [getEngine],
  )

  const playSequence = useCallback(
    async (
      sounds: readonly RenderedSound[],
      gapMs: number,
      onStep?: (step: number, total: number) => void,
      onEnded?: () => void,
    ): Promise<void> => {
      const engine = getEngine()
      setIsPlaying(false)
      await engine.playSequence(sounds, gapMs, onStep, onEnded)
    },
    [getEngine],
  )

  const stop = useCallback((): void => {
    engineRef.current?.stop()
    setIsPlaying(false)
  }, [])

  const getWaveform = useCallback((): Float32Array | null => {
    return engineRef.current?.getTimeDomain() ?? null
  }, [])

  useEffect(() => {
    const wake = () => {
      void getEngine()
        .unlock()
        .catch(() => {
          // The status LED communicates unsupported/blocked audio; a failed
          // pre-arm must never interrupt the visual or export experience.
        })
    }

    // Listening in capture phase gives the first trigger gesture the best
    // possible chance of finding an already-running context.
    window.addEventListener('pointerdown', wake, { capture: true, once: true })
    window.addEventListener('keydown', wake, { capture: true, once: true })

    return () => {
      window.removeEventListener('pointerdown', wake, { capture: true })
      window.removeEventListener('keydown', wake, { capture: true })
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [getEngine])

  return { status, isPlaying, play, playSequence, stop, getWaveform }
}
