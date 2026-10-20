import { ArchiveIcon, DownloadIcon } from './Icons'

export type ExportKind = 'single' | 'batch'

interface ExportDockProps {
  exportKind: ExportKind | null
  batchProgress: number
  humanize: number
  onExportSingle: () => void
  onExportBatch: () => void
}

export function ExportDock({
  exportKind,
  batchProgress,
  humanize,
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
            <div className="section-kicker">Output</div>
            <h2 id="export-title" className="section-title">
              Bake it into the game<span className="title-dot">.</span>
            </h2>
          </div>
        </div>
        <p>
          Save the exact take you just heard, or export ten seeded variations for
          footsteps and clicks that never repeat mechanically.
        </p>
        <div className="export-specs" aria-label="Export format">
          <span>44.1 kHz</span>
          <span>16-bit PCM</span>
          <span>Stereo</span>
          <span>Local only</span>
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
            <strong>{exportKind === 'single' ? 'ENCODING…' : 'EXPORT .WAV'}</strong>
            <span>One take · current seed</span>
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
            <strong>{packing ? `PACKING ${batchProgress}/10…` : 'BATCH VARIATIONS'}</strong>
            <span>10 humanized takes · ZIP archive</span>
          </span>
          <span className="export-extension">{packing ? '10×' : '10× ZIP'}</span>
        </button>
      </div>

      <div className="export-foot">
        <span>
          <span className="tiny-led batch-led" aria-hidden="true" />
          Batch drift {Math.round(humanize)}%
        </span>
        <span>Runs entirely in your browser</span>
      </div>
    </section>
  )
}
