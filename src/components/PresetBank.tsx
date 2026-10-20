import type { CategoryId, Preset } from '../audio/types'
import { CATEGORIES, getPresetsByCategory, PRESETS } from '../audio/presets'
import { MutateIcon, SparkIcon, SlidersIcon } from './Icons'

interface PresetBankProps {
  activePreset: Preset
  modified: boolean
  onSelectCategory: (category: CategoryId) => void
  onSelectPreset: (preset: Preset) => void
  onSurprise: () => void
  onMutate: () => void
}

export function PresetBank({
  activePreset,
  modified,
  onSelectCategory,
  onSelectPreset,
  onSurprise,
  onMutate,
}: PresetBankProps) {
  const categoryPresets = getPresetsByCategory(activePreset.category)
  const total = PRESETS.length

  return (
    <section className="panel preset-bank" aria-labelledby="sound-bank-title">
      <div className="panel-head preset-bank-head">
        <div className="section-heading">
          <span className="section-index">01</span>
          <div>
            <div className="section-kicker">SOUND BANK</div>
            <h2 id="sound-bank-title" className="section-title">
              Pick a material<span className="title-dot">.</span>
            </h2>
          </div>
          <span className="patch-count">
            {total.toString().padStart(2, '0')} patches / 04 banks
          </span>
        </div>
        <div className="bank-actions">
          <button type="button" className="button button-ghost" onClick={onSurprise}>
            <SparkIcon className="button-icon" />
            <span>Surprise me</span>
          </button>
          <button type="button" className="button button-ghost" onClick={onMutate}>
            <MutateIcon className="button-icon" />
            <span>Mutate ±10%</span>
          </button>
        </div>
      </div>

      <div className="bank-browser">
        <div className="category-rail" role="group" aria-label="Sound categories">
          {CATEGORIES.map((category) => {
            const selected = category.id === activePreset.category
            const count = getPresetsByCategory(category.id).length
            return (
              <button
                key={category.id}
                type="button"
                className={`category-button ${selected ? 'is-active' : ''}`}
                aria-pressed={selected}
                title={category.blurb}
                onClick={() => onSelectCategory(category.id)}
              >
                <span className="category-number">
                  {String(CATEGORIES.findIndex((item) => item.id === category.id) + 1).padStart(2, '0')}
                </span>
                <span className="category-label">{category.label}</span>
                <span className="category-count">{String(count).padStart(2, '0')}</span>
              </button>
            )
          })}
        </div>

        <div className="preset-rail" role="group" aria-label={`${activePreset.category} presets`}>
          {categoryPresets.map((preset, index) => {
            const selected = preset.id === activePreset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip ${selected ? 'is-active' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelectPreset(preset)}
              >
                <span className="preset-chip-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="preset-chip-copy">
                  <strong>{preset.name}</strong>
                  <span>{preset.tags.join(' / ')}</span>
                </span>
                {selected && modified ? <span className="modified-badge">MOD</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bank-footnote">
        <span className="footnote-icon" aria-hidden="true">
          <SlidersIcon />
        </span>
        <span>
          Every sound is generated from oscillators, filters and seeded noise. No audio
          files, no downloads, no samples.
        </span>
      </div>
    </section>
  )
}
