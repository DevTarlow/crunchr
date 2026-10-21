import type { EngineStatus } from '../audio/types'
import { CrunchMark, InfoIcon } from './Icons'

interface HeaderProps {
  engineStatus: EngineStatus
  isPlaying: boolean
  helpOpen: boolean
  onOpenHelp: () => void
}

const STATUS_LABEL: Record<EngineStatus, string> = {
  standby: 'Tap to start',
  armed: 'Ready',
  unsupported: 'Not available',
}

export function Header({ engineStatus, isPlaying, helpOpen, onOpenHelp }: HeaderProps) {
  const live = engineStatus === 'armed'
  const statusLabel = isPlaying && live ? 'Playing' : STATUS_LABEL[engineStatus]

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <CrunchMark />
        </div>
        <div className="brand-copy">
          <div className="eyebrow">
            <span className="eyebrow-square" aria-hidden="true" />
            Tiny sounds for games
          </div>
          <h1 className="wordmark">
            CRUNCHR<span className="wordmark-dot">.</span>
          </h1>
        </div>
      </div>

      <div className="header-actions">
        <div className="header-instruments" role="group" aria-label="Sound status">
          <div className="status-module">
            <div className="status-line">
              <span
                className={`status-led ${engineStatus} ${isPlaying ? 'playing' : ''}`}
                aria-hidden="true"
              />
              <span className="micro-label">Sound</span>
            </div>
            <strong className="status-value">{statusLabel}</strong>
          </div>
          <div className="status-divider" aria-hidden="true" />
          <div className="spec-module">
            <span className="micro-label">Files</span>
            <span className="spec-value">WAV + MP3</span>
          </div>
        </div>

        <button
          type="button"
          className="help-button"
          onClick={onOpenHelp}
          aria-label="How to use Crunchr"
          aria-haspopup="dialog"
          aria-expanded={helpOpen}
          title="How to use Crunchr"
        >
          <InfoIcon className="help-button-icon" />
          <span className="help-button-label">Help</span>
        </button>
      </div>
    </header>
  )
}
