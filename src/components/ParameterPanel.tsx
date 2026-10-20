import type { ParamKey, SynthParams } from '../audio/types'
import { HUMANIZE_MAX, PARAM_RANGES } from '../audio/params'
import { readoutForHumanize, readoutForParam } from '../lib/format'
import { HardwareSlider } from './Slider'

interface ParameterPanelProps {
  params: SynthParams
  humanize: number
  onParamChange: (key: ParamKey, value: number) => void
  onHumanizeChange: (value: number) => void
}

export function ParameterPanel({
  params,
  humanize,
  onParamChange,
  onHumanizeChange,
}: ParameterPanelProps) {
  return (
    <section className="panel parameter-panel" aria-labelledby="parameters-title">
      <div className="panel-head">
        <div className="section-heading">
          <span className="section-index">02</span>
          <div>
            <div className="section-kicker">Shape</div>
            <h2 id="parameters-title" className="section-title">
              Shape the sound<span className="title-dot">.</span>
            </h2>
          </div>
        </div>
        <div className="live-controls-badge">
          <span className="tiny-led" aria-hidden="true" />
          Changes live
        </div>
      </div>

      <div className="parameter-grid">
        {PARAM_RANGES.map((range) => (
          <HardwareSlider
            key={range.key}
            id={`param-${range.key}`}
            label={range.label}
            helper={range.helper}
            min={range.min}
            max={range.max}
            step={range.step}
            log={range.log}
            value={params[range.key]}
            valueLabel={readoutForParam(range.key, params[range.key])}
            minLabel={range.minLabel}
            maxLabel={range.maxLabel}
            onChange={(value) => onParamChange(range.key, value)}
          />
        ))}
      </div>

      <div className="humanize-module">
        <div className="humanize-copy">
          <div className="humanize-heading">
            <span className="humanize-mark" aria-hidden="true">
              ×
            </span>
            <div>
              <span className="humanize-title">Variation</span>
              <span className="batch-tag">10 sounds only</span>
            </div>
          </div>
          <p>
            Changes each of the 10 downloaded sounds a little, so a row of footsteps does
            not sound like one footstep.
          </p>
        </div>
        <div className="humanize-slider">
          <HardwareSlider
            id="param-humanize"
            label="Variation amount"
            helper="0% keeps the sliders where they are. Every sound still changes a little."
            min={0}
            max={HUMANIZE_MAX}
            step={1}
            log={false}
            value={humanize}
            valueLabel={readoutForHumanize(humanize)}
            minLabel="Same"
            maxLabel="Different"
            onChange={onHumanizeChange}
            variant="batch"
          />
        </div>
      </div>

      <p className="panel-footnote">
        <span className="footnote-dot" aria-hidden="true" />
        Every sound is made the same way each time. What you hear is what you download.
      </p>
    </section>
  )
}
