import { ArchiveIcon, DownloadIcon } from './Icons'
import { BatchPreview } from './BatchPreview'

export type ExportKind = 'single' | 'batch'

interface ExportDockProps {
  exportKind: ExportKind | null
  batchProgress: number
  humanize: number
  batchPreviewPlaying: boolean
  batchPreviewStep: number
  batchGapMs: number
  onBatchGapChange: (value: number) => void
  onToggleBatchPreview: () => void
  onExportSingle: () => void
  onExportBatch: () => void
}

export function ExportDock({
  exportKind,
  batchProgress,
  humanize,
  batchPreviewPlaying,
  batchPreviewStep,
  batchGapMs,
  onBatchGapChange,
  onToggleBatchPreview,
  onExportSingle,
  onExportBatch,
}: ExportDockProps) {
  const busy = exportKind !== null
  const packing = exportKind === 'batch'

  return (
    <section className="panel export-dock" aria-labelledby="export-title">
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
          Download the sound you just heard, or 10 versions with small changes. They are
          handy for footsteps and clicks that should not repeat the same way.
        </p>
        <div className="export-specs" aria-label="Download format">
          <span>WAV</span>
          <span>Stereo</span>
          <span>Stays on your device</span>
        </div>
      </div>

      <div className="export-actions">
        <button
          type="button"
          className="export-button export-single"
          onClick={onExportSingle}
          disabled={busy}
          aria-busy={exportKind === 'single'}
        >
          <span className="export-icon">
            <DownloadIcon />
          </span>
          <span className="export-button-copy">
            <strong>{exportKind === 'single' ? 'SAVING…' : 'DOWNLOAD WAV'}</strong>
            <span>The sound you just heard</span>
          </span>
          <span className="export-extension">.WAV</span>
        </button>

        <button
          type="button"
          className="export-button export-batch"
          onClick={onExportBatch}
          disabled={busy}
          aria-busy={exportKind === 'batch'}
        >
          <span className="export-icon">
            <ArchiveIcon />
          </span>
          <span className="export-button-copy">
            <strong>
              {packing ? `MAKING ${batchProgress}/10…` : 'DOWNLOAD 10 VERSIONS'}
            </strong>
            <span>10 small changes · ZIP file</span>
          </span>
          <span className="export-extension">{packing ? '10×' : 'ZIP'}</span>
        </button>
      </div>

      <BatchPreview
        playing={batchPreviewPlaying}
        step={batchPreviewStep}
        gapMs={batchGapMs}
        disabled={busy}
        onGapChange={onBatchGapChange}
        onToggle={onToggleBatchPreview}
      />

      <div className="export-foot">
        <span>
          <span className="tiny-led batch-led" aria-hidden="true" />
          Variation {Math.round(humanize)}%
        </span>
        <span>Works in your browser. Nothing is uploaded.</span>
      </div>
    </section>
  )
}
