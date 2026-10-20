import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import { positionToValue, valueToPosition } from '../audio/params'

interface HardwareSliderProps {
  id: string
  label: string
  helper: string
  min: number
  max: number
  step: number
  log: boolean
  value: number
  valueLabel: string
  minLabel: string
  maxLabel: string
  onChange: (value: number) => void
  badge?: ReactNode
  variant?: 'standard' | 'batch'
}

export function HardwareSlider({
  id,
  label,
  helper,
  min,
  max,
  step,
  log,
  value,
  valueLabel,
  minLabel,
  maxLabel,
  onChange,
  badge,
  variant = 'standard',
}: HardwareSliderProps) {
  const steps = log ? 1000 : Math.max(1, Math.round((max - min) / step))
  const rawPosition = log
    ? valueToPosition(value, min, max, true)
    : ((value - min) / (max - min)) * steps
  const position = Math.min(steps, Math.max(0, Math.round(rawPosition)))
  const fillPercent = (position / steps) * 100
  const style = { '--range-fill': `${fillPercent}%` } as CSSProperties

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPosition = Number(event.target.value)
    const nextValue = log
      ? positionToValue(nextPosition, min, max, true)
      : min + (nextPosition / steps) * (max - min)
    onChange(nextValue)
  }

  return (
    <div className={`param-control ${variant === 'batch' ? 'is-batch' : ''}`}>
      <div className="param-topline">
        <label htmlFor={id} className="param-label">
          {label}
        </label>
        <div className="param-readout-wrap">
          {badge}
          <output htmlFor={id} className="param-readout">
            {valueLabel}
          </output>
        </div>
      </div>
      <input
        id={id}
        className="hardware-range"
        type="range"
        min={0}
        max={steps}
        step={1}
        value={position}
        style={style}
        onChange={handleChange}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        aria-describedby={`${id}-helper`}
      />
      <div className="param-scale" aria-hidden="true">
        <span>{minLabel}</span>
        <span className="param-ticks" />
        <span>{maxLabel}</span>
      </div>
      <p className="param-helper" id={`${id}-helper`}>
        {helper}
      </p>
    </div>
  )
}
