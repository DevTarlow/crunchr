import type { CategoryId, Preset } from './types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  blurb: string
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'ui',
    label: 'Clicks',
    blurb: 'Buttons, cards and switches',
  },
  {
    id: 'footsteps',
    label: 'Footsteps',
    blurb: 'Gravel, wood and stone',
  },
  {
    id: 'foley',
    label: 'Items',
    blurb: 'Dice, cloth and coins',
  },
  {
    id: 'impacts',
    label: 'Crunches',
    blurb: 'Squishes, snaps and breaks',
  },
]

export const PRESETS: readonly Preset[] = [
  {
    id: 'mechanical-click',
    name: 'Mechanical Click',
    slug: 'mechanical_click',
    category: 'ui',
    model: 'mechanicalClick',
    description: 'A two-stage switch click with a low plastic body.',
    tags: ['CLICK', 'PLASTIC'],
    defaults: {
      durationMs: 180,
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
    description: 'A card flexing, snapping and settling.',
    tags: ['PLASTIC', 'SNAP'],
    defaults: {
      durationMs: 200,
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
    description: 'A warm, low knock with wood under the cap.',
    tags: ['WOOD', 'WARM'],
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
    description: 'Loose stones shifting under a boot.',
    tags: ['STONES', 'STEPS'],
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
    description: 'A hollow wooden thump with a small creak.',
    tags: ['WOOD', 'HOLLOW'],
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
    description: 'A hard step on stone with a gritty scuff and a short slap.',
    tags: ['STONE', 'HARD'],
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
    description: 'A handful of hard bounces that slow down like real dice.',
    tags: ['DICE', 'BOUNCE'],
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
    description: 'Soft fabric moving, with a few little crackles.',
    tags: ['CLOTH', 'SOFT'],
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
    description: 'A bright metal ring that fades fast.',
    tags: ['METAL', 'RING'],
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
    description: 'A wet, rubbery squelch.',
    tags: ['WET', 'SQUISH'],
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
    description: 'A dry crunch with sharp little breaks.',
    tags: ['DRY', 'CRUNCH'],
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
