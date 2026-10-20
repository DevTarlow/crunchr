import type { EngineStatus } from '../audio/types'
import { CrunchMark } from './Icons'

interface HeaderProps {
  engineStatus: EngineStatus
  isPlaying: boolean
}

const STATUS_LABEL: Record<EngineStatus, string> = {
  standby: 'Standby',
  armed: 'Armed',
  unsupported: 'Unavailable',
}

export function Header({ engineStatus, isPlaying }: HeaderProps) {
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
            Tactile Micro-SFX &amp; Foley Generator
          </div>
          <h1 className="wordmark">
            CRUNCHR<span className="wordmark-dot">.</span>
          </h1>
        </div>
      </div>

      <div className="header-instruments" aria-label="Instrument status">
        <div className="status-module">
          <div className="status-line">
            <span
              className={`status-led ${engineStatus} ${isPlaying ? 'playing' : ''}`}
              aria-hidden="true"
            />
            <span className="micro-label">Audio engine</span>
          </div>
          <strong className="status-value">{statusLabel}</strong>
        </div>
        <div className="status-divider" aria-hidden="true" />
        <div className="spec-module">
          <span className="micro-label">Output</span>
          <span className="spec-value">44.1 kHz / 16-bit / Stereo</span>
        </div>
      </div>
    </header>
  )
}
