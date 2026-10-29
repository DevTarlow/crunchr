import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, WheelEvent } from 'react'
import { clamp, roundTo } from '../audio/params'
import { formatInputValue, parseInputValue } from '../lib/format'

interface NumberFieldProps {
  id: string
  label: string
  value: number
  valueText: string
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
  describedBy?: string
  onValueChange: (value: number) => void
}

const UNIT_NAMES: Record<string, string> = {
  ms: 'milliseconds',
  Hz: 'hertz',
  '%': 'percent',
}

/**
 * Editable readout that sits beside a slider. It is a text input on purpose:
 * a controlled `type="number"` field drops the trailing dot while a decimal is
 * being typed, which would break values such as a 0.1-step Body.
 *
 * A valid in-range value is committed as soon as it is typed; junk and
 * out-of-range values wait for Enter or blur, where they are clamped or
 * reverted. Focusing and leaving the field without editing it never re-rounds
 * a value that the slider produced.
 */
export function NumberField({
  id,
  label,
  value,
  valueText,
  min,
  max,
  step,
  unit,
  disabled = false,
  describedBy,
  onValueChange,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => formatInputValue(value, step))
  const inputRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)
  const unitName = unit ? UNIT_NAMES[unit] : undefined

  // Keep the box in step with the slider, preset switches, Reset and Nudge,
  // but never overwrite text that is currently being edited.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setDraft(formatInputValue(value, step))
    dirtyRef.current = false
  }, [value, step])

  const commit = (raw: string) => {
    if (!dirtyRef.current) {
      setDraft(formatInputValue(value, step))
      return
    }
    const parsed = parseInputValue(raw, min, max, step)
    if (parsed !== null) onValueChange(parsed)
    setDraft(formatInputValue(parsed ?? value, step))
    dirtyRef.current = false
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    setDraft(raw)
    dirtyRef.current = true
    const parsed = parseInputValue(raw, min, max, step)
    if (parsed !== null) onValueChange(parsed)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(event.currentTarget.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(formatInputValue(value, step))
      dirtyRef.current = false
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const base = parseInputValue(event.currentTarget.value, min, max, step) ?? value
      const amount = step * (event.shiftKey ? 10 : 1)
      const next = clamp(
        roundTo(base + (event.key === 'ArrowUp' ? amount : -amount), step),
        min,
        max,
      )
      onValueChange(next)
      setDraft(formatInputValue(next, step))
      dirtyRef.current = false
    }
  }

  // Scrolling over a focused spinbutton should scroll the page, not silently
  // rewrite the sound.
  const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
    if (document.activeElement === event.currentTarget) event.currentTarget.blur()
  }

  return (
    <span className="param-value">
      <input
        ref={inputRef}
        id={id}
        className="param-readout param-number"
        type="text"
        role="spinbutton"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        value={draft}
        disabled={disabled}
        aria-label={unitName ? `${label} in ${unitName}` : `${label} value`}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={valueText}
        aria-describedby={describedBy}
        onChange={handleChange}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
      />
      {unit ? (
        <span className="param-unit" aria-hidden="true">
          {unit}
        </span>
      ) : null}
    </span>
  )
}
