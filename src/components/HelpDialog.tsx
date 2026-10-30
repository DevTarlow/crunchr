import { useEffect, useId, useRef } from 'react'
import { CloseIcon, RerollIcon } from './Icons'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    title: 'Pick a sound.',
    body: 'There are five groups at the top: clicks, footsteps, items, crunches and magic. Click a sound to load it and hear it right away. The picture shows the shape of the sound.',
  },
  {
    title: 'Click it again for a new version.',
    body: 'Click it again for a new version with random changes. Your sliders stay put; Reset in Shape restores the preset starting point.',
    reroll: true,
  },
  {
    title: 'Play it.',
    body: 'Click the big gold Play button, or press Space. Click the sound wave to play it again. Point at the sound wave to see the time and loudness at that spot.',
  },
  {
    title: 'Shape it.',
    body: 'Six sliders shape the sound as you drag, or type an exact value in the box beside each slider. Nudge 10% moves all six; Surprise me picks a random sound. Reset restores the preset defaults.',
  },
  {
    title: 'Listen to 10 versions.',
    body: 'The Variation slider (or its value box) changes each of the 10 downloaded sounds. Play all 10 hears them in a row; click a number to hear one, then Save vNN to download it. This preview is only for the ten versions; the single sound is in the One sound card. The spacing is only a preview; your game sets it for the ten files.',
  },
  {
    title: 'Download it.',
    body: 'Choose WAV or MP3 at the top of Save. WAV is lossless and best for games; MP3 is smaller and plays on anything, with a tiny delay at the start. Download one sound saves the sound on your sliders. Download 10 versions gives you a ZIP with ten separate files in the same format; Save vNN saves just one of those ten.',
  },
]

const KEYS = [
  { key: 'Space', action: 'Play the sound' },
  { key: 'Enter', action: 'Press the selected button' },
  { key: '← →', action: 'Change a slider' },
  { key: '↑ ↓', action: 'Step a typed value' },
  { key: 'Esc', action: 'Close this window' },
]

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const previousPadding = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPadding
      previouslyFocused?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="help-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="help-head">
          <div className="help-heading">
            <span className="help-kicker">How to use Crunchr</span>
            <h2 id={titleId}>
              Make your first sound<span className="title-dot">.</span>
            </h2>
            <p id={descriptionId}>
              Crunchr makes small sounds for games. Everything is made in your browser.
              Nothing is uploaded, and you don't need an account. Your browser needs one tap
              before it can play sound, so press any button to start. Then pick a sound
              to hear it, change it, and download it.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="help-close"
            onClick={onClose}
            aria-label="Close help"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="help-body">
          <ol className="help-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className={step.reroll ? 'is-reroll' : ''}>
                <span className="help-step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="help-step-copy">
                  <h3>
                    {step.title}
                    {step.reroll ? (
                      <span className="help-step-icon" aria-hidden="true">
                        <RerollIcon />
                      </span>
                    ) : null}
                  </h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="help-keys-block" aria-labelledby="help-keys-title">
            <h3 id="help-keys-title">Keyboard shortcuts</h3>
            <dl className="help-keys">
              {KEYS.map((item) => (
                <div key={item.key}>
                  <dt>
                    <kbd>{item.key}</kbd>
                  </dt>
                  <dd>{item.action}</dd>
                </div>
              ))}
            </dl>
            <p className="help-keys-note">
              Space plays from the sound area. On a focused button it presses that
              button instead; Enter always does.
            </p>
          </section>
        </div>

        <div className="help-foot">
          <p>That's everything. Go make your game sound better.</p>
          <button type="button" className="help-cta" onClick={onClose}>
            Back to the sounds
          </button>
        </div>
      </div>
    </div>
  )
}
