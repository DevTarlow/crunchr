import type { Preset, RenderedSound } from '../audio/types'
import { getCategory } from '../audio/presets'
import { ScopeCanvas } from './ScopeCanvas'
import { TriggerIcon } from './Icons'

interface PerformancePanelProps {
  preset: Preset
  sound: RenderedSound
  modified: boolean
  isPlaying: boolean
  triggerNonce: number
  take: number
  getWaveform: () => Float32Array | null
  onTrigger: () => void
}

export function PerformancePanel({
  preset,
  sound,
  modified,
  isPlaying,
  triggerNonce,
  take,
  getWaveform,
  onTrigger,
}: PerformancePanelProps) {
  const category = getCategory(preset.category)

  return (
    <section className="panel performance-panel" aria-labelledby="performance-title">
      <div className="panel-head performance-head">
        <div className="section-heading">
          <span className="section-index">03</span>
          <div>
            <div className="section-kicker">Listen</div>
            <h2 id="performance-title" className="section-title">
              Hear the sound<span className="title-dot">.</span>
            </h2>
          </div>
        </div>
        <span className="model-badge">{category.label}</span>
      </div>

      <div className="preset-identity">
        <div className="preset-title-row">
          <h3>{preset.name}</h3>
          {modified ? <span className="modified-label">Changed</span> : null}
        </div>
        <p>{preset.description}</p>
        <div className="preset-tags">
          {preset.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>

      <ScopeCanvas
        sound={sound}
        isPlaying={isPlaying}
        triggerNonce={triggerNonce}
        getWaveform={getWaveform}
        onTrigger={onTrigger}
        presetName={preset.name}
      />

      <div className="trigger-zone">
        <button
          type="button"
          className="trigger-button"
          onClick={onTrigger}
          aria-label={`Play ${preset.name}`}
          aria-keyshortcuts="Space"
        >
          <span className="trigger-icon-wrap" aria-hidden="true">
            <TriggerIcon />
          </span>
          <span className="trigger-copy">
            <strong>PLAY</strong>
            <span>{isPlaying ? 'PLAYING' : 'HEAR THE SOUND'}</span>
          </span>
          <span className="keycap" aria-hidden="true">
            SPACE
          </span>
          {triggerNonce > 0 ? (
            <span key={triggerNonce} className="trigger-flash" aria-hidden="true" />
          ) : null}
        </button>
        <div className="trigger-meta">
          <span>
            Click the sound wave or press <kbd>space</kbd> to play
          </span>
          <span className="version-readout">Version {String(take).padStart(2, '0')}</span>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {isPlaying ? `Playing ${preset.name}` : 'Ready to play'}
      </span>
    </section>
  )
}
