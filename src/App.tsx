import { useCallback, useEffect, useRef, useState } from 'react'
import type { CategoryId, ParamKey, Preset, SynthParams } from './audio/types'
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  clonePresetDefaults,
  getPresetById,
  getPresetsByCategory,
} from './audio/presets'
import { DEFAULT_HUMANIZE, isModifiedPreset, sanitizeHumanize, sanitizeParam } from './audio/params'
import { createRng, createSeed } from './audio/random'
import { jitterParameters, mutateParameters } from './audio/variations'
import {
  buildBatchArchive,
  downloadBlob,
  downloadBytes,
  singleWavFor,
} from './audio/export'
import { useRenderedSound } from './hooks/useRenderedSound'
import { useAudioEngine } from './hooks/useAudioEngine'
import { Header } from './components/Header'
import { PresetBank } from './components/PresetBank'
import { ParameterPanel } from './components/ParameterPanel'
import { PerformancePanel } from './components/PerformancePanel'
import { ExportDock, type ExportKind } from './components/ExportDock'
import { Toast, type ToastMessage, type ToastTone } from './components/Toast'
import { AlertIcon, CrunchMark, SpeakerIcon } from './components/Icons'

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function App() {
  const initialPreset = getPresetById(DEFAULT_PRESET_ID)
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [params, setParams] = useState<SynthParams>(() => clonePresetDefaults(initialPreset))
  const [humanize, setHumanize] = useState(DEFAULT_HUMANIZE)
  const [seed, setSeed] = useState(() => createSeed())
  const [triggerNonce, setTriggerNonce] = useState(0)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [exportKind, setExportKind] = useState<ExportKind | null>(null)
  const [batchProgress, setBatchProgress] = useState(0)

  const toastTimerRef = useRef<number | null>(null)
  const exportBusyRef = useRef(false)

  const activePreset = getPresetById(activePresetId)
  const sound = useRenderedSound(activePreset, params, seed)
  const modified = isModifiedPreset(params, activePreset)
  const activeCategory = activePreset.category

  const { status, isPlaying, play, getWaveform } = useAudioEngine()

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToast(null)
  }, [])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      setToast({ id: Date.now(), message, tone })
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, 4_200)
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const choosePreset = useCallback((preset: Preset) => {
    setActivePresetId(preset.id)
    setParams(clonePresetDefaults(preset))
    setSeed(createSeed())
    setTriggerNonce(0)
  }, [])

  const chooseCategory = useCallback(
    (category: CategoryId) => {
      const first = getPresetsByCategory(category)[0]
      if (first) choosePreset(first)
    },
    [choosePreset],
  )

  const handleParamChange = useCallback((key: ParamKey, value: number) => {
    setParams((previous) => ({ ...previous, [key]: sanitizeParam(key, value) }))
  }, [])

  const handleHumanizeChange = useCallback((value: number) => {
    setHumanize(sanitizeHumanize(value))
  }, [])

  const handleSurprise = useCallback(() => {
    const nextSeed = createSeed()
    const rng = createRng(nextSeed)
    const preset = PRESETS[Math.floor(rng() * PRESETS.length)] ?? PRESETS[0]
    setActivePresetId(preset.id)
    setParams(jitterParameters(clonePresetDefaults(preset), 0.15, rng))
    setSeed(nextSeed)
    setTriggerNonce(0)
  }, [])

  const handleMutate = useCallback(() => {
    const next = mutateParameters(params, humanize, createRng(createSeed()))
    setParams(next.params)
    setHumanize(next.humanize)
  }, [humanize, params])

  const trigger = useCallback(() => {
    setTriggerNonce((value) => value + 1)
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
    } catch {
      // Haptics are optional and unavailable on most desktop browsers.
    }
    void play(sound).catch((error: unknown) => {
      showToast(messageFromError(error, 'The audio engine could not start.'), 'error')
    })
  }, [play, showToast, sound])

  // Spacebar is the performance key. Ignore editable fields, let the trigger
  // button use its native space activation, and prevent the page from scrolling.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('.trigger-button')) return
      if (
        target?.closest(
          'textarea, select, input:not([type="range"]), [contenteditable="true"], [contenteditable=""]',
        )
      ) {
        return
      }
      event.preventDefault()
      trigger()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [trigger])

  const handleExportSingle = useCallback(() => {
    if (exportBusyRef.current) return
    exportBusyRef.current = true
    setExportKind('single')
    const presetSnapshot = activePreset
    const soundSnapshot = sound
    try {
      const { blob, filename } = singleWavFor(presetSnapshot, soundSnapshot)
      downloadBlob(blob, filename)
      showToast(`Exported ${filename} · 44.1 kHz / 16-bit stereo`)
    } catch (error) {
      showToast(messageFromError(error, 'WAV encoding failed.'), 'error')
    } finally {
      setExportKind(null)
      exportBusyRef.current = false
    }
  }, [activePreset, showToast, sound])

  const handleExportBatch = useCallback(async () => {
    if (exportBusyRef.current) return
    exportBusyRef.current = true
    setExportKind('batch')
    setBatchProgress(0)

    const snapshot = {
      preset: activePreset,
      params,
      humanize,
      seed,
    }

    try {
      const result = await buildBatchArchive({
        ...snapshot,
        onProgress: (completed) => setBatchProgress(completed),
      })
      downloadBytes(result.bytes, result.filename, 'application/zip')
      showToast(`Packed ${result.files.length} humanized takes into ${result.filename}`)
    } catch (error) {
      showToast(messageFromError(error, 'Batch export failed.'), 'error')
    } finally {
      exportBusyRef.current = false
      setExportKind(null)
      setBatchProgress(0)
    }
  }, [activePreset, humanize, params, seed, showToast])

  return (
    <div
      className="app-root"
      data-audio-state={status}
      data-playing={isPlaying ? 'true' : 'false'}
      data-export-state={exportKind ?? 'idle'}
    >
      <div className="app-atmosphere" aria-hidden="true" />
      <div className="app-shell">
        <Header engineStatus={status} isPlaying={isPlaying} />

        <main className="app-main">
          <PresetBank
            activePreset={activePreset}
            modified={modified}
            onSelectCategory={chooseCategory}
            onSelectPreset={choosePreset}
            onSurprise={handleSurprise}
            onMutate={handleMutate}
          />

          {status === 'unsupported' ? (
            <div className="engine-warning" role="status">
              <span className="engine-warning-icon" aria-hidden="true">
                <AlertIcon />
              </span>
              <span>
                Live audio could not start in this browser. You can still shape the
                waveform and export WAV files. Try tapping the trigger once more, or check
                that audio is allowed for this page.
              </span>
            </div>
          ) : null}

          <div className="workbench">
            <ParameterPanel
              params={params}
              humanize={humanize}
              onParamChange={handleParamChange}
              onHumanizeChange={handleHumanizeChange}
            />
            <PerformancePanel
              preset={activePreset}
              sound={sound}
              seed={seed}
              modified={modified}
              isPlaying={isPlaying}
              triggerNonce={triggerNonce}
              getWaveform={getWaveform}
              onTrigger={trigger}
            />
          </div>

          <ExportDock
            exportKind={exportKind}
            batchProgress={batchProgress}
            humanize={humanize}
            onExportSingle={handleExportSingle}
            onExportBatch={() => {
              void handleExportBatch()
            }}
          />
        </main>

        <footer className="app-footer">
          <div className="footer-brand">
            <span className="footer-mark" aria-hidden="true">
              <CrunchMark />
            </span>
            <span>CRUNCHR</span>
            <span className="footer-version">v1.0</span>
          </div>
          <p className="footer-manifesto">
            <SpeakerIcon aria-hidden="true" />
            No samples. No servers. No telemetry. Just math, noise, and microseconds.
          </p>
          <p className="footer-made">
            Built for game feel
            <span aria-hidden="true">·</span>
            {activeCategory === 'ui' ? 'UI' : activeCategory === 'footsteps' ? 'Steps' : activeCategory === 'foley' ? 'Foley' : 'Crunch'}
          </p>
        </footer>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
