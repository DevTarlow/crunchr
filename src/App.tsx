import { useCallback, useEffect, useRef, useState } from 'react'
import type { CategoryId, ParamKey, Preset, SynthParams } from './audio/types'
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  clonePresetDefaults,
  getCategory,
  getPresetById,
  getPresetsByCategory,
} from './audio/presets'
import {
  BATCH_GAP_DEFAULT,
  BATCH_GAP_MAX,
  BATCH_GAP_STEP,
  BATCH_PREVIEW_COUNT,
  DEFAULT_HUMANIZE,
  isModifiedPreset,
  sanitizeHumanize,
  sanitizeParam,
} from './audio/params'
import { createRng, createSeed } from './audio/random'
import { buildVariations, jitterParameters, mutateParameters } from './audio/variations'
import { synthesize } from './audio/synthesis'
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
import { HelpDialog } from './components/HelpDialog'
import { Toast, type ToastMessage, type ToastTone } from './components/Toast'
import { AlertIcon, CrunchMark, SpeakerIcon } from './components/Icons'
import {
  SESSION_VERSION,
  readSession,
  writeSession,
  type SessionSnapshot,
  type SoundDraft,
} from './lib/session'

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function App() {
  const [initialSession] = useState(readSession)
  const initialPreset = getPresetById(initialSession?.activePresetId ?? DEFAULT_PRESET_ID)
  const initialDraft = initialSession?.drafts[initialPreset.id]
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [params, setParams] = useState<SynthParams>(
    () => initialDraft?.params ?? clonePresetDefaults(initialPreset),
  )
  const [humanize, setHumanize] = useState(initialSession?.humanize ?? DEFAULT_HUMANIZE)
  const [seed, setSeed] = useState(() => initialDraft?.seed ?? createSeed())
  const [take, setTake] = useState(initialDraft?.take ?? 1)
  const [helpOpen, setHelpOpen] = useState(false)
  const [triggerNonce, setTriggerNonce] = useState(0)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [exportKind, setExportKind] = useState<ExportKind | null>(null)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchGapMs, setBatchGapMs] = useState(initialSession?.batchGapMs ?? BATCH_GAP_DEFAULT)
  const [batchPreviewPlaying, setBatchPreviewPlaying] = useState(false)
  const [batchPreviewStep, setBatchPreviewStep] = useState(0)

  const toastTimerRef = useRef<number | null>(null)
  const exportBusyRef = useRef(false)
  const batchPreviewActiveRef = useRef(false)
  const sessionSaveTimerRef = useRef<number | null>(null)
  const latestSessionRef = useRef<SessionSnapshot | null>(null)
  const draftsRef = useRef<Record<string, SoundDraft>>(initialSession?.drafts ?? {})

  const activePreset = getPresetById(activePresetId)
  const sound = useRenderedSound(activePreset, params, seed)
  const modified = isModifiedPreset(params, activePreset)
  const activeCategory = activePreset.category

  const { status, isPlaying, play, playSequence, stop, getWaveform } = useAudioEngine()

  const closeHelp = useCallback(() => setHelpOpen(false), [])

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

  const stopBatchPreview = useCallback(() => {
    if (!batchPreviewActiveRef.current) return
    batchPreviewActiveRef.current = false
    setBatchPreviewPlaying(false)
    setBatchPreviewStep(0)
    stop()
  }, [stop])

  /**
   * Every sound-changing action auditions its result. This runs inside the
   * original click/key event, so the autoplay gesture still applies. A blocked
   * engine is reported by the status warning and the explicit Play path; an
   * automatic audition should never throw a toast in the user's face.
   */
  const audition = useCallback(
    (preset: Preset, nextParams: SynthParams, nextSeed: number) => {
      if (status === 'unsupported') return
      stopBatchPreview()
      setTriggerNonce((value) => value + 1)
      const nextSound = synthesize(preset.model, nextParams, nextSeed)
      void play(nextSound).catch(() => {
        // The status warning and the manual Play path explain a blocked engine.
      })
    },
    [play, status, stopBatchPreview],
  )

  const choosePreset = useCallback(
    (preset: Preset) => {
      const reroll = preset.id === activePresetId
      // Capture the outgoing draft synchronously so a quick click never loses
      // the latest slider movement, even if the debounced save has not fired.
      draftsRef.current[activePresetId] = { params, seed, take }
      const savedDraft = draftsRef.current[preset.id]
      const nextTake = reroll ? take + 1 : savedDraft?.take ?? 1
      const nextParams = reroll ? params : savedDraft?.params ?? clonePresetDefaults(preset)
      const nextSeed = reroll ? createSeed() : savedDraft?.seed ?? createSeed()

      if (!reroll) dismissToast()
      setActivePresetId(preset.id)
      setParams(nextParams)
      setSeed(nextSeed)
      setTake(nextTake)
      audition(preset, nextParams, nextSeed)
      if (reroll) {
        showToast(`New version ${nextTake}. Same sound, new changes.`)
      }
    },
    [activePresetId, audition, dismissToast, params, seed, showToast, take],
  )

  const chooseCategory = useCallback(
    (category: CategoryId) => {
      // Clicking the active category is a no-op, not a hidden re-roll.
      if (category === activePreset.category) return
      const first = getPresetsByCategory(category)[0]
      if (first) choosePreset(first)
    },
    [activePreset.category, choosePreset],
  )

  const handleParamChange = useCallback((key: ParamKey, value: number) => {
    setParams((previous) => ({ ...previous, [key]: sanitizeParam(key, value, false) }))
  }, [])

  const handleHumanizeChange = useCallback((value: number) => {
    setHumanize(sanitizeHumanize(value))
  }, [])

  const persistSession = useCallback((snapshot: SessionSnapshot) => {
    latestSessionRef.current = snapshot
    if (sessionSaveTimerRef.current !== null) {
      window.clearTimeout(sessionSaveTimerRef.current)
    }
    sessionSaveTimerRef.current = window.setTimeout(() => {
      sessionSaveTimerRef.current = null
      writeSession(snapshot)
    }, 300)
  }, [])

  // Keep the draft map and the debounced browser snapshot in sync. The ref is
  // updated synchronously on every render so preset switches always see the
  // newest values.
  useEffect(() => {
    draftsRef.current[activePresetId] = { params, seed, take }
    persistSession({
      version: SESSION_VERSION,
      activePresetId,
      drafts: { ...draftsRef.current },
      humanize,
      batchGapMs,
    })
  }, [activePresetId, batchGapMs, humanize, params, persistSession, seed, take])

  useEffect(() => {
    const flush = () => {
      if (latestSessionRef.current) writeSession(latestSessionRef.current)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      if (sessionSaveTimerRef.current !== null) {
        window.clearTimeout(sessionSaveTimerRef.current)
        sessionSaveTimerRef.current = null
      }
      flush()
    }
  }, [])

  const batchSignature = `${activePreset.id}|${seed}|${humanize}|${params.durationMs}|${params.pitchHz}|${params.punch}|${params.resonance}|${params.grit}|${params.decay}`

  useEffect(() => {
    stopBatchPreview()
  }, [batchSignature, stopBatchPreview])

  const handleBatchGapChange = useCallback(
    (value: number) => {
      const next = Math.min(
        BATCH_GAP_MAX,
        Math.max(0, Math.round(value / BATCH_GAP_STEP) * BATCH_GAP_STEP),
      )
      setBatchGapMs(next)
      stopBatchPreview()
    },
    [stopBatchPreview],
  )

  const handleToggleBatchPreview = useCallback(() => {
    if (batchPreviewActiveRef.current) {
      stopBatchPreview()
      return
    }

    const variations = buildVariations(params, humanize, seed, BATCH_PREVIEW_COUNT)
    const sounds = variations.map((variation) =>
      synthesize(activePreset.model, variation.params, variation.seed),
    )

    stop()
    batchPreviewActiveRef.current = true
    setBatchPreviewPlaying(true)
    setBatchPreviewStep(1)

    void playSequence(
      sounds,
      batchGapMs,
      (step) => setBatchPreviewStep(step),
      () => {
        batchPreviewActiveRef.current = false
        setBatchPreviewPlaying(false)
        setBatchPreviewStep(0)
      },
    ).catch((error: unknown) => {
      batchPreviewActiveRef.current = false
      setBatchPreviewPlaying(false)
      setBatchPreviewStep(0)
      showToast(
        messageFromError(error, 'The preview could not start. Press Play all 10 again.'),
        'error',
      )
    })
  }, [
    activePreset.model,
    batchGapMs,
    humanize,
    params,
    playSequence,
    seed,
    showToast,
    stop,
    stopBatchPreview,
  ])

  const handleSurprise = useCallback(() => {
    draftsRef.current[activePresetId] = { params, seed, take }
    const nextSeed = createSeed()
    const rng = createRng(nextSeed)
    const preset = PRESETS[Math.floor(rng() * PRESETS.length)] ?? PRESETS[0]
    const nextParams = jitterParameters(clonePresetDefaults(preset), 0.15, rng)

    dismissToast()
    setActivePresetId(preset.id)
    setParams(nextParams)
    setSeed(nextSeed)
    setTake(1)
    audition(preset, nextParams, nextSeed)
    showToast(`Surprise: ${preset.name}.`)
  }, [activePresetId, audition, dismissToast, params, seed, showToast, take])

  const handleMutate = useCallback(() => {
    const next = mutateParameters(params, humanize, createRng(createSeed()))
    setParams(next.params)
    setHumanize(next.humanize)
    audition(activePreset, next.params, seed)
  }, [activePreset, audition, humanize, params, seed])

  const handleReset = useCallback(() => {
    const nextParams = clonePresetDefaults(activePreset)
    setParams(nextParams)
    audition(activePreset, nextParams, seed)
    showToast('Sliders reset to the preset defaults.')
  }, [activePreset, audition, seed, showToast])

  const trigger = useCallback(() => {
    stopBatchPreview()
    setTriggerNonce((value) => value + 1)
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
    } catch {
      // Haptics are optional and unavailable on most desktop browsers.
    }
    void play(sound).catch((error: unknown) => {
      showToast(messageFromError(error, 'The sound could not start. Press Play again.'), 'error')
    })
  }, [play, showToast, sound, stopBatchPreview])

  // Spacebar is the performance key. Ignore editable fields, let the trigger
  // button use its native space activation, and prevent the page from scrolling.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        helpOpen ||
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
  }, [helpOpen, trigger])

  const handleExportSingle = useCallback(() => {
    if (exportBusyRef.current) return
    stopBatchPreview()
    exportBusyRef.current = true
    setExportKind('single')
    const presetSnapshot = activePreset
    const soundSnapshot = sound
    try {
      const { blob, filename } = singleWavFor(presetSnapshot, soundSnapshot)
      downloadBlob(blob, filename)
      showToast(`Saved ${filename}.`)
    } catch (error) {
      showToast(messageFromError(error, 'The WAV file could not be made.'), 'error')
    } finally {
      setExportKind(null)
      exportBusyRef.current = false
    }
  }, [activePreset, showToast, sound, stopBatchPreview])

  const handleExportBatch = useCallback(async () => {
    if (exportBusyRef.current) return
    stopBatchPreview()
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
      showToast(`Saved 10 sounds in ${result.filename}.`)
    } catch (error) {
      showToast(messageFromError(error, 'The ZIP file could not be made.'), 'error')
    } finally {
      exportBusyRef.current = false
      setExportKind(null)
      setBatchProgress(0)
    }
  }, [activePreset, humanize, params, seed, showToast, stopBatchPreview])

  return (
    <div
      className="app-root"
      data-audio-state={status}
      data-playing={isPlaying ? 'true' : 'false'}
      data-export-state={exportKind ?? 'idle'}
    >
      <div className="app-atmosphere" aria-hidden="true" />
      <div className="app-shell">
        <Header
          engineStatus={status}
          isPlaying={isPlaying}
          helpOpen={helpOpen}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <main className="app-main">
          <PresetBank
            activePreset={activePreset}
            modified={modified}
            onSelectCategory={chooseCategory}
            onSelectPreset={choosePreset}
            onSurprise={handleSurprise}
            onMutate={handleMutate}
            take={take}
          />

          {status === 'unsupported' ? (
            <div className="engine-warning" role="status">
              <span className="engine-warning-icon" aria-hidden="true">
                <AlertIcon />
              </span>
              <span>
                Sound could not start in this browser. You can still change the sound
                and download the files. Try pressing Play again, or check that sound is
                allowed for this page.
              </span>
            </div>
          ) : null}

          <div className="workbench">
            <ParameterPanel
              params={params}
              humanize={humanize}
              modified={modified}
              onParamChange={handleParamChange}
              onHumanizeChange={handleHumanizeChange}
              onReset={handleReset}
            />
            <PerformancePanel
              preset={activePreset}
              sound={sound}
              modified={modified}
              isPlaying={isPlaying}
              triggerNonce={triggerNonce}
              getWaveform={getWaveform}
              onTrigger={trigger}
              take={take}
            />
          </div>

          <ExportDock
            exportKind={exportKind}
            batchProgress={batchProgress}
            humanize={humanize}
            batchPreviewPlaying={batchPreviewPlaying}
            batchPreviewStep={batchPreviewStep}
            batchGapMs={batchGapMs}
            onBatchGapChange={handleBatchGapChange}
            onToggleBatchPreview={handleToggleBatchPreview}
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
            Every sound is made inside your browser. Nothing is uploaded.
          </p>
          <p className="footer-made">
            Made for games
            <span aria-hidden="true">·</span>
            {getCategory(activeCategory).label}
          </p>
        </footer>
      </div>

      <HelpDialog open={helpOpen} onClose={closeHelp} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
