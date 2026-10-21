import type { CSSProperties } from 'react'
import type { ExportFormat } from '../audio/types'
import { BATCH_GAP_MAX, BATCH_GAP_STEP, BATCH_PREVIEW_COUNT } from '../audio/params'
import { PlayIcon, StopIcon } from './Icons'

interface BatchPreviewProps {
  playing: boolean
  step: number
  selected: number | null
  gapMs: number
  exportFormat: ExportFormat
  disabled: boolean
  saving: boolean
  onGapChange: (value: number) => void
  onToggle: () => void
  onAudition: (index: number) => void
  onSave: (index: number) => void
}

function versionLabel(index: number): string {
  return String(index).padStart(2, '0')
}

export function BatchPreview({
  playing,
  step,
  selected,
  gapMs,
  exportFormat,
  disabled,
  saving,
  onGapChange,
  onToggle,
  onAudition,
  onSave,
}: BatchPreviewProps) {
  const fillPercent = (gapMs / BATCH_GAP_MAX) * 100
  const style = { '--range-fill': `${fillPercent}%` } as CSSProperties
  const selectedLabel = selected === null ? null : versionLabel(selected)
  const formatLabel = exportFormat === 'wav' ? 'WAV' : 'MP3'
  const formatArticle = exportFormat === 'mp3' ? 'an' : 'a'

  return (
    <section className="batch-preview" aria-labelledby="batch-preview-title">
      <div className="batch-preview-top">
        <button
          type="button"
          className="button batch-preview-button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={playing}
          aria-label={playing ? 'Stop preview' : `Play all ${BATCH_PREVIEW_COUNT} versions`}
        >
          {playing ? (
            <StopIcon className="button-icon" />
          ) : (
            <PlayIcon className="button-icon" />
          )}
          <span>{playing ? 'Stop' : `Play all ${BATCH_PREVIEW_COUNT}`}</span>
        </button>

        <div className="batch-preview-meter">
          <div className="batch-preview-meter-head">
            <span id="batch-preview-title">10-version preview</span>
            <span className="batch-preview-count">
              {playing
                ? `Version ${step} of ${BATCH_PREVIEW_COUNT}`
                : selectedLabel
                  ? `Version ${selectedLabel} selected`
                  : `${BATCH_PREVIEW_COUNT} versions`}
            </span>
          </div>
          <div className="batch-preview-dots" role="group" aria-label="Preview versions">
            {Array.from({ length: BATCH_PREVIEW_COUNT }, (_, zeroBasedIndex) => {
              const index = zeroBasedIndex + 1
              const done = playing && index < step
              const current = playing ? index === step : selected === index
              return (
                <button
                  key={index}
                  type="button"
                  className={`batch-preview-dot ${done ? 'is-done' : ''} ${
                    current ? 'is-current' : ''
                  }`}
                  aria-label={`Play version ${index} of ${BATCH_PREVIEW_COUNT}`}
                  aria-pressed={selected === index}
                  title={`Play version ${index}`}
                  disabled={disabled}
                  onClick={() => onAudition(index)}
                >
                  <span className="batch-preview-dot-number" aria-hidden="true">
                    {versionLabel(index)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="batch-preview-gap">
          <div className="batch-preview-gap-head">
            <label htmlFor="batch-gap">Space between sounds</label>
            <output htmlFor="batch-gap">{gapMs} ms</output>
          </div>
          <input
            id="batch-gap"
            className="preview-range"
            type="range"
            min={0}
            max={BATCH_GAP_MAX}
            step={BATCH_GAP_STEP}
            value={gapMs}
            disabled={disabled}
            style={style}
            aria-valuetext={`${gapMs} milliseconds`}
            onChange={(event) => onGapChange(Number(event.target.value))}
          />
          <div className="batch-preview-scale" aria-hidden="true">
            <span>Together</span>
            <span>Spaced out</span>
          </div>
        </div>
      </div>

      <div className="batch-preview-foot">
        <p className="batch-preview-note">
          Click a number to hear one version. The ZIP still has 10 separate {formatLabel}{' '}
          files, so your game sets the spacing.
        </p>
        {selected !== null ? (
          <button
            type="button"
            className="batch-save-button"
            onClick={() => onSave(selected)}
            disabled={disabled}
            aria-busy={saving}
            aria-label={`Save version ${selected} as ${formatArticle} ${formatLabel} file`}
            title={`Save this version as ${formatArticle} ${formatLabel} file`}
          >
            {saving ? `Saving v${selectedLabel}…` : `Save v${selectedLabel} ${formatLabel}`}
          </button>
        ) : null}
      </div>
    </section>
  )
}
