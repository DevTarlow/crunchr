import type { CategoryId, Preset } from '../audio/types'
import { CATEGORIES, getCategory, getPresetsByCategory, PRESETS } from '../audio/presets'
import { MutateIcon, RerollIcon, SparkIcon, SlidersIcon } from './Icons'

interface PresetBankProps {
  activePreset: Preset
  modified: boolean
  take: number
  onSelectCategory: (category: CategoryId) => void
  onSelectPreset: (preset: Preset) => void
  onSurprise: () => void
  onMutate: () => void
}

export function PresetBank({
  activePreset,
  modified,
  take,
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
            <div className="section-kicker">Sounds</div>
            <h2 id="sound-bank-title" className="section-title">
              Pick a sound<span className="title-dot">.</span>
            </h2>
          </div>
          <span className="patch-count">
            {total} sounds / {CATEGORIES.length} groups
          </span>
        </div>
        <div className="bank-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onSurprise}
            title="Pick a random sound"
          >
            <SparkIcon className="button-icon" />
            <span>Surprise me</span>
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={onMutate}
            title="Move every slider by up to 10%"
          >
            <MutateIcon className="button-icon" />
            <span>Nudge 10%</span>
          </button>
        </div>
      </div>

      <div className="bank-browser">
        <div className="category-rail" role="group" aria-label="Sound groups">
          {CATEGORIES.map((category) => {
            const selected = category.id === activePreset.category
            const count = getPresetsByCategory(category.id).length
            return (
              <button
                key={category.id}
                type="button"
                className={`category-button ${selected ? 'is-active' : ''}`}
                aria-pressed={selected}
                aria-label={`${category.label}, ${count} ${count === 1 ? 'sound' : 'sounds'} — ${category.blurb}`}
                title={category.blurb}
                onClick={() => onSelectCategory(category.id)}
              >
                <span className="category-number" aria-hidden="true">
                  {String(CATEGORIES.findIndex((item) => item.id === category.id) + 1).padStart(2, '0')}
                </span>
                <span className="category-label">{category.label}</span>
                <span className="category-count" aria-hidden="true">
                  {String(count).padStart(2, '0')}
                </span>
              </button>
            )
          })}
        </div>

        <div
          className="preset-rail"
          role="group"
          aria-label={`${getCategory(activePreset.category).label} sounds`}
        >
          {categoryPresets.map((preset, index) => {
            const selected = preset.id === activePreset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip ${selected ? 'is-active' : ''}`}
                aria-pressed={selected}
                aria-label={`${preset.name}. ${preset.description}${
                  selected && modified ? ' Changed.' : ''
                }${selected ? ' Tap again for a new version.' : ''}`}
                title={selected ? 'Tap again for a new version' : preset.description}
                onClick={() => onSelectPreset(preset)}
              >
                <span className="preset-chip-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="preset-chip-copy">
                  <strong>{preset.name}</strong>
                  <span>{preset.tags.join(' / ')}</span>
                </span>
                {selected ? (
                  <span key={take} className="preset-chip-reroll" aria-hidden="true">
                    <RerollIcon />
                    <span>New version</span>
                  </span>
                ) : null}
                {selected && modified ? <span className="modified-badge">Changed</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bank-footnotes">
        <div className="bank-footnote">
          <span className="footnote-icon" aria-hidden="true">
            <SlidersIcon />
          </span>
          <span>
            Every sound is made from scratch in your browser. Nothing is loaded from a
            file.
          </span>
        </div>
        <div className="bank-footnote bank-tip">
          <span className="footnote-icon" aria-hidden="true">
            <RerollIcon />
          </span>
          <span>
            Tap the selected sound again for a new version. Same sound, new random
            details.
          </span>
        </div>
      </div>
    </section>
  )
}
