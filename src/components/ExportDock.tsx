import { useId } from 'react'
import type { ExportFormat } from '../audio/types'
import { MP3_BITRATE } from '../audio/types'
import { formatBytes } from '../lib/format'
import { ArchiveIcon, DownloadIcon } from './Icons'
import { BatchPreview } from './BatchPreview'

export type ExportKind = 'single' | 'batch' | 'version'

interface ExportDockProps {
  exportKind: ExportKind | null
  exportFormat: ExportFormat
  batchProgress: number
  humanize: number
  batchPreviewPlaying: boolean
  batchPreviewStep: number
  selectedVariation: number | null
  batchGapMs: number
  singleDurationMs: number
  singleWavBytes: number
  singleFilename: string
  batchFilename: string
  onFormatChange: (format: ExportFormat) => void
  onBatchGapChange: (value: number) => void
  onToggleBatchPreview: () => void
  onAuditionVariation: (index: number) => void
  onExportVariation: (index: number) => void
  onExportSingle: () => void
  onExportBatch: () => void
}

export function ExportDock({
  exportKind,
  exportFormat,
  batchProgress,
  humanize,
  batchPreviewPlaying,
  batchPreviewStep,
  selectedVariation,
  batchGapMs,
  singleDurationMs,
  singleWavBytes,
  singleFilename,
  batchFilename,
  onFormatChange,
  onBatchGapChange,
  onToggleBatchPreview,
  onAuditionVariation,
  onExportVariation,
  onExportSingle,
  onExportBatch,
}: ExportDockProps) {
  const busy = exportKind !== null
  const packing = exportKind === 'batch'
  const savingSingle = exportKind === 'single'
  const formatLabel = exportFormat === 'wav' ? 'WAV' : 'MP3'
  const hintId = useId()
  const duration = Math.round(singleDurationMs)
  const singleMeta =
    exportFormat === 'wav'
      ? `${duration} ms · ${formatBytes(singleWavBytes)}`
      : `${duration} ms · ${MP3_BITRATE} kbps`

  return (
    <section className="panel export-dock" aria-labelledby="export-title">
      <div className="export-head">
        <div className="export-copy">
          <div className="section-heading">
            <span className="section-index">04</span>
            <div>
              <div className="section-kicker">Save</div>
              <h2 id="export-title" className="section-title">
                Save your sounds<span className="title-dot">.</span>
              </h2>
            </div>
          </div>
          <p>
            Two separate downloads. <strong>One sound</strong> is exactly what you hear now.{' '}
            <strong>10 versions</strong> are small changes for sounds that should not repeat.
          </p>
          <div className="export-specs" aria-label="Download formats">
            <span>WAV · 16-bit</span>
            <span>MP3 · {MP3_BITRATE} kbps</span>
            <span>44.1 kHz</span>
            <span>Stereo</span>
            <span>Stays on your device</span>
          </div>
        </div>

        <fieldset className="export-format" disabled={busy} aria-describedby={hintId}>
          <legend>Download format</legend>
          <div className="export-format-options">
            <label
              className={`export-format-option ${exportFormat === 'wav' ? 'is-selected' : ''}`}
            >
              <input
                type="radio"
                name="export-format"
                value="wav"
                checked={exportFormat === 'wav'}
                onChange={() => onFormatChange('wav')}
              />
              <span className="export-format-name">WAV</span>
              <span className="export-format-note">Lossless · 16-bit</span>
            </label>
            <label
              className={`export-format-option ${exportFormat === 'mp3' ? 'is-selected' : ''}`}
            >
              <input
                type="radio"
                name="export-format"
                value="mp3"
                checked={exportFormat === 'mp3'}
                onChange={() => onFormatChange('mp3')}
              />
              <span className="export-format-name">MP3</span>
              <span className="export-format-note">Small · {MP3_BITRATE} kbps</span>
            </label>
          </div>
          <p id={hintId} className="export-format-hint">
            {exportFormat === 'wav'
              ? 'Lossless and frame-accurate. Best for games.'
              : 'Plays on anything and is much smaller. Adds a tiny delay at the start.'}
          </p>
        </fieldset>
      </div>

      <div className="export-groups">
        <section
          className="export-card export-single-card"
          aria-labelledby="single-sound-title"
        >
          <div className="export-card-head">
            <span className="export-card-kicker">One sound</span>
            <h3 id="single-sound-title">The sound on your sliders</h3>
            <p>Exactly what you hear now. Press Play above to audition it.</p>
          </div>

          <div className="export-card-action">
            <button
              type="button"
              className="export-button export-single"
              onClick={onExportSingle}
              disabled={busy}
              aria-busy={savingSingle}
            >
              <span className="export-icon">
                <DownloadIcon />
              </span>
              <span className="export-button-copy">
                <strong>{savingSingle ? 'SAVING…' : `DOWNLOAD ${formatLabel}`}</strong>
                <span>{singleMeta}</span>
              </span>
              <span className="export-extension">.{formatLabel}</span>
            </button>
          </div>

          <p className="export-filename">
            File: <code>{singleFilename}</code>
          </p>
        </section>

        <section
          className="export-card export-batch-card"
          aria-labelledby="ten-versions-title"
        >
          <div className="export-card-head">
            <span className="export-card-kicker">10 versions</span>
            <h3 id="ten-versions-title">Ten small changes in one ZIP</h3>
            <p>
              For footsteps and clicks that should not repeat. The preview below is only
              for these ten.
            </p>
          </div>

          <div className="export-card-action">
            <button
              type="button"
              className="export-button export-batch"
              onClick={onExportBatch}
              disabled={busy}
              aria-busy={packing}
            >
              <span className="export-icon">
                <ArchiveIcon />
              </span>
              <span className="export-button-copy">
                <strong>
                  {packing
                    ? `MAKING ${batchProgress}/10…`
                    : exportFormat === 'wav'
                      ? 'DOWNLOAD 10 WAVS'
                      : 'DOWNLOAD 10 MP3S'}
                </strong>
                <span>10 files · ZIP · {formatLabel}</span>
              </span>
              <span className="export-extension">{formatLabel}</span>
            </button>
          </div>

          <p className="export-filename">
            File: <code>{batchFilename}</code> · ten files, v01–v10
          </p>

          <BatchPreview
            playing={batchPreviewPlaying}
            step={batchPreviewStep}
            selected={selectedVariation}
            gapMs={batchGapMs}
            exportFormat={exportFormat}
            disabled={busy}
            saving={exportKind === 'version'}
            onGapChange={onBatchGapChange}
            onToggle={onToggleBatchPreview}
            onAudition={onAuditionVariation}
            onSave={onExportVariation}
          />
        </section>
      </div>

      <div className="export-foot">
        <span>
          <span className="tiny-led batch-led" aria-hidden="true" />
          Variation {Math.round(humanize)}%
        </span>
        <span>Settings stay in this browser. Nothing is uploaded.</span>
      </div>
    </section>
  )
}
