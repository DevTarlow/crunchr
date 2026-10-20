import type { CSSProperties } from 'react'
import { PlayIcon, StopIcon } from './Icons'

export const BATCH_PREVIEW_COUNT = 10
export const BATCH_GAP_DEFAULT = 120
export const BATCH_GAP_MAX = 600
export const BATCH_GAP_STEP = 20

interface BatchPreviewProps {
  playing: boolean
  step: number
  gapMs: number
  disabled: boolean
  onGapChange: (value: number) => void
  onToggle: () => void
}

export function BatchPreview({
  playing,
  step,
  gapMs,
  disabled,
  onGapChange,
  onToggle,
}: BatchPreviewProps) {
  const fillPercent = (gapMs / BATCH_GAP_MAX) * 100
  const style = { '--range-fill': `${fillPercent}%` } as CSSProperties

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
            <span id="batch-preview-title">Preview</span>
            <span className="batch-preview-count">
              {playing
                ? `Version ${step} of ${BATCH_PREVIEW_COUNT}`
                : `${BATCH_PREVIEW_COUNT} versions`}
            </span>
          </div>
          <div className="batch-preview-dots" aria-hidden="true">
            {Array.from({ length: BATCH_PREVIEW_COUNT }, (_, index) => {
              const done = index < step - 1
              const current = index === step - 1
              return (
                <span
                  key={index}
                  className={`batch-preview-dot ${done ? 'is-done' : ''} ${
                    current ? 'is-current' : ''
                  }`}
                />
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
            onChange={(event) => onGapChange(Number(event.target.value))}
          />
          <div className="batch-preview-scale" aria-hidden="true">
            <span>Together</span>
            <span>Spaced out</span>
          </div>
        </div>
      </div>

      <p className="batch-preview-note">
        This is just a preview. Your download has 10 separate sounds, so your game sets
        the spacing.
      </p>
    </section>
  )
}
