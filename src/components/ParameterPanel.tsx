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
            <div className="section-kicker">SHAPE</div>
            <h2 id="parameters-title" className="section-title">
              Dial in the texture<span className="title-dot">.</span>
            </h2>
          </div>
        </div>
        <div className="live-controls-badge">
          <span className="tiny-led" aria-hidden="true" />
          Live controls
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
              <span className="humanize-title">Humanize / Variance</span>
              <span className="batch-tag">Batch only</span>
            </div>
          </div>
          <p>
            Drifts pitch, timing, filter body and texture across batch takes so repeated
            footsteps never fall into a machine-gun groove.
          </p>
        </div>
        <div className="humanize-slider">
          <HardwareSlider
            id="param-humanize"
            label="Batch drift"
            helper="0% = no parameter drift; every take still gets fresh noise."
            min={0}
            max={HUMANIZE_MAX}
            step={1}
            log={false}
            value={humanize}
            valueLabel={readoutForHumanize(humanize)}
            minLabel="Identical"
            maxLabel="Wide"
            onChange={onHumanizeChange}
            variant="batch"
          />
        </div>
      </div>

      <p className="panel-footnote">
        <span className="footnote-dot" aria-hidden="true" />
        Seeded synthesis is deterministic. The take you hear is the take you export.
      </p>
    </section>
  )
}
