import type { Preset, RenderedSound } from '../audio/types'
import { getCategory } from '../audio/presets'
import { formatSeed } from '../lib/format'
import { ScopeCanvas } from './ScopeCanvas'
import { TriggerIcon } from './Icons'

interface PerformancePanelProps {
  preset: Preset
  sound: RenderedSound
  seed: number
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
  seed,
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
            <div className="section-kicker">Game feel</div>
            <h2 id="performance-title" className="section-title">
              Audition the take<span className="title-dot">.</span>
            </h2>
          </div>
        </div>
        <span className="model-badge">{category.label}</span>
      </div>

      <div className="preset-identity">
        <div className="preset-title-row">
          <h3>{preset.name}</h3>
          {modified ? <span className="modified-label">MODIFIED TAKE</span> : null}
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
          aria-label={`Trigger ${preset.name}`}
          aria-keyshortcuts="Space"
        >
          <span className="trigger-icon-wrap" aria-hidden="true">
            <TriggerIcon />
          </span>
          <span className="trigger-copy">
            <strong>TRIGGER</strong>
            <span>{isPlaying ? 'VOICE ACTIVE' : 'PLAY THE CRUNCH'}</span>
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
            Click the scope or hit <kbd>space</kbd> to audition
          </span>
          <span className="take-meta">
            <span className="take-readout">Take {String(take).padStart(2, '0')}</span>
            <span className="seed-readout">Seed {formatSeed(seed)}</span>
          </span>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {isPlaying ? `Playing ${preset.name}` : 'Ready to trigger'}
      </span>
    </section>
  )
}
