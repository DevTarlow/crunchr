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
    id: 'movement',
    label: 'Movement',
    blurb: 'Jumps, landings and impacts',
  },
  {
    id: 'magic',
    label: 'Magic',
    blurb: 'Zaps, sparkles and power-ups',
  },
]

export const PRESETS: readonly Preset[] = [
  {
    id: 'mechanical-click',
    name: 'Mechanical Click',
    slug: 'mechanical_click',
    category: 'ui',
    model: 'mechanicalClick',
    description: 'A two-stage switch click with a high-mid plastic snap.',
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
    id: 'jump-takeoff',
    name: 'Jump',
    slug: 'jump_takeoff',
    category: 'movement',
    model: 'jump',
    description: 'A quick upward air push with a soft takeoff thump.',
    tags: ['JUMP', 'AIR'],
    defaults: {
      durationMs: 260,
      pitchHz: 520,
      punch: 62,
      resonance: 4.5,
      grit: 40,
      decay: 48,
    },
  },
  {
    id: 'heavy-landing',
    name: 'Landing',
    slug: 'heavy_landing',
    category: 'movement',
    model: 'land',
    description: 'A heavy body landing with a low thump and dust.',
    tags: ['LAND', 'IMPACT'],
    defaults: {
      durationMs: 300,
      pitchHz: 110,
      punch: 92,
      resonance: 8,
      grit: 55,
      decay: 60,
    },
  },
  {
    id: 'hit-impact',
    name: 'Hit',
    slug: 'hit_impact',
    category: 'movement',
    model: 'hit',
    description: 'A short, punchy body hit with a dry crack.',
    tags: ['HIT', 'IMPACT'],
    defaults: {
      durationMs: 190,
      pitchHz: 700,
      punch: 95,
      resonance: 5,
      grit: 35,
      decay: 60,
    },
  },
  {
    id: 'flesh-squish',
    name: 'Flesh Squish',
    slug: 'flesh_squish',
    category: 'movement',
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
    category: 'movement',
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
  {
    id: 'arcane-zap',
    name: 'Arcane Zap',
    slug: 'arcane_zap',
    category: 'magic',
    model: 'arcaneZap',
    description: 'A bright arcane crack that arcs down and crackles out.',
    tags: ['ARCANE', 'ZAP'],
    defaults: {
      durationMs: 280,
      pitchHz: 1800,
      punch: 86,
      resonance: 7,
      grit: 42,
      decay: 60,
    },
  },
  {
    id: 'magic-shimmer',
    name: 'Magic Shimmer',
    slug: 'magic_shimmer',
    category: 'magic',
    model: 'shimmer',
    description: 'A rising cloud of tiny glassy sparkles.',
    tags: ['SHIMMER', 'SPARKLE'],
    defaults: {
      durationMs: 620,
      pitchHz: 2200,
      punch: 26,
      resonance: 10,
      grit: 48,
      decay: 36,
    },
  },
  {
    id: 'power-up',
    name: 'Power-Up',
    slug: 'power_up',
    category: 'magic',
    model: 'powerUp',
    description: 'A four-note rise for pickups and level-ups.',
    tags: ['POWER-UP', 'RISE'],
    defaults: {
      durationMs: 520,
      pitchHz: 440,
      punch: 72,
      resonance: 6,
      grit: 22,
      decay: 30,
    },
  },
  {
    id: 'spell-whoosh',
    name: 'Spell Whoosh',
    slug: 'spell_whoosh',
    category: 'magic',
    model: 'whoosh',
    description: 'A rushing sweep of air for dashes and teleports.',
    tags: ['WHOOSH', 'AIR'],
    defaults: {
      durationMs: 560,
      pitchHz: 900,
      punch: 24,
      resonance: 3.2,
      grit: 62,
      decay: 42,
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
