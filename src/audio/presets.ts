import type { CategoryId, Preset } from './types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  blurb: string
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'ui',
    label: 'UI Clicks',
    blurb: 'Switches, plastic and wood',
  },
  {
    id: 'footsteps',
    label: 'Footsteps',
    blurb: 'Gravel, timber and concrete',
  },
  {
    id: 'foley',
    label: 'Foley / Items',
    blurb: 'Dice, cloth and metal',
  },
  {
    id: 'impacts',
    label: 'Impacts / Crunch',
    blurb: 'Wet flesh and dry bone',
  },
]

export const PRESETS: readonly Preset[] = [
  {
    id: 'mechanical-click',
    name: 'Mechanical Click',
    slug: 'mechanical_click',
    category: 'ui',
    model: 'mechanicalClick',
    description: 'A crisp dome-switch tick with a brittle plastic shell.',
    tags: ['IMPULSE', 'SWITCH'],
    defaults: {
      durationMs: 46,
      pitchHz: 2300,
      punch: 92,
      resonance: 15,
      grit: 38,
      decay: 30,
    },
  },
  {
    id: 'card-snap',
    name: 'Card / Plastic Snap',
    slug: 'card_snap',
    category: 'ui',
    model: 'cardSnap',
    description: 'A fast plastic flex and snap for cards, cases and toy parts.',
    tags: ['CHIRP', 'SNAP'],
    defaults: {
      durationMs: 82,
      pitchHz: 1700,
      punch: 88,
      resonance: 4.5,
      grit: 68,
      decay: 28,
    },
  },
  {
    id: 'wooden-button',
    name: 'Wooden Button',
    slug: 'wooden_button',
    category: 'ui',
    model: 'woodButton',
    description: 'A warm low tock with real timber under the cap.',
    tags: ['PING', 'WOOD'],
    defaults: {
      durationMs: 160,
      pitchHz: 180,
      punch: 72,
      resonance: 16,
      grit: 20,
      decay: 55,
    },
  },
  {
    id: 'gravel-crunch',
    name: 'Gravel Crunch',
    slug: 'gravel_crunch',
    category: 'footsteps',
    model: 'gravel',
    description: 'Scattered stone chips under a boot, all grit and micro-collisions.',
    tags: ['GRAINS', 'STONE'],
    defaults: {
      durationMs: 380,
      pitchHz: 1100,
      punch: 65,
      resonance: 2.8,
      grit: 90,
      decay: 45,
    },
  },
  {
    id: 'wood-thud',
    name: 'Wood Thud / Creak',
    slug: 'wood_thud',
    category: 'footsteps',
    model: 'woodThud',
    description: 'Hollow timber impact with a creak hiding in the tail.',
    tags: ['THUD', 'CREAK'],
    defaults: {
      durationMs: 300,
      pitchHz: 90,
      punch: 78,
      resonance: 7,
      grit: 30,
      decay: 60,
    },
  },
  {
    id: 'concrete-step',
    name: 'Stone / Concrete',
    slug: 'concrete_step',
    category: 'footsteps',
    model: 'stone',
    description: 'Sharp aggregate and a tight, bright room slapping back.',
    tags: ['CRACK', 'RING'],
    defaults: {
      durationMs: 230,
      pitchHz: 1500,
      punch: 92,
      resonance: 12,
      grit: 55,
      decay: 70,
    },
  },
  {
    id: 'dice-roll',
    name: 'Dice Roll / Bounce',
    slug: 'dice_roll',
    category: 'foley',
    model: 'dice',
    description: 'A handful of hard bounces with timings that obey gravity.',
    tags: ['BOUNCE', 'WOOD'],
    defaults: {
      durationMs: 640,
      pitchHz: 380,
      punch: 74,
      resonance: 10,
      grit: 50,
      decay: 38,
    },
  },
  {
    id: 'cloth-rustle',
    name: 'Cloth / Backpack Rustle',
    slug: 'cloth_rustle',
    category: 'foley',
    model: 'cloth',
    description: 'Soft, moving fabric with the occasional seam crackle.',
    tags: ['PINK', 'FABRIC'],
    defaults: {
      durationMs: 520,
      pitchHz: 1800,
      punch: 18,
      resonance: 1.2,
      grit: 92,
      decay: 28,
    },
  },
  {
    id: 'coin-clink',
    name: 'Coin / Metal Clink',
    slug: 'coin_clink',
    category: 'foley',
    model: 'coin',
    description: 'Two inharmonic partials and a fast, bright metal ring.',
    tags: ['METAL', 'PARTIAL'],
    defaults: {
      durationMs: 250,
      pitchHz: 2400,
      punch: 70,
      resonance: 18,
      grit: 25,
      decay: 20,
    },
  },
  {
    id: 'flesh-squish',
    name: 'Flesh Squish',
    slug: 'flesh_squish',
    category: 'impacts',
    model: 'flesh',
    description: 'A wet, pitch-bent squelch with a short band-passed slurp.',
    tags: ['WET', 'FM'],
    defaults: {
      durationMs: 340,
      pitchHz: 190,
      punch: 50,
      resonance: 4.5,
      grit: 74,
      decay: 62,
    },
  },
  {
    id: 'bone-crunch',
    name: 'Bone Crunch',
    slug: 'bone_crunch',
    category: 'impacts',
    model: 'bone',
    description: 'Pink-noise fractures, hard volume jumps and a snap that bites.',
    tags: ['DRY', 'FRACTURE'],
    defaults: {
      durationMs: 360,
      pitchHz: 900,
      punch: 86,
      resonance: 3.2,
      grit: 95,
      decay: 52,
    },
  },
]

export const DEFAULT_PRESET_ID = PRESETS[0].id

export function getPresetById(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]
}

export function getPresetsByCategory(category: CategoryId): readonly Preset[] {
  return PRESETS.filter((preset) => preset.category === category)
}

export function getCategory(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0]
}

/** Clone defaults so callers never mutate the shared preset bank. */
export function clonePresetDefaults(preset: Preset) {
  return { ...preset.defaults }
}
