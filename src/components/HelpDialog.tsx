import { useEffect, useId, useRef } from 'react'
import { CloseIcon, RerollIcon } from './Icons'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    title: 'Pick a material.',
    body: 'Four banks sit at the top: UI clicks, footsteps, foley and impacts. Tap a chip and the sound loads into the scope, ready to play.',
  },
  {
    title: 'Tap it again for a new take.',
    body: 'The active chip is still live. A second tap rolls a fresh random seed and puts the sliders back to the preset, so the coin rings a little differently and the gravel scatters another way. The take counter and seed under the trigger keep score.',
    reroll: true,
  },
  {
    title: 'Trigger it.',
    body: 'Hit the big orange button or press Space from anywhere on the page. Click the scope to replay. Hover the scope to read the exact time and amplitude under your cursor.',
  },
  {
    title: 'Shape the sound.',
    body: 'Six sliders control length, pitch, punch, body, grit and decay. They update the sound as you drag. Mutate ±10% nudges all six at once. Surprise me jumps to a random material with a new seed.',
  },
  {
    title: 'Humanize the batch.',
    body: 'Humanize only changes the ZIP export. It drifts timing, pitch and texture across all 10 takes, so a row of footsteps does not sound like a metronome. At 0% the sliders stay put. Every take still gets its own noise.',
  },
  {
    title: 'Take it with you.',
    body: 'Export .WAV saves the exact take you just heard. Batch Variations packs 10 humanized takes into a ZIP. They are 44.1 kHz, 16-bit stereo, and they build on your machine.',
  },
]

const KEYS = [
  { key: 'Space', action: 'Play the current material' },
  { key: 'Enter', action: 'Press the focused button' },
  { key: '← →', action: 'Nudge a focused slider' },
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
              Make something that crunches<span className="title-dot">.</span>
            </h2>
            <p id={descriptionId}>
              Crunchr builds tiny game sounds from math, right here in your browser. There
              are no samples and no account. Nothing leaves the page. Browsers need a tap
              before sound can start, so the first click arms the engine. Pick a material,
              shape it, then take the WAV.
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
            <h3 id="help-keys-title">Keyboard, if you like keys</h3>
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
          </section>
        </div>

        <div className="help-foot">
          <p>That is the whole app. Go make your game sound better.</p>
          <button type="button" className="help-cta" onClick={onClose}>
            Back to the sounds
          </button>
        </div>
      </div>
    </div>
  )
}
